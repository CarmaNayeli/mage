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

  it.each(["GAME_TARGET", "GAME_CHOOSE_ABILITY", "GAME_ASK", "GAME_PLAY_MANA", "GAME_GET_AMOUNT"])(
    "surfaces a dialog on %s",
    (type) => {
      const payload = { message: "Pick one", options: [{ index: 0, label: "Yes" }] };
      const next = gameReducer(initialGameState, envelope(type, payload));
      expect(next.pendingDialog).toEqual({ type, payload });
    },
  );

  // GAME_SELECT is tested separately (below) since - unlike every other dialog type -
  // whether it surfaces at all now depends on canPlayObjects (see utils/autoPass.ts).
  it("surfaces a GAME_SELECT dialog when something is actually playable", () => {
    const payload = { gameView: { canPlayObjects: { objects: { "card-1": {} } } }, message: "Play spells and abilities" };
    const next = gameReducer(initialGameState, envelope("GAME_SELECT", payload));
    expect(next.pendingDialog).toEqual({ type: "GAME_SELECT", payload });
  });

  it("does not surface a GAME_SELECT dialog (auto-passed instead) when nothing is playable", () => {
    const payload = { gameView: { canPlayObjects: { objects: {} } }, message: "Play spells and abilities" };
    const next = gameReducer(initialGameState, envelope("GAME_SELECT", payload));
    expect(next.pendingDialog).toBeNull();
  });

  it("adopts a dialog's embedded gameView (e.g. GAME_ASK's mulligan prompt fires right after hands are dealt)", () => {
    const dealtHand = { turn: 1, phase: "PRECOMBAT_MAIN", players: [], myHand: { c1: { id: "c1", name: "Plains" } } } as unknown as GameView;
    const next = gameReducer(initialGameState, envelope("GAME_ASK", { gameView: dealtHand, message: "Mulligan?" }));
    expect(next.game).toEqual(dealtHand);
    expect(next.pendingDialog?.type).toBe("GAME_ASK");
  });

  it("keeps the existing game state when a dialog has no embedded gameView (GAME_CHOOSE_ABILITY)", () => {
    const withGame = gameReducer(initialGameState, envelope("GAME_INIT", minimalGameView));
    const next = gameReducer(withGame, envelope("GAME_CHOOSE_ABILITY", { choices: { a1: "Cast Shock" } }));
    expect(next.game).toEqual(minimalGameView);
  });

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
    expect(state.messages[0]).toEqual({ text: "msg 5", isTalk: false });
    expect(state.messages.at(-1)).toEqual({ text: "msg 104", isTalk: false });
  });

  it("stringifies message payloads with no recognizable text field", () => {
    const next = gameReducer(initialGameState, envelope("SERVER_MESSAGE", { text: "hi" }));
    expect(next.messages).toEqual([{ text: JSON.stringify({ text: "hi" }), isTalk: false }]);
  });

  it("extracts .message from a real ChatMessage-shaped CHATMESSAGE payload (ordinary play-by-play, messageType GAME - not talk)", () => {
    const next = gameReducer(
      initialGameState,
      envelope("CHATMESSAGE", { username: "", message: "Practice Bot casts Lightning Bolt", time: null, color: "BLACK", messageType: "GAME" }),
    );
    expect(next.messages).toEqual([{ text: "Practice Bot casts Lightning Bolt", isTalk: false }]);
  });

  it("marks a real messageType: TALK CHATMESSAGE payload as talk (the bot's says-lines, or the player's own chat)", () => {
    const next = gameReducer(
      initialGameState,
      envelope("CHATMESSAGE", {
        username: "",
        message: 'Practice Bot says: "Not bad, for a human."',
        time: null,
        color: "BLACK",
        messageType: "TALK",
      }),
    );
    expect(next.messages).toEqual([{ text: 'Practice Bot says: "Not bad, for a human."', isTalk: true }]);
  });

  it("extracts .message from a real GameClientMessage-shaped GAME_INFORM_PERSONAL payload", () => {
    const next = gameReducer(
      initialGameState,
      envelope("GAME_INFORM_PERSONAL", { gameView: minimalGameView, options: null, message: "You can't do that right now." }),
    );
    expect(next.messages).toEqual([{ text: "You can't do that right now.", isTalk: false }]);
  });

  it("strips the engine's Swing-style HTML tags out of message text", () => {
    const next = gameReducer(initialGameState, envelope("CHATMESSAGE", "Mulligan <font color=#ffff00>down to 6 cards</font>?"));
    expect(next.messages).toEqual([{ text: "Mulligan down to 6 cards?", isTalk: false }]);
  });

  it("records the last error on GAME_ERROR and also surfaces it in the log, so an illegal move's reason is visible", () => {
    const next = gameReducer(initialGameState, envelope("GAME_ERROR", "That's not a legal target."));
    expect(next.lastError).toBe("That's not a legal target.");
    expect(next.messages).toEqual([{ text: "⚠ That's not a legal target.", isTalk: false }]);
  });

  it("does not add GATEWAY_ERROR (a gateway/join-flow failure, not an in-game rules error) to the log", () => {
    const next = gameReducer(initialGameState, envelope("GATEWAY_ERROR", "Could not join the table."));
    expect(next.lastError).toBe("Could not join the table.");
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

  it("extracts .message from a real GameClientMessage-shaped GAME_OVER payload", () => {
    const next = gameReducer(initialGameState, envelope("GAME_OVER", { gameView: minimalGameView, options: null, message: "carma has won" }));
    expect(next.gameOver).toBe("carma has won");
  });

  it("extracts .gameInfo from a real GameEndView-shaped END_GAME_INFO payload (it has no .message field)", () => {
    const next = gameReducer(initialGameState, envelope("END_GAME_INFO", { gameInfo: "You won the game on turn 5.", matchInfo: "You won the match!" }));
    expect(next.gameOver).toBe("You won the game on turn 5.");
  });

  it("stringifies a game-over payload with no recognizable text field", () => {
    const next = gameReducer(initialGameState, envelope("GAME_OVER", { winner: "Practice Bot" }));
    expect(next.gameOver).toBe(JSON.stringify({ winner: "Practice Bot" }));
  });

  it("resets fully back to the initial state", () => {
    const midGame = gameReducer(initialGameState, envelope("GAME_UPDATE", minimalGameView));
    const reset = gameReducer(midGame, { kind: "reset" });
    expect(reset).toEqual(initialGameState);
  });

  it("tracks GATEWAY_PROGRESS updates while joining", () => {
    const first = gameReducer(initialGameState, envelope("GATEWAY_PROGRESS", "Validating your deck…"));
    expect(first.joinProgress).toBe("Validating your deck…");

    const second = gameReducer(first, envelope("GATEWAY_PROGRESS", "Connecting to the game server…"));
    expect(second.joinProgress).toBe("Connecting to the game server…");
  });

  it("clears joinProgress once the game actually starts", () => {
    const withProgress = gameReducer(initialGameState, envelope("GATEWAY_PROGRESS", "Creating your table…"));
    const started = gameReducer(withProgress, envelope("GAME_INIT", minimalGameView));
    expect(started.joinProgress).toBeNull();
  });

  it("clears joinProgress on a gateway/game error", () => {
    const withProgress = gameReducer(initialGameState, envelope("GATEWAY_PROGRESS", "Seating you at the table…"));
    const failed = gameReducer(withProgress, envelope("GATEWAY_ERROR", "Could not join the table."));
    expect(failed.joinProgress).toBeNull();
  });
});
