package mage.player.ai.llm;

import mage.MageObject;
import mage.abilities.Ability;
import mage.abilities.TriggeredAbility;
import mage.abilities.costs.mana.ManaCost;
import mage.cards.Card;
import mage.cards.Cards;
import mage.cards.decks.Deck;
import mage.choices.Choice;
import mage.constants.MultiAmountType;
import mage.constants.Outcome;
import mage.constants.RangeOfInfluence;
import mage.game.Game;
import mage.game.draft.Draft;
import mage.game.match.Match;
import mage.game.tournament.Tournament;
import mage.player.ai.ComputerPlayer;
import mage.target.Target;
import mage.target.TargetAmount;
import mage.target.TargetCard;
import mage.util.MultiAmountMessage;

import java.io.Serializable;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import java.util.stream.Collectors;

/**
 * AI: bridges decisions out to an external LLM sidecar over the request/response
 * envelope described in xmage-llm-bridge-design.md.
 * <p>
 * "First evening" step 3: every overridable decision method is instrumented with a
 * call counter and still delegates straight to {@link ComputerPlayer}'s own logic -
 * no behavior change yet. Play a real game and read {@link #printCallCounts()} to see
 * which methods actually get exercised; that's what the escalation filter gets tuned
 * against later.
 *
 * @author CarmaNayeli
 */
public class LLMBridgePlayer extends ComputerPlayer {

    private static final Map<String, LongAdder> callCounts = new ConcurrentHashMap<>();

    /**
     * Design principle 5: the bridge is stateless per call but the game isn't. This is
     * the model's own scratchpad - threat assessment, grudges, deals - rewritten
     * wholesale each response and fed back on the next call.
     */
    private String notes = "";

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
    }

    @Override
    public LLMBridgePlayer copy() {
        return new LLMBridgePlayer(this);
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

    @Override
    public boolean chooseTarget(Outcome outcome, Target target, Ability source, Game game) {
        logCall("chooseTarget(Target)");
        return super.chooseTarget(outcome, target, source, game);
    }

    @Override
    public boolean chooseTargetAmount(Outcome outcome, TargetAmount target, Ability source, Game game) {
        logCall("chooseTargetAmount");
        return super.chooseTargetAmount(outcome, target, source, game);
    }

    @Override
    public boolean priority(Game game) {
        logCall("priority");
        return super.priority(game);
    }

    @Override
    public boolean playMana(Ability ability, ManaCost unpaid, String promptText, Game game) {
        logCall("playMana");
        return super.playMana(ability, unpaid, promptText, game);
    }

    @Override
    public int announceX(int min, int max, String message, Game game, Ability source, boolean isManaPay) {
        logCall("announceX");
        return super.announceX(min, max, message, game, source, isManaPay);
    }

    @Override
    public boolean chooseUse(Outcome outcome, String message, Ability source, Game game) {
        logCall("chooseUse(simple)");
        return super.chooseUse(outcome, message, source, game);
    }

    @Override
    public boolean chooseUse(Outcome outcome, String message, String secondMessage, String trueText, String falseText, Ability source, Game game) {
        logCall("chooseUse(worded)");
        return super.chooseUse(outcome, message, secondMessage, trueText, falseText, source, game);
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
        super.selectAttackers(game, attackingPlayerId);
    }

    @Override
    public void selectBlockers(Ability source, Game game, UUID defendingPlayerId) {
        logCall("selectBlockers");
        super.selectBlockers(source, game, defendingPlayerId);
    }

    @Override
    public int chooseReplacementEffect(Map<String, String> effectsMap, Map<String, MageObject> objectsMap, Game game) {
        logCall("chooseReplacementEffect");
        return super.chooseReplacementEffect(effectsMap, objectsMap, game);
    }

    @Override
    public mage.abilities.Mode chooseMode(mage.abilities.Modes modes, Ability source, Game game) {
        logCall("chooseMode");
        return super.chooseMode(modes, source, game);
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
