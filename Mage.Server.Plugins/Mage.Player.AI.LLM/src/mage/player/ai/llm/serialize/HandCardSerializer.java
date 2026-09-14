package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.ActivatedAbility;
import mage.cards.Card;
import mage.game.Game;
import mage.players.Player;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Serializer for a hand card, matching the "Hand card object" schema in
 * xmage-llm-bridge-design.md. {@code castable_now} is read straight off the engine's
 * own legal-play enumeration rather than reimplementing mana math.
 *
 * @author CarmaNayeli
 */
public final class HandCardSerializer {

    private HandCardSerializer() {
    }

    public static JsonArray serializeHand(Player player, Game game, Glossary glossary) {
        Set<UUID> playableSourceIds = player.getPlayable(game, true).stream()
                .map(ActivatedAbility::getSourceId)
                .collect(Collectors.toSet());

        JsonArray hand = new JsonArray();
        for (Card card : player.getHand().getCards(game)) {
            glossary.register(card, game);

            JsonObject obj = new JsonObject();
            obj.addProperty("id", Ids.permanentId(card.getId()));
            obj.addProperty("card", Ids.cardId(card.getName()));
            obj.addProperty("name", card.getName());
            obj.addProperty("mana_cost", card.getManaCost().getText());
            obj.addProperty("mv", card.getManaValue());
            JsonArray types = new JsonArray();
            card.getCardType(game).forEach(type -> types.add(type.toString()));
            obj.add("types", types);
            obj.addProperty("castable_now", playableSourceIds.contains(card.getId()));
            hand.add(obj);
        }
        return hand;
    }
}
