/**
 * The WebSocket message shape, matching mage.web.gateway.ClientCallbackTranslator on
 * the Java side: every server push becomes `{ type, objectId, data }`, where `type`
 * is the name() of a mage.interfaces.callback.ClientCallbackMethod enum constant and
 * `data` is whatever payload that method carries (a GameView, a String, a list of
 * choices, etc. - shape depends on `type`).
 *
 * This file is intentionally not exhaustive over every ClientCallbackMethod - only
 * the ones the client actually needs to render something for. Unlisted types still
 * arrive and match the `GatewayEnvelope` fallback case; see gameReducer.ts.
 */

export type ClientCallbackType = "message" | "table_change" | "update" | "dialog" | "client_side_event";

/** The ~35 push types the server can send - see ClientCallbackMethod.java for the full list. */
export type ClientCallbackMethodName =
  | "CHATMESSAGE"
  | "SHOW_USERMESSAGE"
  | "SERVER_MESSAGE"
  | "JOINED_TABLE"
  | "START_GAME"
  | "GAME_INIT"
  | "GAME_UPDATE_AND_INFORM"
  | "GAME_INFORM_PERSONAL"
  | "GAME_ERROR"
  | "GAME_UPDATE"
  | "GAME_TARGET"
  | "GAME_CHOOSE_ABILITY"
  | "GAME_CHOOSE_PILE"
  | "GAME_CHOOSE_CHOICE"
  | "GAME_ASK"
  | "GAME_SELECT"
  | "GAME_PLAY_MANA"
  | "GAME_PLAY_XMANA"
  | "GAME_GET_AMOUNT"
  | "GAME_GET_MULTI_AMOUNT"
  | "GAME_OVER"
  | "END_GAME_INFO"
  | "USER_REQUEST_DIALOG"
  | "GAME_REDRAW_GUI";

export interface GatewayEnvelope<T = unknown> {
  type: ClientCallbackMethodName | string;
  objectId: string | null;
  data: T;
  /** Present only if ClientCallbackTranslator failed to serialize `data` for this callback. */
  serializationError?: string;
}

/**
 * The five dialog-shaped callbacks (GAME_TARGET, GAME_CHOOSE_ABILITY, GAME_ASK,
 * GAME_SELECT, GAME_CHOOSE_CHOICE, GAME_PLAY_MANA, GAME_GET_AMOUNT, ...) all follow
 * the same "engine enumerates, human picks" pattern as the LLM bridge - render the
 * options, send back an index/id. Exact payload shape TBD against a real dump; this
 * is the minimal shape every dialog needs regardless of specifics.
 */
export interface DialogPayload {
  message?: string;
  options?: Array<{ index: number; label: string; [key: string]: unknown }>;
  [key: string]: unknown;
}
