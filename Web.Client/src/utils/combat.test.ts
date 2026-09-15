import { describe, expect, it } from "vitest";
import { getCombatSelection } from "./combat";

describe("getCombatSelection", () => {
  it("returns null for a non-GAME_SELECT dialog", () => {
    expect(getCombatSelection({ type: "GAME_ASK", payload: { message: "Mulligan?" } })).toBeNull();
  });

  it("returns null for a plain priority GAME_SELECT (no options)", () => {
    expect(getCombatSelection({ type: "GAME_SELECT", payload: { message: "Play spells and abilities" } })).toBeNull();
  });

  it("returns an attackers selection when options.possibleAttackers is present", () => {
    const result = getCombatSelection({
      type: "GAME_SELECT",
      payload: { message: "Select attackers", options: { possibleAttackers: ["c1", "c2"], specialButton: "All attack" } },
    });
    expect(result).toEqual({ kind: "attackers", ids: new Set(["c1", "c2"]), allAttackButton: "All attack" });
  });

  it("returns a blockers selection when options.possibleBlockers is present, with no all-attack button", () => {
    const result = getCombatSelection({
      type: "GAME_SELECT",
      payload: { message: "Select blockers", options: { possibleBlockers: ["c3"] } },
    });
    expect(result).toEqual({ kind: "blockers", ids: new Set(["c3"]), allAttackButton: null });
  });

  it("returns null for GAME_CHOOSE_ABILITY's differently-shaped payload", () => {
    expect(getCombatSelection({ type: "GAME_CHOOSE_ABILITY", payload: { choices: { a1: "Cast" } } })).toBeNull();
  });
});
