package mage.player.ai.llm;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.MageObject;
import mage.abilities.Ability;
import mage.abilities.ActivatedAbility;
import mage.abilities.Mode;
import mage.abilities.Modes;
import mage.abilities.TriggeredAbility;
import mage.abilities.costs.mana.ManaCost;
import mage.cards.Card;
import mage.cards.Cards;
import mage.cards.decks.Deck;
import mage.choices.Choice;
import mage.constants.AbilityType;
import mage.constants.MultiAmountType;
import mage.constants.Outcome;
import mage.constants.RangeOfInfluence;
import mage.game.Game;
import mage.game.draft.Draft;
import mage.game.match.Match;
import mage.game.permanent.Permanent;
import mage.game.tournament.Tournament;
import mage.player.ai.ComputerPlayer;
import mage.player.ai.llm.client.LLMDecisionClient;
import mage.player.ai.llm.client.LLMDecisionResponse;
import mage.player.ai.llm.serialize.AnnounceXOptionEnumerator;
import mage.player.ai.llm.serialize.AttackOptionEnumerator;
import mage.player.ai.llm.serialize.BlockOptionEnumerator;
import mage.player.ai.llm.serialize.ChooseTargetOptionEnumerator;
import mage.player.ai.llm.serialize.GameStateSerializer;
import mage.player.ai.llm.serialize.ModeOptionEnumerator;
import mage.player.ai.llm.serialize.OptionSelectionValidator;
import mage.player.ai.llm.serialize.PriorityOptionEnumerator;
import mage.target.Target;
import mage.target.TargetAmount;
import mage.target.TargetCard;
import mage.util.MultiAmountMessage;
import org.apache.log4j.Logger;

import java.io.Serializable;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import java.util.stream.Collectors;

/**
 * AI: bridges decisions out to an external LLM sidecar over the request/response
 * envelope described in xmage-llm-bridge-design.md.
 * <p>
 * Wired to the escalation policy's "route to the model" list: {@link #priority},
 * {@link #selectAttackers}, {@link #selectBlockers}, {@link #chooseMode}, a targeted
 * subset of {@link #chooseTarget(Outcome, Target, Ability, Game)}, both
 * {@code chooseUse} overloads, and the judgment-call half of {@link #announceX}.
 * Everything else - mana payment, trigger ordering, identical-object choices,
 * scry/surveil - still falls straight to {@link ComputerPlayer}, per the design doc's
 * escalation policy. Every overridable decision method keeps its call counter
 * regardless of whether it escalates; read {@link #printCallCounts()} to see the
 * actual call mix from a played game.
 * <p>
 * A call to the LLM can fail (no API key, network error, malformed response) - that's
 * a real, expected failure mode of an external HTTP dependency, not a bug. Every
 * escalated decision falls back to {@link ComputerPlayer}'s own logic on failure
 * rather than crashing the game.
 *
 * @author CarmaNayeli
 */
public class LLMBridgePlayer extends ComputerPlayer {

    private static final Logger logger = Logger.getLogger(LLMBridgePlayer.class);
    private static final int MAX_HISTORY_ENTRIES = 20;

    /**
     * Above this span, one option per integer stops being a sane envelope (a Fireball
     * off a deep mana pool could legally announce X in the hundreds) - falls back to
     * ComputerPlayer's own heuristic rather than dumping an enormous options list.
     */
    private static final int MAX_ANNOUNCE_X_OPTIONS = 20;

    private static final Map<String, LongAdder> callCounts = new ConcurrentHashMap<>();

    /**
     * Design principle 5: the bridge is stateless per call but the game isn't. This is
     * the model's own scratchpad - threat assessment, grudges, deals - rewritten
     * wholesale each response and fed back on the next call.
     */
    private String notes = "";

    /**
     * Recent actions this bot has taken, oldest first, fed back as the envelope's
     * {@code history}. Bounded so it doesn't grow unbounded over a long game.
     */
    private final Deque<String> history = new ArrayDeque<>();

    /**
     * Lazy and uninitialized in a copy: {@link ComputerPlayer#copy()} is used for
     * state snapshots, not for spinning up a second live HTTP client, and a missing
     * API key shouldn't break the copy itself - only an actual decide() call.
     */
    private transient LLMDecisionClient client;

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    private static void logCall(String methodName) {
        callCounts.computeIfAbsent(methodName, k -> new LongAdder()).increment();
    }

