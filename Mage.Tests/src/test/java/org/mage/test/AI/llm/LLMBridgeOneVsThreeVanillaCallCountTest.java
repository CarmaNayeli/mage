package org.mage.test.AI.llm;

import mage.constants.PhaseStep;
import mage.constants.RangeOfInfluence;
import mage.constants.Zone;
import mage.player.ai.llm.LLMBridgePlayer;
import org.junit.Test;
import org.mage.test.player.TestComputerPlayer;
import org.mage.test.player.TestPlayer;
import org.mage.test.serverside.base.CardTestCommander4Players;

/**
 * Design doc's cost mitigation #2: "One LLM bot, two dumb ones... cuts it by two
 * thirds, and honestly a mixed table is a better test anyway - you find out if your
 * bot beats the baseline." Only PlayerA runs on LLMBridgePlayer; PlayerB/C/D run on
 * plain {@link TestComputerPlayer} (a thin ComputerPlayer subclass with no escalation
 * at all - the same base class LLMBridgePlayer itself falls back to on failure, so
 * this is the actual baseline, not a strawman).
 * <p>
 * Cheaper and faster than {@link LLMBridgeFourPlayerCallCountTest}'s all-four-seats
 * version, and still gives a real call-count census for tuning the escalation filter.
 *
 * @author CarmaNayeli
 */
public class LLMBridgeOneVsThreeVanillaCallCountTest extends CardTestCommander4Players {

    @Override
    protected TestPlayer createPlayer(String name, RangeOfInfluence rangeOfInfluence) {
        TestPlayer testPlayer = "PlayerA".equals(name)
                ? new TestPlayer(new LLMBridgePlayer(name, rangeOfInfluence))
                : new TestPlayer(new TestComputerPlayer(name, rangeOfInfluence));
        testPlayer.setAIPlayer(true);
        return testPlayer;
    }

    @Test
    public void llmSeatAmongThreeVanillaSeats_censusDecisionMethodCalls() {
        LLMBridgePlayer.resetCallCounts();

        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 5);
        addCard(Zone.HAND, playerA, "Lightning Bolt", 2);
        addCard(Zone.BATTLEFIELD, playerA, "Leonin Warleader", 1);

        addCard(Zone.BATTLEFIELD, playerB, "Forest", 5);
        addCard(Zone.BATTLEFIELD, playerB, "Balduvian Bears", 2);

        addCard(Zone.BATTLEFIELD, playerC, "Plains", 5);
        addCard(Zone.BATTLEFIELD, playerC, "Regal Caracal", 1);

        addCard(Zone.BATTLEFIELD, playerD, "Swamp", 5);
        addCard(Zone.HAND, playerD, "Doom Blade", 1);
        addCard(Zone.BATTLEFIELD, playerD, "Grave Pact", 1);

        setStopAt(6, PhaseStep.END_TURN);
        execute();

        System.out.println("=== LLMBridgePlayer decision-method call counts (1 LLM seat + 3 vanilla, 6 turns) ===");
        LLMBridgePlayer.printCallCounts();
    }
}
