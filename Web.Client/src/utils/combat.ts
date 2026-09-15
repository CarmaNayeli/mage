import type { DialogPayload, GameClientMessage } from "../types/envelope";

/**
 * HumanPlayer.selectAttackers/selectBlockers (Mage.Player.Human) fire a GAME_SELECT
 * whose `options` map carries `possibleAttackers`/`possibleBlockers` (real string keys -
 * see mage.constants.Constants.Option) - a list of the human's OWN permanent ids that
 * are legal to click to toggle as an attacker/blocker, plus an optional `specialButton`
 * ("All attack") string. Nothing else in the payload identifies this as a combat
 * selection vs. an ordinary priority window - both are GAME_SELECT with the same shape,
 * just an empty/absent options map for plain priority.
 */
export interface CombatSelection {
  kind: "attackers" | "blockers";
  ids: Set<string>;
  allAttackButton: string | null;
}

export function getCombatSelection(dialog: { type: string; payload: DialogPayload } | null): CombatSelection | null {
  if (!dialog || dialog.type !== "GAME_SELECT") {
    return null;
  }
  const options = (dialog.payload as GameClientMessage).options as Record<string, unknown> | undefined;
  if (!options) {
    return null;
  }
  const attackers = options.possibleAttackers;
  if (Array.isArray(attackers)) {
    const allAttackButton = typeof options.specialButton === "string" ? options.specialButton : null;
    return { kind: "attackers", ids: new Set(attackers as string[]), allAttackButton };
  }
  const blockers = options.possibleBlockers;
  if (Array.isArray(blockers)) {
    return { kind: "blockers", ids: new Set(blockers as string[]), allAttackButton: null };
  }
  return null;
}
