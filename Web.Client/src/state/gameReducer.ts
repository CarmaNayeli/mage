import type { DialogPayload, GatewayEnvelope } from "../types/envelope";
import type { GameView } from "../types/gameView";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface GameState {
  connectionStatus: ConnectionStatus;
  game: GameView | null;
  /** The most recent dialog awaiting a response, if any - null means nothing to answer right now. */
  pendingDialog: { type: string; payload: DialogPayload } | null;
  messages: string[];
  lastError: string | null;
  /** Set once GAME_OVER/END_GAME_INFO arrives - null means the match is still in progress. */
  gameOver: string | null;
}

export const initialGameState: GameState = {
  connectionStatus: "idle",
  game: null,
  pendingDialog: null,
  messages: [],
  lastError: null,
  gameOver: null,
};

export type GameAction =
  | { kind: "connection-status"; status: ConnectionStatus }
  | { kind: "envelope"; envelope: GatewayEnvelope }
  | { kind: "dialog-answered" }
  | { kind: "reset" };

const DIALOG_TYPES = new Set([
  "GAME_TARGET",
  "GAME_CHOOSE_ABILITY",
  "GAME_CHOOSE_PILE",
  "GAME_CHOOSE_CHOICE",
  "GAME_ASK",
  "GAME_SELECT",
  "GAME_PLAY_MANA",
  "GAME_PLAY_XMANA",
  "GAME_GET_AMOUNT",
  "GAME_GET_MULTI_AMOUNT",
]);

const MESSAGE_TYPES = new Set(["CHATMESSAGE", "SHOW_USERMESSAGE", "SERVER_MESSAGE", "GAME_INFORM_PERSONAL"]);
const GAME_OVER_TYPES = new Set(["GAME_OVER", "END_GAME_INFO"]);
const ERROR_TYPES = new Set(["GAME_ERROR", "GATEWAY_ERROR"]);

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.kind) {
    case "connection-status":
      return { ...state, connectionStatus: action.status };

    case "dialog-answered":
      return { ...state, pendingDialog: null };

    case "reset":
      return initialGameState;

    case "envelope": {
      const { type, data } = action.envelope;

      // GAME_UPDATE/GAME_INIT's payload IS a bare GameView. GAME_UPDATE_AND_INFORM's
      // is NOT - it's a GameClientMessage wrapping one under `.gameView` (confirmed:
      // treating it as bare crashed the real client with "players is undefined",
      // since the wrapper has no top-level `players` field). START_GAME's payload
      // isn't a GameView at all - just table/game id metadata - so it must NOT be
      // adopted as game state (same crash risk if it arrived after a real GameView
      // and got treated as the current board).
      if (type === "GAME_UPDATE" || type === "GAME_INIT") {
        return { ...state, game: data as GameView };
      }
      if (type === "GAME_UPDATE_AND_INFORM") {
        const gameView = (data as { gameView?: GameView } | null)?.gameView;
        return gameView ? { ...state, game: gameView } : state;
      }

      if (DIALOG_TYPES.has(type)) {
        return { ...state, pendingDialog: { type, payload: data as DialogPayload } };
      }

      if (MESSAGE_TYPES.has(type)) {
        const text = typeof data === "string" ? data : JSON.stringify(data);
        return { ...state, messages: [...state.messages, text].slice(-100) };
      }

      if (ERROR_TYPES.has(type)) {
        return { ...state, lastError: typeof data === "string" ? data : JSON.stringify(data) };
      }

      if (GAME_OVER_TYPES.has(type)) {
        return { ...state, gameOver: typeof data === "string" ? data : JSON.stringify(data), pendingDialog: null };
      }

      // Unhandled callback type - keep state as-is rather than guessing at its shape.
      return state;
    }

    default:
      return state;
  }
}
