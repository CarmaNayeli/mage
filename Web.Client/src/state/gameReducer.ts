import type { AccountDeckContent, AccountDeckSummary, AccountLoggedIn, DialogPayload, GatewayEnvelope } from "../types/envelope";
import type { GameView } from "../types/gameView";
import { isAutoPassablePriority } from "../utils/autoPass";
import { extractMessageText, isBotFlavorLine, stripHtmlTags } from "../utils/text";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

/** One line in the game log. `isTalk` is true for an actual chat message: the
 * player's own replies carry a real `messageType: "TALK"` (ordinary play-by-play from
 * informPlayers is "GAME"/"STATUS"), but the bot's own flavor "says" lines are NOT
 * real chat - LLMBridgePlayer has no engine-level API to emit a properly TALK-tagged
 * broadcast (that only exists a layer up, in Mage.Server's chat plumbing), so it goes
 * out through informPlayers like any other narration and arrives tagged "GAME" too.
 * isBotFlavorLine's text-pattern check is what actually catches those. It's what
 * "Table Talk: On/Off" (App.tsx) filters on - play-by-play narration always stays,
 * only the talking is toggleable. */
export interface LogEntry {
  text: string;
  isTalk: boolean;
}

export interface GameState {
  connectionStatus: ConnectionStatus;
  game: GameView | null;
  /** The most recent dialog awaiting a response, if any - null means nothing to answer right now. */
  pendingDialog: { type: string; payload: DialogPayload } | null;
  messages: LogEntry[];
  lastError: string | null;
  /** Set once GAME_OVER/END_GAME_INFO arrives - null means the match is still in progress. */
  gameOver: string | null;
  /** The gateway's most recent "here's what I'm doing" update while joining a table -
   * null once a game actually starts (or before any join attempt). Without this the
   * join screen has nothing to show but a single static "Joining..." for the whole
   * duration, which reads as hung once a step takes more than a couple seconds (the
   * AI counter-deck generation step routinely does). */
  joinProgress: string | null;
  /** Set once logged into an account (register/login/login_with_token) - null means
   * playing as a guest. Survives "reset" (a Restart/Play Again/Reconnect shouldn't log
   * you out) - only an explicit "logout" clears it. */
  account: AccountLoggedIn | null;
  /** The logged-in account's saved decks (ACCOUNT_DECKS) - null before the first list
   * arrives (distinct from an empty array, "you have no saved decks"). Also survives
   * "reset" for the same reason `account` does. */
  accountDecks: AccountDeckSummary[] | null;
  /** The most recently loaded account deck (ACCOUNT_DECK) - transient, consumed once
   * by whatever triggered the load (App.tsx's ref bridge into DeckEntry) and otherwise
   * ignorable; cleared on "reset" since it's a one-shot signal, not real state. */
  loadedAccountDeck: AccountDeckContent | null;
  /** The most recent account-flow failure (bad password, duplicate username, no such
   * saved deck, ...) - deliberately separate from `lastError` (see ACCOUNT_ERROR's doc
   * comment in envelope.ts) so AccountModal has its own error source that a stale
   * connection error can't bleed into, and vice versa. Cleared on a successful login
   * and whenever the modal is (re)opened fresh. */
  accountError: string | null;
}

export const initialGameState: GameState = {
  connectionStatus: "idle",
  game: null,
  pendingDialog: null,
  messages: [],
  lastError: null,
  gameOver: null,
  joinProgress: null,
  account: null,
  accountDecks: null,
  loadedAccountDeck: null,
  accountError: null,
};

