package org.mage.test.AI.llm;

import com.google.gson.JsonObject;
import mage.player.ai.llm.client.LLMDecisionClient;
import mage.player.ai.llm.client.LLMDecisionClient.ModelTier;
import mage.player.ai.llm.client.LLMDecisionResponse;
import org.junit.Assert;
import org.junit.Assume;
import org.junit.Test;

/**
 * tierFor() is pure routing logic, testable with no network and no credentials -
 * this is the "cost mitigation #4" model-tier split from the design doc, encoded as
 * data rather than left implicit.
 * <p>
 * decide() itself needs a live ANTHROPIC_API_KEY, which this environment doesn't
 * have; liveCall_decidesAPriorityDecision is Assume-skipped without one rather than
 * failing, so it runs automatically the moment a key is set without any code change.
 *
 * @author CarmaNayeli
 */
public class LLMDecisionClientTest {

    @Test
    public void declareBlockersAndChooseTarget_routeToEconomyModel() {
        Assert.assertEquals(ModelTier.ECONOMY, LLMDecisionClient.tierFor("declare_blockers"));
        Assert.assertEquals(ModelTier.ECONOMY, LLMDecisionClient.tierFor("choose_target"));
    }

    @Test
    public void everyOtherDecisionType_routesToPrimaryModel() {
        Assert.assertEquals(ModelTier.PRIMARY, LLMDecisionClient.tierFor("priority"));
        Assert.assertEquals(ModelTier.PRIMARY, LLMDecisionClient.tierFor("declare_attackers"));
        Assert.assertEquals(ModelTier.PRIMARY, LLMDecisionClient.tierFor("choose_use"));
        Assert.assertEquals(ModelTier.PRIMARY, LLMDecisionClient.tierFor("choose_mode"));
    }

    @Test
    public void liveCall_decidesAPriorityDecision() {
        Assume.assumeTrue("Skipping - no ANTHROPIC_API_KEY in this environment",
                System.getenv("ANTHROPIC_API_KEY") != null);

        JsonObject decision = new JsonObject();
        decision.addProperty("type", "priority");
        decision.addProperty("prompt", "You have priority. Nothing worth doing - pass.");
        decision.add("options", new com.google.gson.JsonArray());

        JsonObject envelope = new JsonObject();
        envelope.addProperty("schema", 1);
        envelope.add("decision", decision);

        LLMDecisionResponse response = new LLMDecisionClient().decide(envelope, ModelTier.ECONOMY);

        Assert.assertNotNull(response);
        Assert.assertNotNull(response.notes());
    }
}
