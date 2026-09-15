import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CardView, GameView } from "../types/gameView";
import { Board } from "./Board";

function card(overrides: Partial<CardView> & { id: string; name: string }): CardView {
  return { cardTypes: [], ...overrides };
}

const opponentId = "opponent-1";
const meId = "me-1";

const gameView: GameView = {
  priorityTime: 0,
  bufferTime: 0,
  myPlayerId: meId,
  myHand: {
    "hand-1": card({ id: "hand-1", name: "Lightning Bolt" }),
  },
  myHelperEmblems: {},
  opponentHands: {},
  watchedHands: {},
  stack: {
    "stack-1": card({ id: "stack-1", name: "Counterspell" }),
  },
  exiles: [
    {
      id: "exile-1",
      name: "Exile",
      cards: { "exiled-1": card({ id: "exiled-1", name: "Swords to Plowshares" }) },
    },
  ],
  revealed: [],
  lookedAt: [],
  companion: [],
  combat: [],
  phase: "PRECOMBAT_MAIN",
  step: "MAIN",
  activePlayerId: meId,
  activePlayerName: "Me",
  priorityPlayerName: "Me",
  turn: 3,
  special: false,
  rollbackTurnsAllowed: false,
  canPlayObjects: null,
  players: [
    {
      playerId: meId,
      name: "Me",
      life: 20,
      isHuman: true,
      hasLeft: false,
      handCount: 1,
      libraryCount: 53,
      graveyard: { "grave-1": card({ id: "grave-1", name: "Lava Spike" }) },
      battlefield: { "land-1": card({ id: "land-1", name: "Mountain", cardTypes: ["LAND"] }) },
      manaPool: { red: 2, blue: 0 },
    },
    {
      playerId: opponentId,
      name: "Practice Bot",
      life: 18,
      isHuman: false,
      hasLeft: false,
      handCount: 4,
      libraryCount: 55,
      graveyard: {},
      battlefield: {
        "creature-1": card({ id: "creature-1", name: "Grizzly Bears", cardTypes: ["CREATURE"], power: "2", toughness: "2" }),
      },
    },
  ],
};

describe("Board", () => {
  it("renders both players, life totals, and the bot badge", () => {
    render(<Board game={gameView} />);
    expect(screen.getByText("Me")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Practice Bot")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Bot")).toBeInTheDocument();
  });

  it("renders the turn/phase header", () => {
    render(<Board game={gameView} />);
    expect(screen.getByText("Turn 3 - PRECOMBAT_MAIN / MAIN - Active: Me")).toBeInTheDocument();
  });

  it("renders the hand, graveyard, stack, exile, and mana pool zones", () => {
    render(<Board game={gameView} />);
    expect(screen.getByText("Lightning Bolt")).toBeInTheDocument();
    expect(screen.getByText("Lava Spike")).toBeInTheDocument();
    expect(screen.getByText("Graveyard (1)")).toBeInTheDocument();
    expect(screen.getByText("Counterspell")).toBeInTheDocument();
    expect(screen.getByText("Swords to Plowshares")).toBeInTheDocument();
    expect(screen.getByText("2R")).toBeInTheDocument();
  });

  it("only makes cards in playableIds clickable, whether in hand or on my own battlefield", () => {
    const onPlayCard = vi.fn();
    render(<Board game={gameView} onPlayCard={onPlayCard} playableIds={new Set(["hand-1", "land-1"])} />);

    screen.getByText("Lightning Bolt").click();
    expect(onPlayCard).toHaveBeenCalledWith(gameView.myHand["hand-1"]);

    screen.getByText("Mountain").click();
    expect(onPlayCard).toHaveBeenCalledWith(gameView.players[0].battlefield["land-1"]);

    // Not in playableIds - opponent's creature - clicking it must not fire onPlayCard.
    onPlayCard.mockClear();
    screen.getByText("Grizzly Bears").click();
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it("doesn't make cards clickable at all when nothing is playable", () => {
    const onPlayCard = vi.fn();
    render(<Board game={gameView} onPlayCard={onPlayCard} />);
    screen.getByText("Lightning Bolt").click();
    screen.getByText("Mountain").click();
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it("zooms in on a hovered card only while Z is held, and drops it on keyup", () => {
    render(<Board game={gameView} />);
    expect(screen.queryByRole("heading", { name: "Mountain" })).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTitle("Mountain"));
    expect(screen.queryByRole("heading", { name: "Mountain" })).not.toBeInTheDocument(); // not yet - Z isn't held

    fireEvent.keyDown(window, { key: "z" });
    expect(screen.getByRole("heading", { name: "Mountain" })).toBeInTheDocument();

    fireEvent.keyUp(window, { key: "z" });
    expect(screen.queryByRole("heading", { name: "Mountain" })).not.toBeInTheDocument();
  });

  it("drops the zoom on window blur even without a keyup (e.g. alt-tab)", () => {
    render(<Board game={gameView} />);
    fireEvent.mouseEnter(screen.getByTitle("Mountain"));
    fireEvent.keyDown(window, { key: "z" });
    expect(screen.getByRole("heading", { name: "Mountain" })).toBeInTheDocument();

    fireEvent.blur(window);
    expect(screen.queryByRole("heading", { name: "Mountain" })).not.toBeInTheDocument();
  });

  it("T activates the hovered card only if it's currently playable", () => {
    const onPlayCard = vi.fn();
    render(<Board game={gameView} onPlayCard={onPlayCard} playableIds={new Set(["land-1"])} />);

    fireEvent.mouseEnter(screen.getByTitle("Lightning Bolt"));
    fireEvent.keyDown(window, { key: "t" });
    expect(onPlayCard).not.toHaveBeenCalled(); // hand-1 isn't in playableIds

    fireEvent.mouseEnter(screen.getByTitle("Mountain"));
    fireEvent.keyDown(window, { key: "t" });
    expect(onPlayCard).toHaveBeenCalledWith(gameView.players[0].battlefield["land-1"]);
  });
});
