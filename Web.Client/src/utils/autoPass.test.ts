import { describe, expect, it } from "vitest";
import { isAutoPassablePriority } from "./autoPass";

describe("isAutoPassablePriority", () => {
  it("is false for non-GAME_SELECT dialogs", () => {
    expect(isAutoPassablePriority("GAME_ASK", { message: "Mulligan?" })).toBe(false);
  });

  it("is true for a plain priority window with an empty canPlayObjects", () => {
    expect(
      isAutoPassablePriority("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: {} } },
        message: "Play spells and abilities",
      } as never),
    ).toBe(true);
  });

  it("is true when canPlayObjects itself is missing/null", () => {
    expect(isAutoPassablePriority("GAME_SELECT", { message: "Play spells and abilities" })).toBe(true);
  });

  it("is false when something is actually playable", () => {
    expect(
      isAutoPassablePriority("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: { "card-1": {} } } },
        message: "Play spells and abilities",
      } as never),
    ).toBe(false);
  });

  it("is false for a combat selection (declaring 0 attackers/blockers is still a real confirmation)", () => {
    expect(
      isAutoPassablePriority("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: {} } },
        message: "Select attackers",
        options: { possibleAttackers: [] },
      } as never),
    ).toBe(false);
  });
});
