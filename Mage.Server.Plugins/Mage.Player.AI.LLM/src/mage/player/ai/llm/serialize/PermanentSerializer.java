package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.constants.CardType;
import mage.counters.Counter;
import mage.game.Game;
import mage.game.permanent.Permanent;

import java.util.UUID;

/**
 * Serializer for a single battlefield permanent, matching the "Permanent object"
 * schema in xmage-llm-bridge-design.md.
 *
 * @author CarmaNayeli
 */
public final class PermanentSerializer {

    private PermanentSerializer() {
    }

    public static JsonObject serialize(Permanent permanent, Game game, Glossary glossary) {
        glossary.register(permanent, game);

        JsonObject obj = new JsonObject();

        obj.addProperty("id", Ids.permanentId(permanent.getId()));
        obj.addProperty("card", Ids.cardId(permanent.getName()));
        obj.addProperty("name", permanent.getName());
        obj.add("types", toJsonArray(permanent.getCardType(game)));
        obj.add("subtypes", toJsonArray(permanent.getSubtype(game)));

        boolean isCreature = permanent.getCardType(game).contains(CardType.CREATURE);
        if (isCreature) {
            obj.addProperty("power", permanent.getPower().getValue());
            obj.addProperty("toughness", permanent.getToughness().getValue());
            obj.addProperty("summoning_sick", permanent.hasSummoningSickness());
            obj.addProperty("can_attack", permanent.canAttack(null, game));
        }

        obj.addProperty("tapped", permanent.isTapped());

        JsonObject counters = new JsonObject();
        for (Counter counter : permanent.getCounters(game).values()) {
            counters.addProperty(counter.getName(), counter.getCount());
        }
        if (counters.size() > 0) {
            obj.add("counters", counters);
        }

        if (!permanent.getAttachments().isEmpty()) {
            JsonArray attached = new JsonArray();
            for (UUID attachmentId : permanent.getAttachments()) {
                attached.add(Ids.permanentId(attachmentId));
            }
            obj.add("attached", attached);
        }
        // omitted (rather than null) when unattached - Gson drops null JsonPrimitives
        // by default, which happens to match "omit what's inferable" here
        obj.addProperty("attached_to", permanent.getAttachedTo() == null ? null : Ids.permanentId(permanent.getAttachedTo()));

        obj.addProperty("is_token", permanent.isToken());

        String controllerName = game.getPlayer(permanent.getControllerId()) != null
                ? game.getPlayer(permanent.getControllerId()).getName()
                : "unknown";
        obj.addProperty("controller", controllerName);

        JsonArray keywords = new JsonArray();
        permanent.getAbilities().stream()
                .filter(ability -> ability.getClass().getPackage() != null
                        && "mage.abilities.keyword".equals(ability.getClass().getPackage().getName()))
                .map(ability -> ability.getRule().toLowerCase())
                .distinct()
                .forEach(keywords::add);
        if (keywords.size() > 0) {
            obj.add("keywords", keywords);
        }

        return obj;
    }

    /**
     * "you.battlefield" - every permanent currently controlled by the given seat.
     */
    public static JsonArray serializeControlledBattlefield(Game game, UUID controllingPlayerId, Glossary glossary) {
        JsonArray battlefield = new JsonArray();
        game.getBattlefield().getAllActivePermanents(controllingPlayerId).forEach(permanent ->
                battlefield.add(serialize(permanent, game, glossary)));
        return battlefield;
    }

    private static JsonArray toJsonArray(Iterable<?> values) {
        JsonArray array = new JsonArray();
        for (Object value : values) {
            array.add(value.toString());
        }
        return array;
    }
}
