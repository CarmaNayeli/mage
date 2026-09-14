package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.Mana;
import mage.cards.Card;
import mage.constants.CommanderCardType;
import mage.game.Game;
import mage.players.Player;
import mage.watchers.common.CommanderPlaysCountWatcher;

import java.util.Comparator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Serializer for the "you" and per-opponent objects in the request envelope.
 * <p>
 * Design principle 1 (perspective-relative, always) is what separates the two: "you"
 * gets full hand contents and mana_available, an opponent gets only a hand count -
 * everything else (battlefield, graveyard, commander info) is public zone info and
 * serializes the same either way.
 *
 * @author CarmaNayeli
 */
public final class PlayerStateSerializer {

    private PlayerStateSerializer() {
    }

    public static JsonObject serializeYou(Player player, Game game, Map<UUID, Integer> seats, Glossary glossary) {
        JsonObject obj = baseFields(player, game, seats, glossary);
        obj.add("hand", HandCardSerializer.serializeHand(player, game, glossary));
        obj.add("mana_available", serializeManaAvailable(player, game));
        obj.addProperty("lands_played_this_turn", player.getLandsPlayed());
        return obj;
    }

    public static JsonObject serializeOpponent(Player player, Game game, Map<UUID, Integer> seats, Glossary glossary) {
        JsonObject obj = baseFields(player, game, seats, glossary);
        obj.addProperty("hand_count", player.getHand().size());
        return obj;
    }

    private static JsonObject baseFields(Player player, Game game, Map<UUID, Integer> seats, Glossary glossary) {
        JsonObject obj = new JsonObject();
        obj.addProperty("seat", seats.get(player.getId()));
        obj.addProperty("name", player.getName());
        obj.addProperty("life", player.getLife());

        JsonObject commander = serializeCommander(player, game, glossary);
        if (commander != null) {
            obj.add("commander", commander);
        }

        obj.add("battlefield", PermanentSerializer.serializeControlledBattlefield(game, player.getId(), glossary));

        JsonObject graveyard = new JsonObject();
        Set<Card> graveyardCards = player.getGraveyard().getCards(game);
        graveyard.addProperty("count", graveyardCards.size());
        JsonArray notable = new JsonArray();
        graveyardCards.stream()
                .filter(card -> !card.getRules(game).isEmpty()) // skip basics/vanillas, same as the glossary
                .limit(5)
                .forEach(card -> {
                    glossary.register(card, game);
                    notable.add(Ids.cardId(card.getName()));
                });
        if (notable.size() > 0) {
            graveyard.add("notable", notable);
        }
        obj.add("graveyard", graveyard);

        return obj;
    }

    /**
     * Commander tax follows the actual rule directly ({2} more per previous cast from
     * the command zone) rather than reading it off a continuous effect, so this stays
     * correct without depending on CommanderCostModification's internals. Only the
     * first commander is reported for now - partner/background pairs need an array,
     * left for later since it doesn't come up in the test scenarios yet.
     */
    private static JsonObject serializeCommander(Player player, Game game, Glossary glossary) {
        Set<UUID> commanderIds = game.getCommandersIds(player, CommanderCardType.ANY, false);
        if (commanderIds.isEmpty()) {
            return null;
        }
        UUID commanderId = commanderIds.iterator().next();
        Card commanderCard = game.getCard(commanderId);
        if (commanderCard == null) {
            return null;
        }
        glossary.register(commanderCard, game);

        CommanderPlaysCountWatcher watcher = game.getState().getWatcher(CommanderPlaysCountWatcher.class);
        int castCount = watcher != null ? watcher.getPlaysCount(commanderId) : 0;

        JsonObject commander = new JsonObject();
        commander.addProperty("name", commanderCard.getName());
        commander.addProperty("zone", game.getState().getZone(commanderId).toString());
        commander.addProperty("tax", castCount * 2);
        commander.addProperty("cast_count", castCount);
        return commander;
    }

    /**
     * ManaOptions is a set of achievable combinations, not one number - this reports
     * the highest-total combination as a representative estimate. Good enough for the
     * model's own rough planning; the engine's castable_now on hand cards is still the
     * authority on what can actually be paid for.
     */
    private static JsonObject serializeManaAvailable(Player player, Game game) {
        Mana best = player.getManaAvailable(game).stream()
                .max(Comparator.comparingInt(Mana::count))
                .orElse(new Mana());

        JsonObject mana = new JsonObject();
        mana.addProperty("W", best.getWhite());
        mana.addProperty("U", best.getBlue());
        mana.addProperty("B", best.getBlack());
        mana.addProperty("R", best.getRed());
        mana.addProperty("G", best.getGreen());
        mana.addProperty("any", best.getGeneric() + best.getColorless());
        mana.addProperty("total", best.count());
        return mana;
    }
}
