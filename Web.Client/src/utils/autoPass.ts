import type { DialogPayload, GameClientMessage } from "../types/envelope";
import type { GameView, PlayableObjectStats } from "../types/gameView";
import { getCombatSelection } from "./combat";

/**
 * canPlayObjects lists a "tap this land for mana" entry (basicManaAbilities) for
 * every untapped mana source regardless of whether there's anything to actually
 * spend that mana on - so its mere presence doesn't mean there's a real decision to
 * make (confirmed against a real payload: a priority window with nothing castable in
 * hand still listed every untapped land, tap-only, and used to block auto-pass
 * entirely). Only basicPlayAbilities/basicCastAbilities/other - a land/permanent/card
 * with something to actually cast, play, or activate beyond making mana - count as a
 * real option. A genuinely castable spell still shows up fine under its OWN id here,
 * regardless of whether paying for it needs tapping a land first.
 */
function hasRealAction(playable: Record<string, PlayableObjectStats> | null | undefined): boolean {
  if (!playable) return false;
  return Object.values(playable).some(
    (stats) => (stats.basicPlayAbilities?.length ?? 0) > 0 || (stats.basicCastAbilities?.length ?? 0) > 0 || (stats.other?.length ?? 0) > 0,
  );
}

/**
 * `true`/`false` here is the actual `send_boolean` response to fire automatically -
 * `null` means this is a real question and must actually be shown.
 * <p>
 * Two cases are auto-answerable:
 * - A plain priority window (GAME_SELECT, no combat selection) with no real action
 *   available (see hasRealAction) - there's genuinely nothing legal to do but pass.
 *   The server always asks (a human always gets priority, even with nothing to do,
 *   same as a real paper game), but there's no reason to make the player click "Next
 *   Phase / Pass Turn" by hand every time that's the only possible answer. Answers
 *   `false` (send_boolean's real "pass" value here).
 * - A declare-attackers/blockers prompt with zero legal attackers/blockers at all -
 *   "Done" with nothing declared is the only possible answer (there's nothing to
 *   toggle), so this isn't a real decision either, unlike a combat selection that
 *   actually has options to pick from. Answers `true` (send_boolean's "Done" value).
 */
export function getAutoPassResponse(type: string, payload: DialogPayload): boolean | null {
  if (type !== "GAME_SELECT") {
    return null;
  }
  const combatSelection = getCombatSelection({ type, payload });
  if (combatSelection) {
    return combatSelection.ids.size === 0 ? true : null;
  }
  const gameView = (payload as GameClientMessage).gameView as GameView | undefined;
  return hasRealAction(gameView?.canPlayObjects?.objects) ? null : false;
}
