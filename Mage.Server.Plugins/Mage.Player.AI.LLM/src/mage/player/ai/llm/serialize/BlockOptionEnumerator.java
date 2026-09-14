package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.constants.CardType;
import mage.game.Game;
import mage.game.combat.CombatGroup;
import mage.game.permanent.Permanent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Design principle 2 for the declare_blockers decision: one option per (your creature,
 * attacker aimed at you) pair that {@link Permanent#canBlock} allows - menace,
 * "can't be blocked except by two or more creatures", flying/reach, already-blocked
 * state, all handled by the engine.
 * <p>
 * Only combat groups defending you are considered - an attacker aimed at a different
 * opponent in a multiplayer game isn't yours to block.
 * <p>
 * {@link #enumerate} and {@link #resolve} both build from {@link #pairs}, so a
 * response's selected index always maps back to the exact pair that produced that
 * JSON entry.
 * <p>
 * Same known gap as AttackOptionEnumerator: nothing here enforces the "one creature
 * can't block two attackers" or "an attacker can't be double-counted" constraints
 * between options - see {@link OptionSelectionValidator}.
 *
 * @author CarmaNayeli
 */
public final class BlockOptionEnumerator {

    private BlockOptionEnumerator() {
    }

    public static final class Pair {
        public final UUID blockerId;
        public final UUID attackerId;

        private Pair(UUID blockerId, UUID attackerId) {
            this.blockerId = blockerId;
            this.attackerId = attackerId;
        }
    }

    public static JsonArray enumerate(Game game, UUID defendingPlayerId) {
        JsonArray options = new JsonArray();
        int index = 0;
        for (Pair pair : pairs(game, defendingPlayerId)) {
            Permanent attacker = game.getPermanent(pair.attackerId);
            Permanent blocker = game.getPermanent(pair.blockerId);
            JsonObject option = new JsonObject();
            option.addProperty("index", index++);
            option.addProperty("label", String.format("Block %s (%d/%d) with %s (%d/%d)",
                    attacker.getName(), attacker.getPower().getValue(), attacker.getToughness().getValue(),
                    blocker.getName(), blocker.getPower().getValue(), blocker.getToughness().getValue()));
            option.addProperty("action", "block");
            option.addProperty("source", Ids.permanentId(blocker.getId()));
            option.addProperty("target", Ids.permanentId(attacker.getId()));
            options.add(option);
        }
        return options;
    }

    /**
     * The pair a previously-enumerated option's index refers to, or {@code null} if
     * the index is out of range.
     */
    public static Pair resolve(Game game, UUID defendingPlayerId, int index) {
        List<Pair> pairs = pairs(game, defendingPlayerId);
        return (index >= 0 && index < pairs.size()) ? pairs.get(index) : null;
    }

    private static List<Pair> pairs(Game game, UUID defendingPlayerId) {
        List<Pair> pairs = new ArrayList<>();
        for (CombatGroup group : game.getCombat().getGroups()) {
            if (!defendingPlayerId.equals(group.getDefendingPlayerId())) {
                continue;
            }
            for (UUID attackerId : group.getAttackers()) {
                Permanent attacker = game.getPermanent(attackerId);
                if (attacker == null) {
                    continue;
                }
                for (Permanent blocker : game.getBattlefield().getAllActivePermanents(defendingPlayerId)) {
                    if (!blocker.getCardType(game).contains(CardType.CREATURE)
                            || !blocker.canBlock(attackerId, game)) {
                        continue;
                    }
                    pairs.add(new Pair(blocker.getId(), attackerId));
                }
            }
        }
        return pairs;
    }
}
