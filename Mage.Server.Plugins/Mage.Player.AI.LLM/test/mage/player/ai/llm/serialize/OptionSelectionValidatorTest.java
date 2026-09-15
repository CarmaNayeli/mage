package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OptionSelectionValidatorTest {

    /**
     * Two options sharing "source" p_bear - the AttackOptionEnumerator/
     * BlockOptionEnumerator shape: one entry per (source, target) pair, so the same
     * creature can legally appear as the source of more than one option.
     */
    private static JsonArray twoOptionsSharingASource() {
        JsonArray options = new JsonArray();

        JsonObject attackSeat2 = new JsonObject();
        attackSeat2.addProperty("index", 0);
        attackSeat2.addProperty("source", "p_bear");
        attackSeat2.addProperty("target_seat", 2);
        options.add(attackSeat2);

        JsonObject attackSeat3 = new JsonObject();
        attackSeat3.addProperty("index", 1);
        attackSeat3.addProperty("source", "p_bear");
        attackSeat3.addProperty("target_seat", 3);
        options.add(attackSeat3);

        JsonObject attackWithOtherCreature = new JsonObject();
        attackWithOtherCreature.addProperty("index", 2);
        attackWithOtherCreature.addProperty("source", "p_elf");
        attackWithOtherCreature.addProperty("target_seat", 2);
        options.add(attackWithOtherCreature);

        return options;
    }

    @Test
    void selectingBothOptionsForTheSameSourceIsAConflict() {
        JsonArray options = twoOptionsSharingASource();

        List<OptionSelectionValidator.Conflict> conflicts =
                OptionSelectionValidator.findConflicts(options, Arrays.asList(0, 1));

        assertEquals(1, conflicts.size());
        assertEquals(0, conflicts.get(0).firstIndex);
        assertEquals(1, conflicts.get(0).secondIndex);
        assertEquals("p_bear", conflicts.get(0).sharedSource);
    }

    @Test
    void selectingDifferentSourcesIsNotAConflict() {
        JsonArray options = twoOptionsSharingASource();

        List<OptionSelectionValidator.Conflict> conflicts =
                OptionSelectionValidator.findConflicts(options, Arrays.asList(0, 2));

        assertTrue(conflicts.isEmpty());
    }

    @Test
    void aSingleSelectionCanNeverConflict() {
        JsonArray options = twoOptionsSharingASource();

        List<OptionSelectionValidator.Conflict> conflicts =
                OptionSelectionValidator.findConflicts(options, Arrays.asList(0));

        assertTrue(conflicts.isEmpty());
    }

    @Test
    void unknownIndicesAreIgnoredRatherThanThrowing() {
        JsonArray options = twoOptionsSharingASource();

        List<OptionSelectionValidator.Conflict> conflicts =
                OptionSelectionValidator.findConflicts(options, Arrays.asList(0, 99));

        assertTrue(conflicts.isEmpty());
    }
}
