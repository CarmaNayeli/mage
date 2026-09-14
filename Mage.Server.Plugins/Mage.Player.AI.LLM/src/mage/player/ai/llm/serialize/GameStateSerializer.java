package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.abilities.Ability;
import mage.abilities.Modes;
import mage.game.Game;
import mage.players.Player;
import mage.target.Target;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Top-level assembler for the request envelope in xmage-llm-bridge-design.md.
 * <p>
 * One factory method per decision type, since each needs different extra context
 * beyond game+you: priority/declare_attackers/declare_blockers are fully derivable
 * from game state alone, but chooseTarget/chooseUse/chooseMode are called mid-
 * resolution of a specific ability and need that ability (and its Target/Modes) passed
 * in. All of them share the same you/opponents/stack/turn/glossary/notes/history
 * assembly. Doesn't call an LLM. {@code notes} and {@code history} are threaded
 * through from whatever the caller has stored between calls - this class doesn't own
 * that state.
 *
 * @author CarmaNayeli
 */
public final class GameStateSerializer {

    private GameStateSerializer() {
    }

    public static JsonObject serializePriority(Game game, Player you, String prompt, String notes, List<String> history) {
        Map<UUID, Integer> seats = assignSeats(game);
        JsonObject decision = decisionObject("priority", prompt, PriorityOptionEnumerator.enumerate(you, game, seats));
        return assembleEnvelope(game, you, seats, decision, notes, history);
    }

    public static JsonObject serializeDeclareAttackers(Game game, Player you, String prompt, String notes, List<String> history) {
        Map<UUID, Integer> seats = assignSeats(game);
        JsonArray options = AttackOptionEnumerator.enumerate(game, you.getId(), seats);
        JsonObject decision = decisionObject("declare_attackers", prompt, options);
        addMultiSelectBounds(decision, options);
        return assembleEnvelope(game, you, seats, decision, notes, history);
    }

    public static JsonObject serializeDeclareBlockers(Game game, Player you, String prompt, String notes, List<String> history) {
        Map<UUID, Integer> seats = assignSeats(game);
        JsonArray options = BlockOptionEnumerator.enumerate(game, you.getId());
        JsonObject decision = decisionObject("declare_blockers", prompt, options);
        addMultiSelectBounds(decision, options);
        return assembleEnvelope(game, you, seats, decision, notes, history);
    }

    /**
     * @param source the ability currently resolving/being cast - already carries the
     *               Target being filled in, per XMage's own chooseTarget(..., Target,
     *               Ability source, ...) call shape
     */
    public static JsonObject serializeChooseTarget(Game game, Player you, Ability source, Target target,
                                                    String prompt, String notes, List<String> history) {
        Map<UUID, Integer> seats = assignSeats(game);
        JsonArray options = ChooseTargetOptionEnumerator.enumerate(game, you.getId(), source, target);
        JsonObject decision = decisionObject("choose_target", prompt, options);
        decision.addProperty("min_choices", target.getMinNumberOfTargets());
        decision.addProperty("max_choices", target.getMaxNumberOfTargets());
        return assembleEnvelope(game, you, seats, decision, notes, history);
    }

    public static JsonObject serializeChooseUse(Game game, Player you, String message, String notes, List<String> history) {
        Map<UUID, Integer> seats = assignSeats(game);
        JsonObject decision = decisionObject("choose_use", message, ChooseUseOptionEnumerator.enumerate());
        return assembleEnvelope(game, you, seats, decision, notes, history);
    }

    public static JsonObject serializeChooseMode(Game game, Player you, Ability source, Modes modes,
                                                  String prompt, String notes, List<String> history) {
        Map<UUID, Integer> seats = assignSeats(game);
        JsonArray options = ModeOptionEnumerator.enumerate(modes);
        JsonObject decision = decisionObject("choose_mode", prompt, options);
        decision.addProperty("min_choices", modes.getMinModes());
        decision.addProperty("max_choices", modes.getMaxModes(game, source));
        return assembleEnvelope(game, you, seats, decision, notes, history);
    }

    private static JsonObject decisionObject(String type, String prompt, JsonArray options) {
        JsonObject decision = new JsonObject();
        decision.addProperty("type", type);
        decision.addProperty("prompt", prompt);
        decision.add("options", options);
        return decision;
    }

    /**
     * min/max here are informational, not enforced by this class - see
     * OptionSelectionValidator for the actual mutual-exclusion check applied to a
     * model's selected indices before execution.
     */
    private static void addMultiSelectBounds(JsonObject decision, JsonArray options) {
        decision.addProperty("min_choices", 0);
        decision.addProperty("max_choices", countDistinctSources(options));
    }

    private static JsonObject assembleEnvelope(Game game, Player you, Map<UUID, Integer> seats, JsonObject decision,
                                                String notes, List<String> history) {
        Glossary glossary = new Glossary();

        JsonObject envelope = new JsonObject();
        envelope.addProperty("schema", 1);
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

    private static int countDistinctSources(JsonArray options) {
        int count = 0;
        List<String> seenSources = new ArrayList<>();
        for (com.google.gson.JsonElement element : options) {
            String source = element.getAsJsonObject().get("source").getAsString();
            if (!seenSources.contains(source)) {
                seenSources.add(source);
                count++;
            }
        }
        return count;
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
