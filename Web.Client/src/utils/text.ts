/**
 * The Java engine's built-in strings (mulligan prompts, combat messages, etc.) use
 * Swing-style HTML like `<font color=#ffff00>down to 6 cards</font>` since the desktop
 * client renders them in a JLabel. The web client has nowhere safe to render that as
 * HTML (these strings aren't guaranteed free of user-influenced content, e.g. card/
 * player names), so just strip tags and show plain text.
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Several ClientCallback payloads that reach the message log are NOT bare strings -
 * confirmed against the real Java source, not guessed:
 * - CHATMESSAGE/SERVER_MESSAGE/SHOW_USERMESSAGE wrap `mage.view.ChatMessage`, which has
 *   a `.message` field (GameSessionWatcher/ChatSession/MageServerImpl all construct one).
 * - GAME_INFORM_PERSONAL and GAME_OVER wrap `mage.view.GameClientMessage`, which also
 *   has a `.message` field (GameSessionWatcher.informPersonal/gameOver).
 * - END_GAME_INFO wraps `mage.view.GameEndView`, which has no `.message` field at all -
 *   its `.gameInfo` is the equivalent ("You won the game on turn 5.").
 * GAME_ERROR is the one type that really is a bare string. Falls back to JSON if none
 * of these shapes match, rather than silently swallowing an unrecognized payload.
 */
/**
 * The bot's own flavor lines (LLMBridgePlayer.java: `this.getName() + " says: \"" +
 * response.say() + "\""`) go out through `game.informPlayers(...)` - the engine's
 * ordinary narration channel, tagged messageType "GAME" like any other play-by-play
 * line, NOT the real chat "TALK" channel a human's typed message uses (there's no
 * engine-level API for a Player to emit a properly TALK-tagged broadcast; that lives
 * in Mage.Server's chat plumbing, a layer up from where a Player object can reach).
 * Relying on messageType alone left "Table Talk: Off" unable to hide these at all -
 * this pattern is distinctive enough (only this one code path ever produces it) to
 * catch them by content instead, on top of the real messageType check.
 */
export function isBotFlavorLine(text: string): boolean {
  return / says: "/.test(text);
}

export function extractMessageText(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string") {
      // ChatMessage's `username` is empty for the game's own log lines (informPlayers
      // passes "" - see GameController's INFO/STATUS cases) but real for an actual
      // chat message (ours or - in a future multiplayer table - someone else's), so
      // prefixing only when it's non-empty tells them apart without a separate type.
      const username = typeof obj.username === "string" ? obj.username : "";
      return username ? `${username}: ${obj.message}` : obj.message;
    }
    if (typeof obj.gameInfo === "string") return obj.gameInfo;
  }
  return JSON.stringify(data);
}
