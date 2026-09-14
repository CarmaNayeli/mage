package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.game.Game;
import mage.players.Player;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Top-level assembler for the request envelope in xmage-llm-bridge-design.md.
 * <p>
 * Scope note: this builds everything except {@code decision.options} (the "engine
 * enumerates" side of principle 2 - each decision type needs its own mapping from
 * XMage's selectAttackers/selectBlockers/chooseTarget/etc. into indexed Option
 * objects, which is a separate feature) and doesn't call an LLM. {@code notes} and
 * {@code history} are threaded through from whatever the caller has stored between
 * calls - this class doesn't own that state.
 *
 * @author CarmaNayeli
 */
public final class GameStateSerializer {

    private GameStateSerializer() {
    }

    public static JsonObject serialize(Game game, Player you, String decisionType, String decisionPrompt,
                                        String notes, List<String> history) {
        Glossary glossary = new Glossary();
        Map<UUID, Integer> seats = assignSeats(game);

        JsonObject envelope = new JsonObject();
        envelope.addProperty("schema", 1);

        JsonObject decision = new JsonObject();
        decision.addProperty("type", decisionType);
        decision.addProperty("prompt", decisionPrompt);
        decision.add("options", new JsonArray()); // enumeration bridge not built yet
        envelope.add("decision", decision);

        envelope.add("you", PlayerStateSerializer.serializeYou(you, game, seats, glossary));

        JsonArray opponents = new JsonArray();
        for (UUID playerId : game.getPlayerList()) {
            if (playerId.equals(you.getId())) {
                continue;
            }
            Player opponent = game.getPlayer(playerId);
            if (opponent != null) {
                opponents.add(PlayerStateSerializer.serializeOpponent(opponent, game, seats, glossary));
            }
        }
        envelope.add("opponents", opponents);

        envelope.add("stack", StackSerializer.serialize(game));

        JsonObject turn = new JsonObject();
        turn.addProperty("number", game.getTurnNum());
        turn.addProperty("active_seat", seats.get(game.getActivePlayerId()));
        turn.addProperty("phase", game.getTurnStepType().name().toLowerCase());
        turn.addProperty("is_your_turn", you.getId().equals(game.getActivePlayerId()));
        envelope.add("turn", turn);

        envelope.add("glossary", glossary.toJson());
        envelope.addProperty("notes", notes == null ? "" : notes);

        JsonArray historyArray = new JsonArray();
        if (history != null) {
            history.forEach(historyArray::add);
        }
        envelope.add("history", historyArray);

        return envelope;
    }

    /**
     * Stable seat numbers for the whole game: sorted by player id rather than by
     * current turn-order position, so they don't shift as the active player rotates.
     * Doesn't reflect physical table order yet - fine for eyeballing the contract, a
     * gap to close before seat numbers are used in gameplay-facing option labels.
     */
    private static Map<UUID, Integer> assignSeats(Game game) {
        List<UUID> sortedPlayerIds = new ArrayList<>(game.getPlayerList());
        sortedPlayerIds.sort(Comparator.naturalOrder());

        Map<UUID, Integer> seats = new LinkedHashMap<>();
        int seat = 1;
        for (UUID playerId : sortedPlayerIds) {
            seats.put(playerId, seat++);
        }
        return seats;
    }
}
