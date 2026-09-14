package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Ability;
import mage.abilities.ActivatedAbility;
import mage.constants.AbilityType;
import mage.game.Game;
import mage.players.Player;
import mage.target.Target;

import java.util.ArrayList;
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
 * they never belong in a decision the model is asked to make. {@link #playable} is the
 * shared filtered list; {@link #enumerate} builds JSON from it and {@link #resolve}
 * indexes back into it, so a response's selected index always maps to the same
 * ability that produced its JSON entry.
 * <p>
 * "Pass" is always appended as the last option and is the majority-correct answer -
 * the design doc's own warning is that an untrained bridge will respond to everything
 * if given the chance. {@link #resolve} returns {@code null} for that index (and for
 * any out-of-range index), which callers treat as "pass".
 *
 * @author CarmaNayeli
 */
public final class PriorityOptionEnumerator {

    private PriorityOptionEnumerator() {
    }

    public static List<ActivatedAbility> playable(Player player, Game game) {
        List<ActivatedAbility> result = new ArrayList<>();
        for (ActivatedAbility ability : player.getPlayable(game, true)) {
            if (ability.getAbilityType() != AbilityType.ACTIVATED_MANA) {
                result.add(ability);
            }
        }
        return result;
    }

    public static JsonArray enumerate(Player player, Game game, Map<UUID, Integer> seats) {
        JsonArray options = new JsonArray();
        List<ActivatedAbility> playable = playable(player, game);

        int index = 0;
        for (ActivatedAbility ability : playable) {
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

    /**
     * The ability a previously-enumerated option's index refers to, or {@code null}
     * for the trailing "Pass priority" option and for any out-of-range index.
     */
    public static ActivatedAbility resolve(Player player, Game game, int index) {
        List<ActivatedAbility> options = playable(player, game);
        return (index >= 0 && index < options.size()) ? options.get(index) : null;
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
