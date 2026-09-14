package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Mode;
import mage.abilities.Modes;

import java.util.Map;
import java.util.UUID;

/**
 * Design principle 2 for modal spell selection: one option per mode, using each
 * Mode's own effect text as the label so the model reads exactly what the card says
 * rather than a paraphrase that could drift from the real rules text.
 *
 * @author CarmaNayeli
 */
public final class ModeOptionEnumerator {

    private ModeOptionEnumerator() {
    }

    public static JsonArray enumerate(Modes modes) {
        JsonArray options = new JsonArray();
        int index = 0;
        for (Map.Entry<UUID, Mode> entry : modes.entrySet()) {
            Mode mode = entry.getValue();
            JsonObject option = new JsonObject();
            option.addProperty("index", index++);
            option.addProperty("label", mode.getEffects().getText(mode));
            option.addProperty("action", "choose_mode");
            option.addProperty("mode_id", Ids.permanentId(entry.getKey()));
            options.add(option);
        }
        return options;
    }
}
