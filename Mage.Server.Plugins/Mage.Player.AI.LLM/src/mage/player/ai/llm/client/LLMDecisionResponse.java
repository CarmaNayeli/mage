package mage.player.ai.llm.client;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/**
 * The Response object from xmage-llm-bridge-design.md, deserialized straight off the
 * API via structured outputs - no manual JSON parsing, no validator for a malformed
 * response, since the schema itself constrains what the model can return.
 * <p>
 * A plain class rather than a record: this module compiles at Java 8 source level
 * (matches the rest of XMage's build), and records need 16+.
 *
 * @author CarmaNayeli
 */
public final class LLMDecisionResponse {

    private final int choice;
    private final List<Integer> also;
    private final String notes;
    private final String say;

    @JsonCreator
    public LLMDecisionResponse(
            @JsonProperty("choice")
            int choice,
            @JsonProperty("also")
            @JsonPropertyDescription("Additional option indices for multi-select decisions. Omit or leave empty for single-select.")
            List<Integer> also,
            @JsonProperty("notes")
            @JsonPropertyDescription("Your updated memory: threat assessment, grudges, deals, table politics. Replaces the previous notes wholesale. Keep it under 500 characters.")
            String notes,
            @JsonProperty("say")
            @JsonPropertyDescription("Optional table talk for a spectator view. Leave empty if you have nothing to say.")
            String say) {
        this.choice = choice;
        this.also = also;
        this.notes = notes;
        this.say = say;
    }

    /**
     * The selected option's index - the only field single-select decisions need.
     */
    public int choice() {
        return choice;
    }

    /**
     * Additional indices for multi-select decisions (declare_attackers, declare_blockers).
     */
    public List<Integer> also() {
        return also;
    }

    /**
     * Replaces the stored notes wholesale - the model's memory field (design principle 5).
     */
    public String notes() {
        return notes;
    }

    /**
     * Optional table talk, surfaced in a spectator view.
     */
    public String say() {
        return say;
    }
}
