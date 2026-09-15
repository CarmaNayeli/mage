import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { installMockWebSocket, MockWebSocket } from "./test/mockWebSocket";
import type { GameView } from "./types/gameView";

function startGame(playerName: string, decklist: string) {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: playerName } });
  fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: decklist } });
  fireEvent.click(screen.getByRole("button", { name: "Start game" }));
}

const minimalGameView = {
  turn: 1,
  phase: "PRECOMBAT_MAIN",
  step: "MAIN",
  activePlayerId: "p1",
  activePlayerName: "Me",
  priorityPlayerName: "Me",
  myPlayerId: "p1",
  myHand: {},
  myHelperEmblems: {},
  opponentHands: {},
  watchedHands: {},
  stack: {},
  exiles: [],
  revealed: [],
  lookedAt: [],
  companion: [],
  combat: [],
  players: [
    { playerId: "p1", name: "Me", life: 20, isHuman: true, hasLeft: false, handCount: 0, graveyard: {}, battlefield: {} },
  ],
} as unknown as GameView;

describe("App", () => {
  let restoreWebSocket: () => void;

  beforeEach(() => {
    restoreWebSocket = installMockWebSocket();
    localStorage.clear();
  });

  afterEach(() => {
    restoreWebSocket();
  });

  it("shows the intro paragraph and deck entry before a game starts", () => {
    render(<App />);
    expect(document.querySelector(".app-intro")?.textContent).toMatch(/XMage/);
    expect(document.querySelector(".app-intro")?.textContent).toMatch(/Claude/);
    expect(screen.getByRole("button", { name: "Start game" })).toBeInTheDocument();
  });

  it("saves a deck via the menu (prompting for a name) and lists it in the menu's Load Deck submenu", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: "20 Mountain\n20 Forest" } });

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Gruul Aggro");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Deck" }));
    expect(promptSpy).toHaveBeenCalled();

    // The inline "My Decks" panel picks up the same save immediately (shared list).
    expect(screen.getByRole("button", { name: /^Gruul Aggro/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Load Deck/ }));
    // The submenu's label uses the raw format id ("freeform"), the inline panel's own
    // list uses the friendly one ("Freeform (no restrictions)") - distinct strings,
    // so this only matches the submenu entry even with both lists visible at once.
    expect(screen.getByRole("button", { name: "Gruul Aggro (freeform)" })).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it("doesn't save via the menu when the deck is empty or the name prompt is cancelled", () => {
    render(<App />);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Empty Deck");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Deck" }));
    expect(promptSpy).not.toHaveBeenCalled(); // no decklist typed yet - never even asked

    fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: "20 Mountain" } });
    promptSpy.mockReturnValue(null); // user cancels the name prompt
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Deck" }));

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Load Deck/ }));
    expect(screen.getByText("Nothing saved yet")).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it("loads a deck picked from the menu's Load Deck submenu into the form", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Carma" } });
    fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: "20 Mountain" } });
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Mono Red");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Deck" }));
    promptSpy.mockRestore();

    fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: "something else entirely" } });

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Load Deck/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mono Red (freeform)" }));

    expect(screen.getByLabelText("Decklist")).toHaveValue("20 Mountain");
  });

  it("hides Save Deck/Load Deck from the menu once a game has started", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByRole("button", { name: "Save Deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Load Deck/ })).not.toBeInTheDocument();
  });

  it("waits for the socket to open before sending the join, not synchronously on submit", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");

    const socket = MockWebSocket.instances[0];
    expect(socket.sent).toEqual([]);

    act(() => socket.triggerOpen());
    // JSON.stringify drops undefined-valued keys (opponentDeck/difficulty) entirely.
    expect(socket.sent).toEqual([
      JSON.stringify({
        call: "join_practice_table",
        args: [{ playerName: "Carma", format: "freeform", playerDeck: "20 Mountain", opponentMode: "basic" }],
      }),
    ]);
  });

  it("renders the board once a GAME_UPDATE envelope arrives", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());

    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));

    expect(screen.queryByRole("button", { name: "Start game" })).not.toBeInTheDocument();
    expect(screen.getByText(/Turn 1 - PRECOMBAT_MAIN \/ MAIN/)).toBeInTheDocument();
  });

  it("shows the game-over banner and returns to deck entry on Play again", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));
    act(() => socket.triggerMessage({ type: "GAME_OVER", objectId: null, data: "You win!" }));

    expect(screen.getByText("You win!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Start game" })).toBeInTheDocument();
    // The socket itself stays connected across a reset (an account login shouldn't
    // need re-establishing just because a match ended) - only a real connection
    // failure closes it.
    expect(socket.closed).toBe(false);
  });

  it("disables Restart before joining, and sends concede then resets when used mid-game", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Menu" })); // close it back up

    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

    expect(socket.sent).toContainEqual(JSON.stringify({ call: "concede", args: [] }));
    // The socket itself stays connected (see the "Play again" test above for why).
    expect(socket.closed).toBe(false);
    expect(screen.getByRole("button", { name: "Start game" })).toBeInTheDocument();
  });

  it("shows the game log with an in-game error surfaced (not just swallowed pre-game)", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));
    act(() => socket.triggerMessage({ type: "GAME_ERROR", objectId: null, data: "That's not a legal target." }));

    expect(screen.getByText("Game Log")).toBeInTheDocument();
    expect(screen.getByText("⚠ That's not a legal target.")).toBeInTheDocument();
  });

  it("shows Exile and each player's Commander in the sidebar, not the main board column", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());

    const withCommanders: GameView = {
      ...minimalGameView,
      players: [
        { ...minimalGameView.players[0], commandList: [{ id: "cmdr-1", name: "Krenko, Mob Boss", mageObjectType: "COMMANDER" }] },
        {
          playerId: "p2",
          name: "Practice Bot",
          life: 20,
          isHuman: false,
          hasLeft: false,
          handCount: 0,
          graveyard: {},
          battlefield: {},
          commandList: [{ id: "cmdr-2", name: "Prosper, Tome-Bound", mageObjectType: "COMMANDER" }],
        },
      ],
    } as unknown as GameView;
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: withCommanders }));

    const sidebar = document.querySelector(".game-sidebar") as HTMLElement;
    expect(within(sidebar).getByText("Exile (0)")).toBeInTheDocument();
    expect(within(sidebar).getByText("Commander - Me")).toBeInTheDocument();
    expect(within(sidebar).getByTitle("Krenko, Mob Boss")).toBeInTheDocument();
    expect(within(sidebar).getByText("Commander - Practice Bot")).toBeInTheDocument();
    expect(within(sidebar).getByTitle("Prosper, Tome-Bound")).toBeInTheDocument();
  });

  it("zooms in on a card hovered inside a dialog (e.g. GAME_TARGET), not just the board itself", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));

    const withTargetableLand: GameView = {
      ...minimalGameView,
      players: [
        { ...minimalGameView.players[0], battlefield: { "land-1": { id: "land-1", name: "Mountain", cardTypes: ["LAND"] } } },
      ],
    };
    act(() =>
      socket.triggerMessage({
        type: "GAME_TARGET",
        objectId: null,
        data: { targets: ["land-1"], flag: true, gameView: withTargetableLand },
      }),
    );

    // The same land is also on the board itself (a real GAME_TARGET carries a fresh
    // gameView) - scope to the dialog's own copy specifically, since the point here is
    // that hovering a card *inside the dialog* (not the board) triggers the zoom.
    const dialogCard = within(document.querySelector(".dialog-prompt") as HTMLElement).getByTitle("Mountain");

    // .card-zoom-backdrop only exists at all while something's actually zoomed -
    // checking for it (rather than the card's name/image, which also appears
    // elsewhere on the page) is what actually confirms the overlay itself opened.
    expect(document.querySelector(".card-zoom-backdrop")).not.toBeInTheDocument();
    fireEvent.mouseEnter(dialogCard);
    fireEvent.keyDown(window, { key: "z" });
    expect(document.querySelector(".card-zoom-backdrop")).toBeInTheDocument();

    fireEvent.keyUp(window, { key: "z" });
    expect(document.querySelector(".card-zoom-backdrop")).not.toBeInTheDocument();
  });

  it("hides the bot's table talk by default, showing it once the setting is toggled on (and remembers the choice)", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));
    act(() =>
      socket.triggerMessage({
        type: "CHATMESSAGE",
        objectId: null,
        data: { username: "", message: 'Practice Bot says: "Try harder."', messageType: "TALK" },
      }),
    );
    act(() =>
      socket.triggerMessage({
        type: "CHATMESSAGE",
        objectId: null,
        data: { username: "", message: "Practice Bot casts Lightning Bolt", messageType: "GAME" },
      }),
    );

    // Off by default - the talk line is filtered, ordinary play-by-play still shows.
    expect(screen.queryByText('Practice Bot says: "Try harder."')).not.toBeInTheDocument();
    expect(screen.getByText("Practice Bot casts Lightning Bolt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Table Talk: Off" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Table Talk: Off" }));

    expect(screen.getByText('Practice Bot says: "Try harder."')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Table Talk: On" })).toBeInTheDocument();
  });

  it("only shows the chat box once table talk is toggled on, and lets the player chat back to the bot", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() => socket.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));

    expect(screen.queryByPlaceholderText("Say something…")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Table Talk: Off" }));

    fireEvent.change(screen.getByPlaceholderText("Say something…"), { target: { value: "gg already?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(socket.sent).toContainEqual(JSON.stringify({ call: "chat", args: ["gg already?"] }));
    expect(screen.getByPlaceholderText("Say something…")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Table Talk: On" }));
    expect(screen.queryByPlaceholderText("Say something…")).not.toBeInTheDocument();
  });

  it("re-enables the form and lets a retry open a fresh socket after a connection failure", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const first = MockWebSocket.instances[0];
    act(() => first.triggerClose());

    expect(screen.getByText(/couldn't reach the server/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start game" })).not.toBeDisabled();

    startGame("Carma", "20 Mountain");
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].closed).toBe(false);
  });

  it("turns into a Reconnect button on a mid-game disconnect, and opens a fresh socket with the same deck", () => {
    render(<App />);
    startGame("Carma", "20 Mountain");
    const first = MockWebSocket.instances[0];
    act(() => first.triggerOpen());
    act(() => first.triggerMessage({ type: "GAME_UPDATE", objectId: null, data: minimalGameView }));

    act(() => first.triggerClose());
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].closed).toBe(false);

    act(() => MockWebSocket.instances[1].triggerOpen());
    expect(MockWebSocket.instances[1].sent).toEqual([
      JSON.stringify({
        call: "join_practice_table",
        args: [{ playerName: "Carma", format: "freeform", playerDeck: "20 Mountain", opponentMode: "basic" }],
      }),
    ]);
  });

  it("connects eagerly and tries a saved account token as soon as the socket opens, before any table is joined", () => {
    localStorage.setItem("xeffigy.accountToken", "saved-token");
    render(<App />);

    const socket = MockWebSocket.instances[0];
    expect(socket.sent).toEqual([]);
    act(() => socket.triggerOpen());

    expect(socket.sent).toContainEqual(JSON.stringify({ call: "login_with_token", args: ["saved-token"] }));
  });

  it("logs in through the account modal, persists the token, and lists My Decks from the account instead of localStorage", () => {
    render(<App />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log In / Sign Up" }));

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carma" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(socket.sent).toContainEqual(JSON.stringify({ call: "login", args: [{ username: "carma", password: "hunter2" }] }));

    act(() =>
      socket.triggerMessage({
        type: "ACCOUNT_LOGGED_IN",
        objectId: null,
        data: { username: "carma", token: "real-token", settings: { tableTalk: true } },
      }),
    );

    // The modal closes itself once logged in, the token is remembered for next time,
    // and the deck list is requested (server-backed decks replace the localStorage ones).
    expect(screen.queryByRole("button", { name: "Log In" })).not.toBeInTheDocument();
    expect(localStorage.getItem("xeffigy.accountToken")).toBe("real-token");
    expect(socket.sent).toContainEqual(JSON.stringify({ call: "list_decks", args: [] }));

    act(() => socket.triggerMessage({ type: "ACCOUNT_DECKS", objectId: null, data: [{ name: "Mono Red", format: "standard" }] }));
    expect(screen.getByText(/saved to your account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mono Red/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Log Out (carma)" })).toBeInTheDocument();
  });

  it("shows an account error inside the modal without disturbing the pre-game connection error state", () => {
    render(<App />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log In / Sign Up" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carma" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    act(() => socket.triggerMessage({ type: "ACCOUNT_ERROR", objectId: null, data: "Incorrect password." }));

    expect(screen.getByText("Incorrect password.")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't reach the server/i)).not.toBeInTheDocument();
  });

  it("logs out via the menu, forgetting the saved token", () => {
    localStorage.setItem("xeffigy.accountToken", "saved-token");
    render(<App />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() =>
      socket.triggerMessage({
        type: "ACCOUNT_LOGGED_IN",
        objectId: null,
        data: { username: "carma", token: "saved-token", settings: {} },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log Out (carma)" }));

    expect(socket.sent).toContainEqual(JSON.stringify({ call: "logout", args: [] }));
    expect(localStorage.getItem("xeffigy.accountToken")).toBeNull();
  });

  it("toggles table talk via the account's server-persisted setting once logged in, instead of localStorage", () => {
    render(<App />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());
    act(() =>
      socket.triggerMessage({
        type: "ACCOUNT_LOGGED_IN",
        objectId: null,
        data: { username: "carma", token: "t1", settings: { tableTalk: true } },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Table Talk: On" }));

    expect(socket.sent).toContainEqual(JSON.stringify({ call: "update_settings", args: [{ tableTalk: false }] }));
  });
});
