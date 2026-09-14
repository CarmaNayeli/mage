package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Ability;
import mage.abilities.ActivatedAbility;
import mage.constants.AbilityType;
import mage.game.Game;
import mage.players.Player;
import mage.target.Target;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Design principle 2: the engine enumerates, the model selects. This builds the
 * {@code decision.options} list for a priority decision straight off
 * {@link Player#getPlayable}, the same list ComputerPlayer itself scores internally -
 * so an illegal play is structurally impossible and there's no validator to write.
 * <p>
 * Mana abilities are filtered out on purpose: the escalation policy in the design doc
 * puts mana payment and land tapping on the free/ComputerPlayer side of the line, so
 * they never belong in a decision the model is asked to make.
 * <p>
 * "Pass" is always appended as the last option and is the majority-correct answer -
 * the design doc's own warning is that an untrained bridge will respond to everything
 * if given the chance.
 *
 * @author CarmaNayeli
 */
public final class PriorityOptionEnumerator {

    private PriorityOptionEnumerator() {
    }

    public static JsonArray enumerate(Player player, Game game, Map<UUID, Integer> seats) {
        JsonArray options = new JsonArray();
        List<ActivatedAbility> playable = player.getPlayable(game, true);

        int index = 0;
        for (ActivatedAbility ability : playable) {
            if (ability.getAbilityType() == AbilityType.ACTIVATED_MANA) {
                continue;
            }

            JsonObject option = new JsonObject();
            option.addProperty("index", index++);
            option.addProperty("label", ability.toString());
            option.addProperty("action", actionFor(ability.getAbilityType()));
            option.addProperty("source", Ids.permanentId(ability.getSourceId()));

            Integer targetSeat = firstOpponentTargetSeat(ability, seats);
            if (targetSeat != null) {
                option.addProperty("target_seat", targetSeat);
            }

            options.add(option);
        }

        JsonObject pass = new JsonObject();
        pass.addProperty("index", index);
        pass.addProperty("label", "Pass priority");
        pass.addProperty("action", "pass");
        options.add(pass);

        return options;
    }

    private static String actionFor(AbilityType type) {
        switch (type) {
            case PLAY_LAND:
                return "play_land";
            case SPELL:
                return "cast";
            default:
                return "activate";
        }
    }

    private static Integer firstOpponentTargetSeat(Ability ability, Map<UUID, Integer> seats) {
        for (Target target : ability.getTargets()) {
            for (UUID targetId : target.getTargets()) {
                Integer seat = seats.get(targetId);
                if (seat != null) {
                    return seat;
                }
            }
        }
        return null;
    }
}