    public static Map<String, Long> getCallCounts() {
        return callCounts.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().sum()));
    }

    public static void resetCallCounts() {
        callCounts.clear();
    }

    public static void printCallCounts() {
        getCallCounts().entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .forEach(e -> System.out.println(String.format("%-45s %d", e.getKey(), e.getValue())));
    }

    public LLMBridgePlayer(String name, RangeOfInfluence range) {
        super(name, range);
    }

    public LLMBridgePlayer(final LLMBridgePlayer player) {
        super(player);
        this.notes = player.notes;
        this.history.addAll(player.history);
    }

    @Override
    public LLMBridgePlayer copy() {
        return new LLMBridgePlayer(this);
    }

    private LLMDecisionClient client() {
        if (client == null) {
            client = new LLMDecisionClient();
        }
        return client;
    }

    private List<String> historySnapshot() {
        return new ArrayList<>(history);
    }

    private void recordHistory(Game game, String label) {
        history.addLast("T" + game.getTurnNum() + " (you): " + label);
        while (history.size() > MAX_HISTORY_ENTRIES) {
            history.removeFirst();
        }
    }

    private static String cappedNotes(String notes) {
        if (notes == null) {
            return "";
        }
        return notes.length() > 500 ? notes.substring(0, 500) : notes;
    }

    /**
     * Posts the envelope and updates {@link #notes} on success. Empty means the call
     * failed and the caller should fall back to {@code super}'s own logic.
     * <p>
     * Notes are logged at INFO on change - there's no GUI surface for a spectator to
     * see the bot's internal threat assessment (only {@code say} reaches the game
     * log), so this is the only way to watch it think without attaching a debugger.
     * Logged only when it actually changed, since the model rewrites it wholesale on
     * every call and near-duplicate lines every priority check would drown the log.
     */
    private Optional<LLMDecisionResponse> decide(Game game, JsonObject envelope) {
        String decisionType = envelope.getAsJsonObject("decision").get("type").getAsString();
        try {
            LLMDecisionResponse response = client().decide(envelope);
            String updatedNotes = cappedNotes(response.notes());
            if (!updatedNotes.equals(this.notes)) {
                logger.info("[" + this.getName() + " notes] " + updatedNotes);
            }
            this.notes = updatedNotes;
            if (response.say() != null && !response.say().isEmpty()) {
                game.informPlayers(this.getName() + " says: \"" + response.say() + "\"");
            }
            return Optional.of(response);
        } catch (RuntimeException e) {
            logger.warn("LLM decision failed for " + decisionType + ", falling back to ComputerPlayer", e);
            return Optional.empty();
        }
    }

    private static List<Integer> selectedIndices(LLMDecisionResponse response) {
        List<Integer> indices = new ArrayList<>();
        indices.add(response.choice());
        if (response.also() != null) {
            indices.addAll(response.also());
        }
        return indices;
    }

    @Override
    public boolean chooseMulligan(Game game) {
        logCall("chooseMulligan");
        return super.chooseMulligan(game);
    }

    @Override
    public boolean choose(Outcome outcome, Target target, Ability source, Game game) {
        logCall("choose(Target)");
        return super.choose(outcome, target, source, game);
    }

    @Override
    public boolean choose(Outcome outcome, Target target, Ability source, Game game, Map<String, Serializable> options) {
        logCall("choose(Target,options)");
        return super.choose(outcome, target, source, game, options);
    }

    /**
     * Design doc: "chooseTarget when targets include opponents or opposing
     * permanents." Targeting only your own stuff (e.g. an equip aura you control) has
     * no real judgment call to make, so it stays on the free/ComputerPlayer path.
     */
    @Override
    public boolean chooseTarget(Outcome outcome, Target target, Ability source, Game game) {
        logCall("chooseTarget(Target)");
        if (!involvesOpponent(target, source, game)) {
            return super.chooseTarget(outcome, target, source, game);
        }

        JsonObject envelope = GameStateSerializer.serializeChooseTarget(
                game, this, source, target, target.getMessage(game), notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            return super.chooseTarget(outcome, target, source, game);
        }

        for (int index : selectedIndices(maybe.get())) {
            if (target.isChoiceCompleted(this.getId(), source, game, null)) {
                break;
            }
            UUID candidate = ChooseTargetOptionEnumerator.resolve(game, this.getId(), source, target, index);
            if (candidate != null && !target.getTargets().contains(candidate)) {
                target.addTarget(candidate, source, game);
            }
        }

        boolean chosen = !target.getTargets().isEmpty();
        recordHistory(game, (chosen ? "chose target for " : "chose no target for ") + source);
        return chosen;
    }

    private boolean involvesOpponent(Target target, Ability source, Game game) {
        for (UUID candidateId : target.possibleTargets(this.getId(), source, game)) {
            if (candidateId.equals(this.getId())) {
                continue;
            }
            if (game.getPlayer(candidateId) != null) {
                return true;
            }
            Permanent permanent = game.getPermanent(candidateId);
            if (permanent != null && !this.getId().equals(permanent.getControllerId())) {
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean chooseTargetAmount(Outcome outcome, TargetAmount target, Ability source, Game game) {
        logCall("chooseTargetAmount");
        return super.chooseTargetAmount(outcome, target, source, game);
    }

    /**
     * Tightened per the design doc's own next step after the first played census
     * (see LLMBridgeOneVsThreeVanillaCallCountTest): priority was ~85% of all
     * escalated calls, and most of that isn't a real judgment call at all - it's
     * "play your only land for turn, there's nothing else to do." That specific case
     * (one non-mana playable ability, and it's a land) is the only one pulled out
     * here; everything else - including a single spell or activated ability, where
     * timing/holding-up-mana is a real question - still goes to the model. Deliberately
     * narrow: this is a judgment call about cost, not a mechanical "fewer options,
     * less escalation" rule.
     */
    private static boolean isForcedLandPlay(List<ActivatedAbility> playable) {
        return playable.size() == 1 && playable.get(0).getAbilityType() == AbilityType.PLAY_LAND;
    }

    @Override
    public boolean priority(Game game) {
        logCall("priority");
        List<ActivatedAbility> playable = PriorityOptionEnumerator.playable(this, game);
        if (playable.isEmpty()) {
            return super.priority(game);
        }
        if (isForcedLandPlay(playable)) {
            ActivatedAbility landAbility = playable.get(0);
            boolean played = activateAbility(landAbility, game);
            recordHistory(game, (played ? "played " : "attempted ") + landAbility + " (only option, no LLM call)");
            return played;
        }

        JsonObject envelope = GameStateSerializer.serializePriority(
                game, this, "Declare a priority action.", notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            return super.priority(game);
        }

        ActivatedAbility ability = PriorityOptionEnumerator.resolve(this, game, maybe.get().choice());
        if (ability == null) {
            pass(game);
            recordHistory(game, "passed priority");
            return false;
        }

        boolean acted = activateAbility(ability, game);
        recordHistory(game, (acted ? "played " : "attempted ") + ability);
        return acted;
    }

    @Override
    public boolean playMana(Ability ability, ManaCost unpaid, String promptText, Game game) {
        logCall("playMana");
        return super.playMana(ability, unpaid, promptText, game);
    }

    /**
     * Design doc's "announceXMana": the judgment-call X (how much a Fireball hits
     * for, how many creatures a kicker makes), not the mana-payment X ("how much
     * mana do you want to spend here") - that one keeps {@code isManaPay == true} and
     * stays on the free ComputerPlayer path per the escalation policy.
     */
    @Override
    public int announceX(int min, int max, String message, Game game, Ability source, boolean isManaPay) {
        logCall("announceX");
        if (isManaPay || max < min || (max - min) > MAX_ANNOUNCE_X_OPTIONS) {
            return super.announceX(min, max, message, game, source, isManaPay);
        }

        JsonObject envelope = GameStateSerializer.serializeAnnounceX(
                game, this, message, min, max, notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            return super.announceX(min, max, message, game, source, isManaPay);
        }

        Integer chosen = AnnounceXOptionEnumerator.resolve(min, max, maybe.get().choice());
        if (chosen == null) {
            return super.announceX(min, max, message, game, source, isManaPay);
        }
        recordHistory(game, "announced X = " + chosen + " for " + message);
        return chosen;
    }

    @Override
    public boolean chooseUse(Outcome outcome, String message, Ability source, Game game) {
        logCall("chooseUse(simple)");
        return llmChooseUse(message, game).orElseGet(() -> super.chooseUse(outcome, message, source, game));
    }

    @Override
    public boolean chooseUse(Outcome outcome, String message, String secondMessage, String trueText, String falseText, Ability source, Game game) {
        logCall("chooseUse(worded)");
        return llmChooseUse(message, game)
                .orElseGet(() -> super.chooseUse(outcome, message, secondMessage, trueText, falseText, source, game));
    }

    private Optional<Boolean> llmChooseUse(String message, Game game) {
        JsonObject envelope = GameStateSerializer.serializeChooseUse(game, this, message, notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            return Optional.empty();
        }
        boolean yes = maybe.get().choice() == 0;
        recordHistory(game, (yes ? "chose yes: " : "chose no: ") + message);
        return Optional.of(yes);
    }

    @Override
    public boolean choose(Outcome outcome, Choice choice, Game game) {
        logCall("choose(Choice)");
        return super.choose(outcome, choice, game);
    }

    @Override
    public boolean chooseTarget(Outcome outcome, Cards cards, TargetCard target, Ability source, Game game) {
        logCall("chooseTarget(Cards)");
        return super.chooseTarget(outcome, cards, target, source, game);
    }

    @Override
    public boolean choose(Outcome outcome, Cards cards, TargetCard target, Ability source, Game game) {
        logCall("choose(Cards)");
        return super.choose(outcome, cards, target, source, game);
    }

    @Override
    public boolean choosePile(Outcome outcome, String message, List<? extends Card> pile1, List<? extends Card> pile2, Game game) {
        logCall("choosePile");
        return super.choosePile(outcome, message, pile1, pile2, game);
    }

    @Override
    public void selectAttackers(Game game, UUID attackingPlayerId) {
        logCall("selectAttackers");
        JsonObject envelope = GameStateSerializer.serializeDeclareAttackers(
                game, this, "Declare attackers for combat.", notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            super.selectAttackers(game, attackingPlayerId);
            return;
        }

        JsonArray options = envelope.getAsJsonObject("decision").getAsJsonArray("options");
        List<Integer> selected = selectedIndices(maybe.get());
        Set<Integer> rejected = OptionSelectionValidator.findConflicts(options, selected).stream()
                .map(c -> c.secondIndex)
                .collect(Collectors.toSet());

        Map<UUID, Integer> seats = GameStateSerializer.assignSeats(game);
        int declared = 0;
        for (int index : selected) {
            if (rejected.contains(index)) {
                continue;
            }
            AttackOptionEnumerator.Pair pair = AttackOptionEnumerator.resolve(game, attackingPlayerId, seats, index);
            if (pair != null) {
                declareAttacker(pair.attackerId, pair.defenderId, game, false);
                declared++;
            }
        }
        recordHistory(game, declared == 0 ? "declared no attackers" : "declared " + declared + " attacker(s)");
    }

    @Override
    public void selectBlockers(Ability source, Game game, UUID defendingPlayerId) {
        logCall("selectBlockers");
        JsonObject envelope = GameStateSerializer.serializeDeclareBlockers(
                game, this, "Declare blockers for combat.", notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            super.selectBlockers(source, game, defendingPlayerId);
            return;
        }

        JsonArray options = envelope.getAsJsonObject("decision").getAsJsonArray("options");
        List<Integer> selected = selectedIndices(maybe.get());
        Set<Integer> rejected = OptionSelectionValidator.findConflicts(options, selected).stream()
                .map(c -> c.secondIndex)
                .collect(Collectors.toSet());

        int declared = 0;
        for (int index : selected) {
            if (rejected.contains(index)) {
                continue;
            }
            BlockOptionEnumerator.Pair pair = BlockOptionEnumerator.resolve(game, defendingPlayerId, index);
            if (pair != null) {
                declareBlocker(defendingPlayerId, pair.blockerId, pair.attackerId, game);
                declared++;
            }
        }
        recordHistory(game, declared == 0 ? "declared no blockers" : "declared " + declared + " blocker(s)");
    }

    @Override
    public int chooseReplacementEffect(Map<String, String> effectsMap, Map<String, MageObject> objectsMap, Game game) {
        logCall("chooseReplacementEffect");
        return super.chooseReplacementEffect(effectsMap, objectsMap, game);
    }

    @Override
    public Mode chooseMode(Modes modes, Ability source, Game game) {
        logCall("chooseMode");
        if (modes.size() <= 1) {
            return super.chooseMode(modes, source, game);
        }

        JsonObject envelope = GameStateSerializer.serializeChooseMode(
                game, this, source, modes, "Choose a mode for " + source + ".", notes, historySnapshot());
        Optional<LLMDecisionResponse> maybe = decide(game, envelope);
        if (!maybe.isPresent()) {
            return super.chooseMode(modes, source, game);
        }

        Mode chosen = ModeOptionEnumerator.resolve(modes, maybe.get().choice());
        if (chosen == null) {
            return super.chooseMode(modes, source, game);
        }
        recordHistory(game, "chose mode: " + chosen.getEffects().getText(chosen));
        return chosen;
    }

    @Override
    public TriggeredAbility chooseTriggeredAbility(List<TriggeredAbility> abilities, Game game) {
        logCall("chooseTriggeredAbility");
        return super.chooseTriggeredAbility(abilities, game);
    }

    @Override
    public int getAmount(int min, int max, String message, Ability source, Game game) {
        logCall("getAmount");
        return super.getAmount(min, max, message, source, game);
    }

    @Override
    public List<Integer> getMultiAmountWithIndividualConstraints(Outcome outcome, List<MultiAmountMessage> messages,
                                                                   int totalMin, int totalMax, MultiAmountType type, Game game) {
        logCall("getMultiAmountWithIndividualConstraints");
        return super.getMultiAmountWithIndividualConstraints(outcome, messages, totalMin, totalMax, type, game);
    }

    @Override
    public void sideboard(Match match, Deck deck) {
        logCall("sideboard");
        super.sideboard(match, deck);
    }

    @Override
    public void construct(Tournament tournament, Deck deck) {
        logCall("construct");
        super.construct(tournament, deck);
    }

    @Override
    public void pickCard(List<Card> cards, Deck deck, Draft draft) {
        logCall("pickCard");
        super.pickCard(cards, deck, draft);
    }
}
