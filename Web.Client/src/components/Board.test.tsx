import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CardView, GameView } from "../types/gameView";
import { Board } from "./Board";

function card(overrides: Partial<CardView> & { id: string; name: string }): CardView {
  return { types: [], ...overrides };
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
  players: [
    {
      playerId: meId,
      name: "Me",
      life: 20,
      human: true,
      inGame: true,
      hasLeft: false,
      handCount: 1,
      graveyard: { "grave-1": card({ id: "grave-1", name: "Lava Spike" }) },
      battlefield: { "land-1": card({ id: "land-1", name: "Mountain", types: ["Land"] }) },
      manaPool: { Red: 2, Blue: 0 },
    },
    {
      playerId: opponentId,
      name: "Practice Bot",
      life: 18,
      human: false,
      inGame: true,
      hasLeft: false,
      handCount: 4,
      graveyard: {},
      battlefield: {
        "creature-1": card({ id: "creature-1", name: "Grizzly Bears", types: ["Creature"], power: "2", toughness: "2" }),
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
    expect(screen.getByText("Turn 3 - PRECOMBAT_MAIN / MAIN")).toBeInTheDocument();
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

  it("only fires onPlayCard for hand cards", () => {
    const onPlayCard = vi.fn();
    render(<Board game={gameView} onPlayCard={onPlayCard} />);
    screen.getByText("Lightning Bolt").click();
    expect(onPlayCard).toHaveBeenCalledWith(gameView.myHand["hand-1"]);
  });
});
