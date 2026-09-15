import { describe, expect, it } from "vitest";
import type { GatewayEnvelope } from "../types/envelope";
import type { GameView } from "../types/gameView";
import { gameReducer, initialGameState } from "./gameReducer";

function envelope<T>(type: string, data: T): { kind: "envelope"; envelope: GatewayEnvelope<T> } {
  return { kind: "envelope", envelope: { type, objectId: null, data } };
}

const minimalGameView = { turn: 1, phase: "PRECOMBAT_MAIN", players: [] } as unknown as GameView;

describe("gameReducer", () => {
  it("starts idle with no game", () => {
    expect(initialGameState.connectionStatus).toBe("idle");
    expect(initialGameState.game).toBeNull();
  });

  it("tracks connection status transitions", () => {
    const connecting = gameReducer(initialGameState, { kind: "connection-status", status: "connecting" });
    expect(connecting.connectionStatus).toBe("connecting");

    const connected = gameReducer(connecting, { kind: "connection-status", status: "connected" });
    expect(connected.connectionStatus).toBe("connected");
  });

  it.each(["GAME_UPDATE", "GAME_INIT"])("adopts the bare GameView payload as game state on %s", (type) => {
    const next = gameReducer(initialGameState, envelope(type, minimalGameView));
    expect(next.game).toEqual(minimalGameView);
  });

  it("unwraps GAME_UPDATE_AND_INFORM's nested gameView instead of adopting the wrapper", () => {
    const wrapped = { gameView: minimalGameView, message: "Bot casts Lightning Bolt" };
    const next = gameReducer(initialGameState, envelope("GAME_UPDATE_AND_INFORM", wrapped));
    expect(next.game).toEqual(minimalGameView);
  });

  it("does not touch game state on START_GAME - its payload isn't a GameView", () => {
    const midGame = gameReducer(initialGameState, envelope("GAME_INIT", minimalGameView));
    const startGamePayload = { gameId: "g1", currentTableId: "t1", playerId: "p1" };
    const next = gameReducer(midGame, envelope("START_GAME", startGamePayload));
    expect(next.game).toEqual(minimalGameView);
  });

  it.each(["GAME_TARGET", "GAME_CHOOSE_ABILITY", "GAME_ASK", "GAME_SELECT", "GAME_PLAY_MANA", "GAME_GET_AMOUNT"])(
    "surfaces a dialog on %s",
    (type) => {
      const payload = { message: "Pick one", options: [{ index: 0, label: "Yes" }] };
      const next = gameReducer(initialGameState, envelope(type, payload));
      expect(next.pendingDialog).toEqual({ type, payload });
    },
  );

  it("clears the pending dialog once answered", () => {
    const withDialog = gameReducer(initialGameState, envelope("GAME_ASK", { message: "?" }));
    expect(withDialog.pendingDialog).not.toBeNull();

    const answered = gameReducer(withDialog, { kind: "dialog-answered" });
    expect(answered.pendingDialog).toBeNull();
  });

  it("appends chat/status messages, keeping only the last 100", () => {
    let state = initialGameState;
    for (let i = 0; i < 105; i++) {
      state = gameReducer(state, envelope("CHATMESSAGE", `msg ${i}`));
    }
    expect(state.messages).toHaveLength(100);
    expect(state.messages[0]).toBe("msg 5");
    expect(state.messages.at(-1)).toBe("msg 104");
  });

  it("stringifies non-string message payloads", () => {
    const next = gameReducer(initialGameState, envelope("SERVER_MESSAGE", { text: "hi" }));
    expect(next.messages).toEqual([JSON.stringify({ text: "hi" })]);
  });

  it("records the last error on GAME_ERROR without touching messages", () => {
    const next = gameReducer(initialGameState, envelope("GAME_ERROR", "boom"));
    expect(next.lastError).toBe("boom");
    expect(next.messages).toEqual([]);
  });

  it("ignores unrecognized envelope types", () => {
    const next = gameReducer(initialGameState, envelope("SOME_UNKNOWN_TYPE", { whatever: true }));
    expect(next).toEqual(initialGameState);
  });

  it.each(["GAME_OVER", "END_GAME_INFO"])("records the result and clears any pending dialog on %s", (type) => {
    const withDialog = gameReducer(initialGameState, envelope("GAME_ASK", { message: "?" }));
    const next = gameReducer(withDialog, envelope(type, "You win!"));
    expect(next.gameOver).toBe("You win!");
    expect(next.pendingDialog).toBeNull();
  });

  it("stringifies a non-string game-over payload", () => {
    const next = gameReducer(initialGameState, envelope("GAME_OVER", { winner: "Practice Bot" }));
    expect(next.gameOver).toBe(JSON.stringify({ winner: "Practice Bot" }));
  });

  it("resets fully back to the initial state", () => {
    const midGame = gameReducer(initialGameState, envelope("GAME_UPDATE", minimalGameView));
    const reset = gameReducer(midGame, { kind: "reset" });
    expect(reset).toEqual(initialGameState);
  });
});
