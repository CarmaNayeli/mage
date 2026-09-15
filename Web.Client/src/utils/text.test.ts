import { describe, expect, it } from "vitest";
import { extractMessageText, isBotFlavorLine, stripHtmlTags } from "./text";

describe("stripHtmlTags", () => {
  it("removes tags while keeping the text", () => {
    expect(stripHtmlTags("Mulligan <font color=#ffff00>down to 6 cards</font>?")).toBe("Mulligan down to 6 cards?");
  });

  it("leaves plain text untouched", () => {
    expect(stripHtmlTags("no tags here")).toBe("no tags here");
  });
});

describe("extractMessageText", () => {
  it("passes bare strings through (GAME_ERROR's real shape)", () => {
    expect(extractMessageText("That's not a legal target.")).toBe("That's not a legal target.");
  });

  it("extracts .message from a ChatMessage-shaped payload with no username (the game's own log)", () => {
    expect(extractMessageText({ username: "", message: "Practice Bot casts Lightning Bolt" })).toBe("Practice Bot casts Lightning Bolt");
  });

  it("prefixes with the username when one is present (an actual chat message, not a log line)", () => {
    expect(extractMessageText({ username: "carma", message: "gg" })).toBe("carma: gg");
  });

  it("extracts .message from a GameClientMessage-shaped payload (GAME_INFORM_PERSONAL/GAME_OVER)", () => {
    expect(extractMessageText({ gameView: {}, options: null, message: "carma has won" })).toBe("carma has won");
  });

  it("extracts .gameInfo from a GameEndView-shaped payload (END_GAME_INFO - no .message field)", () => {
    expect(extractMessageText({ gameInfo: "You won the game on turn 5.", matchInfo: "You won the match!" })).toBe(
      "You won the game on turn 5.",
    );
  });

  it("falls back to JSON for anything unrecognized", () => {
    expect(extractMessageText({ winner: "Practice Bot" })).toBe(JSON.stringify({ winner: "Practice Bot" }));
  });
});

describe("isBotFlavorLine", () => {
  it("matches the bot's real 'says' construction (LLMBridgePlayer.java)", () => {
    expect(isBotFlavorLine('Practice Bot says: "Two lands on turn five. Time to go digging."')).toBe(true);
  });

  it("does not match ordinary play-by-play narration", () => {
    expect(isBotFlavorLine("Practice Bot casts Lightning Bolt")).toBe(false);
    expect(isBotFlavorLine("Forest was destroyed by Beast Within")).toBe(false);
  });
});
