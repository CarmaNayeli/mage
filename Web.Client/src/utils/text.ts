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
