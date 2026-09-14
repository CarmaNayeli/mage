package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.constants.CardType;
import mage.game.Game;
import mage.game.permanent.Permanent;

import java.util.Map;
import java.util.UUID;

/**
 * Design principle 2 (engine enumerates, model selects) for the declare_attackers
 * decision: one option per (your creature, legal defender) pair, using
 * {@link Permanent#canAttack} to do the legality work - multiplayer attack option
 * (LEFT/RIGHT/MULTIPLE), summoning sickness, tapped state, "can't attack" effects,
 * all handled by the engine rather than re-derived here.
 * <p>
 * Known gap: nothing here stops a caller from selecting two options that share the
 * same creature as "source" (attack seat 2 AND seat 3 with the same permanent), which
 * isn't legal. Proper mutual-exclusion modeling between options is a step beyond the
 * "just the JSON contract" scope of this pass - flagged rather than solved.
 *
 * @author CarmaNayeli
 */
public final class AttackOptionEnumerator {

    private AttackOptionEnumerator() {
    }

    public static JsonArray enumerate(Game game, UUID attackingPlayerId, Map<UUID, Integer> seats) {
        JsonArray options = new JsonArray();
        int index = 0;

        for (Permanent permanent : game.getBattlefield().getAllActivePermanents(attackingPlayerId)) {
            if (!permanent.getCardType(game).contains(CardType.CREATURE)) {
                continue;
            }
            for (Map.Entry<UUID, Integer> seatEntry : seats.entrySet()) {
                UUID defenderId = seatEntry.getKey();
                if (defenderId.equals(attackingPlayerId) || !permanent.canAttack(defenderId, game)) {
                    continue;
                }

                JsonObject option = new JsonObject();
                option.addProperty("index", index++);
                option.addProperty("label", String.format("Attack seat %d with %s (%d/%d)",
                        seatEntry.getValue(), permanent.getName(),
                        permanent.getPower().getValue(), permanent.getToughness().getValue()));
                option.addProperty("action", "attack");
                option.addProperty("source", Ids.permanentId(permanent.getId()));
                option.addProperty("target_seat", seatEntry.getValue());
                options.add(option);
            }
        }

        return options;
    }
}
