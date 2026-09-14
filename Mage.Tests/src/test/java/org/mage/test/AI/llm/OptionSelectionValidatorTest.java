package org.mage.test.AI.llm;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.player.ai.llm.serialize.OptionSelectionValidator;
import mage.player.ai.llm.serialize.OptionSelectionValidator.Conflict;
import org.junit.Assert;
import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Pure unit test - no game state needed. Mirrors the exact shape
 * AttackOptionEnumerator produces for "2 creatures x 3 opponents": options 0-2 all
 * share source p_bear1, options 3-5 all share source p_bear2.
 *
 * @author CarmaNayeli
 */
public class OptionSelectionValidatorTest {

    private JsonArray sampleAttackOptions() {
        JsonArray options = new JsonArray();
        String[] sources = {"p_bear1", "p_bear1", "p_bear1", "p_bear2", "p_bear2", "p_bear2"};
        for (int i = 0; i < sources.length; i++) {
            JsonObject option = new JsonObject();
            option.addProperty("index", i);
            option.addProperty("source", sources[i]);
            options.add(option);
        }
        return options;
    }

    @Test
    public void noConflict_whenSelectedOptionsUseDifferentSources() {
        List<Conflict> conflicts = OptionSelectionValidator.findConflicts(
                sampleAttackOptions(), Arrays.asList(0, 3));
        Assert.assertTrue(conflicts.isEmpty());
    }

    @Test
    public void conflict_whenTwoSelectedOptionsShareASource() {
        List<Conflict> conflicts = OptionSelectionValidator.findConflicts(
                sampleAttackOptions(), Arrays.asList(0, 1));
        Assert.assertEquals(1, conflicts.size());
        Assert.assertEquals(0, conflicts.get(0).firstIndex);
        Assert.assertEquals(1, conflicts.get(0).secondIndex);
        Assert.assertEquals("p_bear1", conflicts.get(0).sharedSource);
    }

    @Test
    public void onlyTheRepeatedSourceConflicts_inALargerSelection() {
        List<Conflict> conflicts = OptionSelectionValidator.findConflicts(
                sampleAttackOptions(), Arrays.asList(0, 1, 3));
        Assert.assertEquals(1, conflicts.size());
        Assert.assertEquals("p_bear1", conflicts.get(0).sharedSource);
    }

    @Test
    public void noConflict_onEmptySelection() {
        Assert.assertTrue(OptionSelectionValidator.findConflicts(sampleAttackOptions(), Collections.emptyList()).isEmpty());
    }

    @Test
    public void noConflict_onSingleSelection() {
        Assert.assertTrue(OptionSelectionValidator.findConflicts(sampleAttackOptions(), Collections.singletonList(4)).isEmpty());
    }
}