export type GameAction =
  | { kind: "connection-status"; status: ConnectionStatus }
  | { kind: "envelope"; envelope: GatewayEnvelope }
  | { kind: "dialog-answered" }
  | { kind: "account-deck-consumed" }
  | { kind: "account-error-cleared" }
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

    case "account-deck-consumed":
      return { ...state, loadedAccountDeck: null };

    case "account-error-cleared":
      return { ...state, accountError: null };

    case "reset":
      // Restart/Play Again/Reconnect all go through this - none of them should log the
      // player out of their account, so those fields ride through untouched.
      return { ...initialGameState, account: state.account, accountDecks: state.accountDecks };

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
        return { ...state, game: data as GameView, joinProgress: null };
      }
      if (type === "GAME_UPDATE_AND_INFORM") {
        const gameView = (data as { gameView?: GameView } | null)?.gameView;
        return gameView ? { ...state, game: gameView, joinProgress: null } : state;
      }

      if (type === "GATEWAY_PROGRESS") {
        return { ...state, joinProgress: typeof data === "string" ? data : JSON.stringify(data) };
      }

      if (DIALOG_TYPES.has(type)) {
        // Every dialog type except GAME_CHOOSE_ABILITY wraps a GameClientMessage that
        // carries a fresh gameView alongside the question (e.g. the mulligan ask fires
        // right after hands are dealt) - without adopting it here the board stays
        // frozen on whatever GAME_INIT/GAME_UPDATE last sent, showing 0 cards/an empty
        // hand under a "mulligan?" dialog even though the server already dealt one.
        const gameView = (data as { gameView?: GameView } | null)?.gameView;
        // A plain priority window with nothing legal but to pass isn't a real question -
        // useGatewayConnection already answers it automatically, so it should never
        // actually show as a dialog here either (a real question flashing on screen for
        // one render before auto-answering would be worse than not showing it at all).
        const autoPassed = isAutoPassablePriority(type, data as DialogPayload);
        return {
          ...state,
          game: gameView ?? state.game,
          pendingDialog: autoPassed ? null : { type, payload: data as DialogPayload },
        };
      }

      if (MESSAGE_TYPES.has(type)) {
        const text = stripHtmlTags(extractMessageText(data));
        const messageType = data && typeof data === "object" ? (data as { messageType?: string }).messageType : undefined;
        const entry: LogEntry = { text, isTalk: messageType === "TALK" || isBotFlavorLine(text) };
        return { ...state, messages: [...state.messages, entry].slice(-100) };
      }

      if (ERROR_TYPES.has(type)) {
        const text = stripHtmlTags(extractMessageText(data));
        // GAME_ERROR is how the server explains an illegal move (wrong phase, no
        // legal targets, can't afford it, etc.) - it used to only ever populate
        // lastError, which nothing showed once a game was underway (lastError only
        // ever reached the pre-game "couldn't connect" banner). Surfacing it in the
        // log too means "why didn't that work" actually gets answered in-game.
        return {
          ...state,
          lastError: text,
          messages: type === "GAME_ERROR" ? [...state.messages, { text: `⚠ ${text}`, isTalk: false }].slice(-100) : state.messages,
          joinProgress: null,
        };
      }

      if (GAME_OVER_TYPES.has(type)) {
        return { ...state, gameOver: stripHtmlTags(extractMessageText(data)), pendingDialog: null };
      }

      if (type === "ACCOUNT_LOGGED_IN") {
        return { ...state, account: data as AccountLoggedIn, lastError: null, accountError: null };
      }
      if (type === "ACCOUNT_LOGGED_OUT") {
        return { ...state, account: null, accountDecks: null };
      }
      if (type === "ACCOUNT_DECKS") {
        return { ...state, accountDecks: data as AccountDeckSummary[] };
      }
      if (type === "ACCOUNT_DECK") {
        return { ...state, loadedAccountDeck: data as AccountDeckContent };
      }
      if (type === "ACCOUNT_SETTINGS") {
        return state.account ? { ...state, account: { ...state.account, settings: data as AccountLoggedIn["settings"] } } : state;
      }
      if (type === "ACCOUNT_ERROR") {
        return { ...state, accountError: typeof data === "string" ? data : String(data) };
      }

      // Unhandled callback type - keep state as-is rather than guessing at its shape.
      return state;
    }

    default:
      return state;
  }
}
