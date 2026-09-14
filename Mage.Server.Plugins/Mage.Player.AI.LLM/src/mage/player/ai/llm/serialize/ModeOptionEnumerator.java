package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Mode;
import mage.abilities.Modes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Design principle 2 for modal spell selection: one option per mode, using each
 * Mode's own effect text as the label so the model reads exactly what the card says
 * rather than a paraphrase that could drift from the real rules text.
 * <p>
 * {@link Modes} is a {@code LinkedHashMap}, so its iteration order is stable
 * insertion order - {@link #enumerate} and {@link #resolve} both walk
 * {@link Modes#entrySet()} directly, so a response's selected index always maps back
 * to the same mode.
 *
 * @author CarmaNayeli
 */
public final class ModeOptionEnumerator {

    private ModeOptionEnumerator() {
    }

    public static JsonArray enumerate(Modes modes) {
        JsonArray options = new JsonArray();
        int index = 0;
        for (Map.Entry<java.util.UUID, Mode> entry : modes.entrySet()) {
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

    /**
     * The mode a previously-enumerated option's index refers to, or {@code null} if
     * the index is out of range.
     */
    public static Mode resolve(Modes modes, int index) {
        List<Mode> ordered = new ArrayList<>(modes.values());
        return (index >= 0 && index < ordered.size()) ? ordered.get(index) : null;
    }
}
