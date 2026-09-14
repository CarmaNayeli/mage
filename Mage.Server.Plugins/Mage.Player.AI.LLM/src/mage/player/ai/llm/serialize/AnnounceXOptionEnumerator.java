package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * Design principle 2 for announcing {@code {X}} on a spell or ability's variable
 * cost: one option per legal value in [min, max]. This is the judgment-call
 * announceX (deciding how much a Fireball hits for, how many creatures a
 * kicker makes) - not the mana-payment announceX ("how much mana do you want to
 * spend here"), which the escalation policy in the design doc keeps on the free
 * ComputerPlayer path and which {@link mage.player.ai.llm.LLMBridgePlayer} never
 * routes here.
 * <p>
 * {@link #enumerate} and {@link #resolve} are both pure functions of (min, max), so
 * there's no shared list to build once and reuse - unlike the other enumerators,
 * nothing here depends on game state that could shift between the two calls.
 *
 * @author CarmaNayeli
 */
public final class AnnounceXOptionEnumerator {

    private AnnounceXOptionEnumerator() {
    }

    public static JsonArray enumerate(int min, int max) {
        JsonArray options = new JsonArray();
        for (int x = min; x <= max; x++) {
            JsonObject option = new JsonObject();
            option.addProperty("index", x - min);
            option.addProperty("label", "X = " + x);
            option.addProperty("action", "announce_x");
            option.addProperty("value", x);
            options.add(option);
        }
        return options;
    }

    /**
     * The X value a previously-enumerated option's index refers to, or {@code null}
     * if the index is out of [min, max]'s range.
     */
    public static Integer resolve(int min, int max, int index) {
        int x = min + index;
        return (x >= min && x <= max) ? x : null;
    }
}
