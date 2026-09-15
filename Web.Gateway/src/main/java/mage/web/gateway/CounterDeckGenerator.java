package mage.web.gateway;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import org.apache.log4j.Logger;

import java.util.Optional;
import java.util.regex.Pattern;

/**
 * "Analyze my deck and build an easy/medium/hard counter" - has Claude write a real
 * decklist as plain text, in exactly the format {@link DeckSubmission} (via
 * {@link mage.cards.decks.importer.TxtDeckImporter}) already parses, so the result
 * goes through the same import/validation path as anything a human pastes in - no
 * separate trust boundary for AI-generated decks.
 * <p>
 * Same Anthropic client library as the LLM bridge bot ({@code Mage.Player.AI.LLM}),
 * same env-var convention ({@code ANTHROPIC_API_KEY} via the SDK's own
 * {@code fromEnv()}, {@code ANTHROPIC_PRIMARY_MODEL} to override the model) - not
 * sharing code directly since that module's {@code DotEnv} is package-private and
 * this only ever runs containerized (a real env var, not a {@code .env} file, is
 * what's actually available in production).
 *
 * @author CarmaNayeli
 */
final class CounterDeckGenerator {

    private static final Logger logger = Logger.getLogger(CounterDeckGenerator.class);
    private static final Pattern CODE_FENCE = Pattern.compile("^```[a-zA-Z]*\\n|```$", Pattern.MULTILINE);

    private CounterDeckGenerator() {
    }

    static String generate(String playerDeckText, Format format, String difficulty) {
        AnthropicClient client = AnthropicOkHttpClient.fromEnv();
        MessageCreateParams params = MessageCreateParams.builder()
                .model(modelName())
                .maxTokens(2048L)
                .addUserMessage(buildPrompt(playerDeckText, format, difficulty))
                .build();

        Message response = client.messages().create(params);
        String text = response.content().stream()
                .map(block -> block.text())
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst()
                .map(textBlock -> textBlock.text())
                .orElseThrow(() -> new IllegalStateException("No text content in counter-deck response"));

        String cleaned = CODE_FENCE.matcher(text.trim()).replaceAll("").trim();
        logger.info("Generated counter deck (" + difficulty + ", " + format.displayName + "):\n" + cleaned);
        return cleaned;
    }

    private static String modelName() {
        String fromEnv = System.getenv("ANTHROPIC_PRIMARY_MODEL");
        return (fromEnv != null && !fromEnv.trim().isEmpty()) ? fromEnv : "claude-opus-5";
    }

    private static String buildPrompt(String playerDeckText, Format format, String difficulty) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are building a Magic: The Gathering decklist to serve as a practice opponent.\n\n");
        prompt.append("Format: ").append(format.displayName).append("\n");
        prompt.append("Difficulty: ").append(difficulty).append(" - ").append(difficultyGuidance(difficulty)).append("\n\n");
        prompt.append("Here is the decklist you need to build a counter to:\n");
        prompt.append(playerDeckText).append("\n\n");
        prompt.append("Analyze that deck's plan (its colors, curve, key threats, and win condition), then build a ");
        prompt.append(format.displayName).append("-legal deck that counters it at the requested difficulty.\n\n");

        if (format.isCommander()) {
            prompt.append("This must be a complete, legal Commander deck: exactly 100 cards total, singleton ");
            prompt.append("(no duplicate cards except basic lands), with exactly one legal commander (a legendary ");
            prompt.append("creature, or another card type that can legally serve as a commander). List the other 99 ");
            prompt.append("cards first, then the commander on its own final line prefixed with \"SB: 1 \" ");
            prompt.append("(for example: \"SB: 1 Krenko, Mob Boss\").\n\n");
        } else {
            prompt.append("This must be a complete deck of at least 60 cards, including lands.\n\n");
        }

        prompt.append("Every card must be a real, existing Magic: The Gathering card, legal in the ");
        prompt.append(format.displayName).append(" format.\n\n");
        prompt.append("Respond with ONLY the decklist, one card per line, in the exact format \"<count> <card name>\" ");
        prompt.append("(for example \"4 Lightning Bolt\", \"20 Mountain\"). No headers, no explanation, no markdown, ");
        prompt.append("no code fences - just the raw lines.");

        return prompt.toString();
    }

    private static String difficultyGuidance(String difficulty) {
        switch (difficulty == null ? "" : difficulty.toLowerCase()) {
            case "easy":
                return "a weak, low-synergy, beginner-friendly deck using simple creatures and basic removal - "
                        + "not tuned to counter the opponent, just a generic simple deck.";
            case "hard":
                return "a highly optimized, powerful deck specifically tuned to beat the opponent's deck - "
                        + "efficient answers to its key threats, a faster or more resilient plan, strong synergy.";
            case "medium":
            default:
                return "a solid, reasonably synergistic deck that plays well and includes some answers to the "
                        + "opponent's likely game plan, without being a tightly optimized meta deck.";
        }
    }
}
