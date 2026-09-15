import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    expect(screen.getByText("Turn 1 - PRECOMBAT_MAIN / MAIN")).toBeInTheDocument();
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
    expect(socket.closed).toBe(true);
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
});
