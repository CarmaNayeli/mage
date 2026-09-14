package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fixes the mutual-exclusion gap noted in AttackOptionEnumerator and
 * BlockOptionEnumerator: the options list has one entry per (source, target) pair,
 * which means a model response can legally-look-like it selected two options that
 * share the same source creature - "attack seat 2 AND seat 3 with the same Bear" -
 * which isn't a real move. Nothing in the envelope itself prevents that; this is the
 * check a response handler runs before turning selected indices into game actions.
 * <p>
 * Only meaningful for multi-select decisions (declare_attackers, declare_blockers) -
 * single-select decisions (priority, choose_target, choose_use, choose_mode) only
 * ever have one selected index, so there's nothing to conflict.
 *
 * @author CarmaNayeli
 */
public final class OptionSelectionValidator {

    private OptionSelectionValidator() {
    }

    public static final class Conflict {
        public final int firstIndex;
        public final int secondIndex;
        public final String sharedSource;

        Conflict(int firstIndex, int secondIndex, String sharedSource) {
            this.firstIndex = firstIndex;
            this.secondIndex = secondIndex;
            this.sharedSource = sharedSource;
        }

        @Override
        public String toString() {
            return "options " + firstIndex + " and " + secondIndex + " both use source " + sharedSource;
        }
    }

    /**
     * Returns every pair of selected indices that share a "source" field, in the
     * order the second of each pair was encountered. Empty means the selection is
     * safe to execute as-is.
     */
    public static List<Conflict> findConflicts(JsonArray options, List<Integer> selectedIndices) {
        Map<Integer, JsonObject> byIndex = new LinkedHashMap<>();
        for (com.google.gson.JsonElement element : options) {
            JsonObject option = element.getAsJsonObject();
            byIndex.put(option.get("index").getAsInt(), option);
        }

        List<Conflict> conflicts = new ArrayList<>();
        Map<String, Integer> firstIndexBySource = new LinkedHashMap<>();

        for (int selectedIndex : selectedIndices) {
            JsonObject option = byIndex.get(selectedIndex);
            if (option == null || !option.has("source")) {
                continue;
            }
            String source = option.get("source").getAsString();
            Integer firstIndex = firstIndexBySource.get(source);
            if (firstIndex != null) {
                conflicts.add(new Conflict(firstIndex, selectedIndex, source));
            } else {
                firstIndexBySource.put(source, selectedIndex);
            }
        }

        return conflicts;
    }
}
