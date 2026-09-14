package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Ability;
import mage.game.Game;
import mage.target.Target;

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
 *
 * @author CarmaNayeli
 */
public final class ChooseTargetOptionEnumerator {

    private ChooseTargetOptionEnumerator() {
    }

    public static JsonArray enumerate(Game game, UUID controllerId, Ability source, Target target) {
        JsonArray options = new JsonArray();
        int index = 0;
        for (UUID candidateId : target.possibleTargets(controllerId, source, game)) {
            JsonObject option = new JsonObject();
            option.addProperty("index", index++);
            option.addProperty("label", Describe.name(candidateId, game));
            option.addProperty("action", "choose_target");
            option.addProperty("target", Ids.permanentId(candidateId));
            options.add(option);
        }
        return options;
    }
}
