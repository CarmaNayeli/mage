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

      if (type === "GAME_UPDATE" || type === "GAME_UPDATE_AND_INFORM" || type === "GAME_INIT" || type === "START_GAME") {
        return { ...state, game: data as GameView };
      }

      if (DIALOG_TYPES.has(type)) {
        return { ...state, pendingDialog: { type, payload: data as DialogPayload } };
      }

      if (MESSAGE_TYPES.has(type)) {
        const text = typeof data === "string" ? data : JSON.stringify(data);
        return { ...state, messages: [...state.messages, text].slice(-100) };
      }

      if (type === "GAME_ERROR") {
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
