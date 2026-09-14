package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Ability;
import mage.game.Game;
import mage.target.Target;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Design principle 2 for chooseTarget: one option per legal target, straight off
 * {@link Target#possibleTargets} - the same legality check XMage itself uses, so
 * hexproof/protection/shroud/"can't be the target of" are all handled already.
 * <p>
 * Deliberately generic across every card, unlike the priority/attack/block
 * enumerators: chooseTarget is called mid-resolution of a specific ability with its
 * Target object already built by that ability's own targeting rules, so this doesn't
 * need to know anything about what spell or ability is asking.
 * <p>
 * {@link #enumerate} and {@link #resolve} both index into {@link #candidates}, so a
 * response's selected index always maps back to the exact id that produced that JSON
 * entry, rather than each re-querying {@link Target#possibleTargets} independently.
 *
 * @author CarmaNayeli
 */
public final class ChooseTargetOptionEnumerator {

    private ChooseTargetOptionEnumerator() {
    }

    public static JsonArray enumerate(Game game, UUID controllerId, Ability source, Target target) {
        JsonArray options = new JsonArray();
        int index = 0;
        for (UUID candidateId : candidates(game, controllerId, source, target)) {
            JsonObject option = new JsonObject();
            option.addProperty("index", index++);
            option.addProperty("label", Describe.name(candidateId, game));
            option.addProperty("action", "choose_target");
            option.addProperty("target", Ids.permanentId(candidateId));
            options.add(option);
        }
        return options;
    }

    /**
     * The candidate id a previously-enumerated option's index refers to, or
     * {@code null} if the index is out of range.
     */
    public static UUID resolve(Game game, UUID controllerId, Ability source, Target target, int index) {
        List<UUID> candidates = candidates(game, controllerId, source, target);
        return (index >= 0 && index < candidates.size()) ? candidates.get(index) : null;
    }

    private static List<UUID> candidates(Game game, UUID controllerId, Ability source, Target target) {
        return new ArrayList<>(target.possibleTargets(controllerId, source, game));
    }
}
