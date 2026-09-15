package mage.player.ai.llm.client;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.TextBlockParam;
import com.google.gson.JsonObject;

import java.util.Collections;
import java.util.Optional;

/**
 * The HTTP call in xmage-llm-bridge-design.md, finally: posts an envelope from
 * GameStateSerializer to Claude and gets back a typed {@link LLMDecisionResponse} via
 * structured outputs - no hand-rolled JSON parsing, no validator for a malformed
 * response shape.
 * <p>
 * Cost mitigation #1 from the design doc - prompt caching - is built in: the rules
 * explanation lives in a cached system block ({@link #RULES_PROMPT}), so only the
 * dynamic envelope is paid for at full price on every call.
 * <p>
 * Cost mitigation #4 - a smaller model for the boring escalations - is built in via
 * {@link #tierFor}: declare_blockers and choose_target route to the economy model
 * (mechanical, little political weight), everything else to the primary model.
 * <p>
 * The bridge's whole config surface is {@link DotEnv}: {@code ANTHROPIC_API_KEY} (real
 * env var or a {@code .env} file) for the key, and {@code ANTHROPIC_PRIMARY_MODEL} /
 * {@code ANTHROPIC_ECONOMY_MODEL} (same mechanism) to override the model tiers below -
 * no code change needed to try a different model.
 *
 * @author CarmaNayeli
 */
public final class LLMDecisionClient {

    public enum ModelTier {
        /**
         * Political/judgment decisions: priority (what to cast), declare_attackers (who
         * to attack - the design doc's own notes example is entirely about this),
         * choose_use (real tradeoffs), choose_mode (card-specific judgment).
         */
        PRIMARY,
        /**
         * Mechanical decisions with little political weight, per the design doc's own
         * wording: "Blocks and targeting don't need your best model."
         */
        ECONOMY
    }

    private static final String RULES_PROMPT = String.join("\n",
            "You are playing Magic: The Gathering (Commander format) through a JSON bridge to the XMage engine.",
            "",
            "Every request is one decision. The envelope's `decision.options` list is exhaustive and engine-",
            "generated - every option is a legal play, there is nothing illegal to avoid and nothing missing to",
            "guess at. Pick by index; never invent an option that isn't in the list.",
            "",
            "`you` is your seat: full hand, mana, battlefield, graveyard. `opponents` show only what's public -",
            "their hand is a count, never contents. Play only on information a real player at the table would have.",
            "",
            "`notes` is your memory between calls - threat assessment, grudges, deals, who's been aggressive,",
            "who asked for a truce. Rewrite it each response; it replaces the old value wholesale. Keep it under",
            "500 characters or it will grow without bound.",
            "",
            "Passing priority is usually correct. Don't take an action just because one is available - most",
            "priority windows in a real game are passed.",
            "",
            "`chat` is what the human player has actually typed to you recently, oldest first - real table talk,",
            "not a game log. It may be empty. You're not obligated to respond to it or let it change a play, but",
            "you can acknowledge it, needle back, or let it inform a bluff/threat read the way a real opponent",
            "would notice being talked to.",
            "",
            "`say` is optional table talk for a spectator view. Use it when it's fun or strategically relevant",
            "(a threat, a deal, a taunt, or a reply to `chat`); leave it empty otherwise.");

    private final AnthropicClient client;
    private final String primaryModel;
    private final String economyModel;

    public LLMDecisionClient() {
        this(buildClientFromEnvironment(),
                DotEnv.getOrDefault("ANTHROPIC_PRIMARY_MODEL", "claude-opus-5"),
                DotEnv.getOrDefault("ANTHROPIC_ECONOMY_MODEL", "claude-haiku-4-5"));
    }

    public LLMDecisionClient(AnthropicClient client, String primaryModel, String economyModel) {
        this.client = client;
        this.primaryModel = primaryModel;
        this.economyModel = economyModel;
    }

    private static AnthropicClient buildClientFromEnvironment() {
        String apiKey = DotEnv.get("ANTHROPIC_API_KEY");
        return apiKey != null
                ? AnthropicOkHttpClient.builder().apiKey(apiKey).build()
                : AnthropicOkHttpClient.fromEnv();
    }

    public static ModelTier tierFor(String decisionType) {
        switch (decisionType) {
            case "declare_blockers":
            case "choose_target":
                return ModelTier.ECONOMY;
            default:
                return ModelTier.PRIMARY;
        }
    }

    public LLMDecisionResponse decide(JsonObject envelope) {
        String decisionType = envelope.getAsJsonObject("decision").get("type").getAsString();
        return decide(envelope, tierFor(decisionType));
    }

    public LLMDecisionResponse decide(JsonObject envelope, ModelTier tier) {
        String model = tier == ModelTier.PRIMARY ? primaryModel : economyModel;

        StructuredMessageCreateParams<LLMDecisionResponse> params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(4096L)
                .systemOfTextBlockParams(Collections.singletonList(
                        TextBlockParam.builder()
                                .text(RULES_PROMPT)
                                .cacheControl(CacheControlEphemeral.builder().build())
                                .build()))
                .outputConfig(LLMDecisionResponse.class)
                .addUserMessage(envelope.toString())
                .build();

        return client.messages().create(params).content().stream()
                .map(block -> block.text())
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst()
                .map(textBlock -> textBlock.text())
                .orElseThrow(() -> new IllegalStateException("No text content in LLM response for decision " + decisionType(envelope)));
    }

    private static String decisionType(JsonObject envelope) {
        return envelope.getAsJsonObject("decision").get("type").getAsString();
    }
}
