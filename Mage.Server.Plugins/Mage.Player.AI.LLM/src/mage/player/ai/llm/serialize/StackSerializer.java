package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Ability;
import mage.game.Game;
import mage.game.stack.Spell;
import mage.game.stack.StackObject;
import mage.target.Target;

import java.util.UUID;

/**
 * Serializer for the stack. Gotcha from xmage-llm-bridge-design.md: include the full
 * stack with source and targets, and don't let the model forget that passing is
 * usually correct - it's untrained-by-default to respond to everything.
 *
 * @author CarmaNayeli
 */
public final class StackSerializer {

    private StackSerializer() {
    }

    public static JsonArray serialize(Game game) {
        JsonArray stack = new JsonArray();
        for (StackObject stackObject : game.getStack()) {
            JsonObject obj = new JsonObject();
            obj.addProperty("name", stackObject.getName());

            String controllerName = game.getPlayer(stackObject.getControllerId()) != null
                    ? game.getPlayer(stackObject.getControllerId()).getName()
                    : "unknown";
            obj.addProperty("controller", controllerName);

            Ability ability = (stackObject instanceof Spell)
                    ? ((Spell) stackObject).getStackAbility()
                    : (Ability) stackObject;

            JsonArray targets = new JsonArray();
            for (Target target : ability.getTargets()) {
                for (UUID targetId : target.getTargets()) {
                    targets.add(Describe.name(targetId, game));
                }
            }
            if (targets.size() > 0) {
                obj.add("targets", targets);
            }

            stack.add(obj);
        }
        return stack;
    }
}
