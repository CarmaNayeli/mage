package mage.player.ai.llm.serialize;

import com.google.gson.JsonObject;
import mage.cards.Card;
import mage.game.Game;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Design principle 3: deduplicate card text ruthlessly. One entry per unique card
 * name, no matter how many copies/tokens are on the board - and skip cards that do
 * nothing (basics, vanillas) per principle 4.
 * <p>
 * A single Glossary instance is threaded through one envelope build and accumulates
 * entries as permanents/hand cards/stack objects get serialized; call {@link #toJson()}
 * once at the end.
 */
public final class Glossary {

    private final Map<String, String> entries = new LinkedHashMap<>();

    /**
     * Registers a card's oracle text under its glossary key, if it has any text worth
     * recording. No-op for cards already registered (that's the dedup) or for cards
     * with no rules text (basics, vanilla creatures).
     */
    public void register(Card card, Game game) {
        if (card.isBasic()) {
            // every basic land does the same well-known thing - not worth a glossary entry
            return;
        }
        String key = Ids.cardId(card.getName());
        if (entries.containsKey(key)) {
            return;
        }
        String text = String.join(" ", card.getRules(game)).replaceAll("<[^>]+>", "");
        if (!text.isEmpty()) {
            entries.put(key, text);
        }
    }

    public JsonObject toJson() {
        JsonObject obj = new JsonObject();
        entries.forEach(obj::addProperty);
        return obj;
    }
}
