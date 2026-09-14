package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.constants.CardType;
import mage.game.Game;
import mage.game.permanent.Permanent;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Design principle 2 (engine enumerates, model selects) for the declare_attackers
 * decision: one option per (your creature, legal defender) pair, using
 * {@link Permanent#canAttack} to do the legality work - multiplayer attack option
 * (LEFT/RIGHT/MULTIPLE), summoning sickness, tapped state, "can't attack" effects,
 * all handled by the engine rather than re-derived here.
 * <p>
 * {@link #enumerate} and {@link #resolve} both build from {@link #pairs}, so a
 * response's selected index always maps back to the exact pair that produced that
 * JSON entry - no re-deriving the same iteration twice and hoping it stays in sync.
 * <p>
 * Known gap: nothing here stops a caller from selecting two options that share the
 * same creature as "source" (attack seat 2 AND seat 3 with the same permanent), which
 * isn't legal - see {@link OptionSelectionValidator}.
 *
 * @author CarmaNayeli
 */
public final class AttackOptionEnumerator {

    private AttackOptionEnumerator() {
    }

    public static final class Pair {
        public final UUID attackerId;
        public final UUID defenderId;

        private Pair(UUID attackerId, UUID defenderId) {
            this.attackerId = attackerId;
            this.defenderId = defenderId;
        }
    }

    public static JsonArray enumerate(Game game, UUID attackingPlayerId, Map<UUID, Integer> seats) {
        JsonArray options = new JsonArray();
        int index = 0;
        for (Pair pair : pairs(game, attackingPlayerId, seats)) {
            Permanent permanent = game.getPermanent(pair.attackerId);
            JsonObject option = new JsonObject();
            option.addProperty("index", index++);
            option.addProperty("label", String.format("Attack seat %d with %s (%d/%d)",
                    seats.get(pair.defenderId), permanent.getName(),
                    permanent.getPower().getValue(), permanent.getToughness().getValue()));
            option.addProperty("action", "attack");
            option.addProperty("source", Ids.permanentId(permanent.getId()));
            option.addProperty("target_seat", seats.get(pair.defenderId));
            options.add(option);
        }
        return options;
    }

    /**
     * The pair a previously-enumerated option's index refers to, or {@code null} if
     * the index is out of range (e.g. a hallucinated index from a malformed response).
     */
    public static Pair resolve(Game game, UUID attackingPlayerId, Map<UUID, Integer> seats, int index) {
        List<Pair> pairs = pairs(game, attackingPlayerId, seats);
        return (index >= 0 && index < pairs.size()) ? pairs.get(index) : null;
    }

    private static List<Pair> pairs(Game game, UUID attackingPlayerId, Map<UUID, Integer> seats) {
        List<Pair> pairs = new ArrayList<>();
        for (Permanent permanent : game.getBattlefield().getAllActivePermanents(attackingPlayerId)) {
            if (!permanent.getCardType(game).contains(CardType.CREATURE)) {
                continue;
            }
            for (Map.Entry<UUID, Integer> seatEntry : seats.entrySet()) {
                UUID defenderId = seatEntry.getKey();
                if (defenderId.equals(attackingPlayerId) || !permanent.canAttack(defenderId, game)) {
                    continue;
                }
                pairs.add(new Pair(permanent.getId(), defenderId));
            }
        }
        return pairs;
    }
}
