import type { DialogPayload, GameClientMessage } from "../types/envelope";
import type { GameView } from "../types/gameView";
import { getCombatSelection } from "./combat";

/**
 * `true`/`false` here is the actual `send_boolean` response to fire automatically -
 * `null` means this is a real question and must actually be shown.
 * <p>
 * Two cases are auto-answerable:
 * - A plain priority window (GAME_SELECT, no combat selection) whose embedded
 *   gameView's canPlayObjects is empty - there's genuinely nothing legal to do but
 *   pass. The server always asks (a human always gets priority, even with nothing to
 *   do, same as a real paper game), but there's no reason to make the player click
 *   "Next Phase / Pass Turn" by hand every time that's the only possible answer.
 *   Answers `false` (send_boolean's real "pass" value here).
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
  const playable = gameView?.canPlayObjects?.objects;
  const nothingPlayable = !playable || Object.keys(playable).length === 0;
  return nothingPlayable ? false : null;
}
