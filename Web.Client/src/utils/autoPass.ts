import type { DialogPayload, GameClientMessage } from "../types/envelope";
import type { GameView } from "../types/gameView";
import { getCombatSelection } from "./combat";

/**
 * True for a plain priority window (GAME_SELECT, no combat selection - see
 * utils/combat.ts) where the embedded gameView's canPlayObjects is empty, i.e. there is
 * genuinely nothing legal to do but pass. The server always asks - a human always gets
 * priority, even with nothing to do, same as a real paper game - but there's no reason
 * to make the player click "Next Phase / Pass Turn" by hand every single time that's
 * the only possible answer, any more than a real client would.
 * <p>
 * Deliberately narrow: combat selection (declaring 0 attackers/blockers is still a real
 * confirmation, not a no-op) and every other dialog type (GAME_ASK, GAME_TARGET, a
 * mana payment, ...) always still show, since those are real questions even when the
 * "safe" answer is normally correct.
 */
export function isAutoPassablePriority(type: string, payload: DialogPayload): boolean {
  if (type !== "GAME_SELECT") {
    return false;
  }
  if (getCombatSelection({ type, payload })) {
    return false;
  }
  const gameView = (payload as GameClientMessage).gameView as GameView | undefined;
  const playable = gameView?.canPlayObjects?.objects;
  return !playable || Object.keys(playable).length === 0;
}
