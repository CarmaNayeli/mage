package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class AnnounceXOptionEnumeratorTest {

    @Test
    void enumerateProducesOneOptionPerLegalValue() {
        JsonArray options = AnnounceXOptionEnumerator.enumerate(0, 3);

        assertEquals(4, options.size());
        for (int i = 0; i < options.size(); i++) {
            JsonObject option = options.get(i).getAsJsonObject();
            assertEquals(i, option.get("index").getAsInt());
            assertEquals(i, option.get("value").getAsInt());
            assertEquals("X = " + i, option.get("label").getAsString());
            assertEquals("announce_x", option.get("action").getAsString());
        }
    }

    @Test
    void enumerateHandlesNonZeroMinimum() {
        JsonArray options = AnnounceXOptionEnumerator.enumerate(2, 4);

        assertEquals(3, options.size());
        assertEquals(2, options.get(0).getAsJsonObject().get("value").getAsInt());
        assertEquals(3, options.get(1).getAsJsonObject().get("value").getAsInt());
        assertEquals(4, options.get(2).getAsJsonObject().get("value").getAsInt());
    }

    @Test
    void resolveMapsIndexBackToTheSameValueEnumerateUsed() {
        assertEquals(2, AnnounceXOptionEnumerator.resolve(2, 5, 0));
        assertEquals(5, AnnounceXOptionEnumerator.resolve(2, 5, 3));
    }

    @Test
    void resolveRejectsOutOfRangeIndices() {
        assertNull(AnnounceXOptionEnumerator.resolve(0, 3, -1));
        assertNull(AnnounceXOptionEnumerator.resolve(0, 3, 4));
    }
}
