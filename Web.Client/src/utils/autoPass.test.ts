import { describe, expect, it } from "vitest";
import { getAutoPassResponse } from "./autoPass";

describe("getAutoPassResponse", () => {
  it("is null (a real question) for non-GAME_SELECT dialogs", () => {
    expect(getAutoPassResponse("GAME_ASK", { message: "Mulligan?" })).toBeNull();
  });

  it("answers false for a plain priority window with an empty canPlayObjects", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: {} } },
        message: "Play spells and abilities",
      } as never),
    ).toBe(false);
  });

  it("answers false when canPlayObjects itself is missing/null", () => {
    expect(getAutoPassResponse("GAME_SELECT", { message: "Play spells and abilities" })).toBe(false);
  });

  it("is null (a real question) when something is actually playable", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: { "card-1": {} } } },
        message: "Play spells and abilities",
      } as never),
    ).toBeNull();
  });

  it("answers true (Done, nothing declared) for a combat selection with zero legal attackers/blockers", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: {} } },
        message: "Select attackers",
        options: { possibleAttackers: [] },
      } as never),
    ).toBe(true);
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: {} } },
        message: "Select blockers",
        options: { possibleBlockers: [] },
      } as never),
    ).toBe(true);
  });

  it("is null (a real question) for a combat selection with at least one legal attacker/blocker", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: { canPlayObjects: { objects: {} } },
        message: "Select attackers",
        options: { possibleAttackers: ["creature-1"] },
      } as never),
    ).toBeNull();
  });
});
