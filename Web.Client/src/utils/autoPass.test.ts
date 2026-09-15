import { describe, expect, it } from "vitest";
import { getAutoPassResponse } from "./autoPass";

const ability = { id: "ability-1", value: "Cast for 3 mana" };

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

  it("answers false when the only 'playable' entries are tap-a-land-for-mana - not a real decision with nothing to spend it on", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: {
          canPlayObjects: {
            objects: {
              "land-1": { basicManaAbilities: [ability], basicPlayAbilities: [], basicCastAbilities: [], other: [] },
              "land-2": { basicManaAbilities: [ability], basicPlayAbilities: [], basicCastAbilities: [], other: [] },
            },
          },
        },
        message: "Play spells and abilities",
      } as never),
    ).toBe(false);
  });

  it("is null (a real question) when something is actually castable, even alongside tap-for-mana lands", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: {
          canPlayObjects: {
            objects: {
              "land-1": { basicManaAbilities: [ability], basicPlayAbilities: [], basicCastAbilities: [], other: [] },
              "card-1": { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [ability], other: [] },
            },
          },
        },
        message: "Play spells and abilities",
      } as never),
    ).toBeNull();
  });

  it("is null (a real question) for a playable/activatable permanent (basicPlayAbilities/other)", () => {
    expect(
      getAutoPassResponse("GAME_SELECT", {
        gameView: {
          canPlayObjects: {
            objects: { "card-1": { basicManaAbilities: [], basicPlayAbilities: [ability], basicCastAbilities: [], other: [] } },
          },
        },
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
