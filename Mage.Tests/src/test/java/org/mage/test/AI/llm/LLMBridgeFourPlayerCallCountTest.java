package org.mage.test.AI.llm;

import mage.constants.PhaseStep;
import mage.constants.RangeOfInfluence;
import mage.constants.Zone;
import mage.player.ai.llm.LLMBridgePlayer;
import org.junit.Test;
import org.mage.test.player.TestPlayer;
import org.mage.test.serverside.base.CardTestCommander4Players;

/**
 * "First evening" step 3 from xmage-llm-bridge-design.md: all four seats run on
 * LLMBridgePlayer, fully autonomous, for several turns of a real multiplayer game.
 * Every overridden decision method logs a call; dumping {@link LLMBridgePlayer#printCallCounts()}
 * after the run is the census that tells us which methods are actually noisy enough
 * to matter, so the escalation filter gets tuned against real numbers instead of guesses.
 *
 * @author CarmaNayeli
 */
public class LLMBridgeFourPlayerCallCountTest extends CardTestCommander4Players {

    @Override
    protected TestPlayer createPlayer(String name, RangeOfInfluence rangeOfInfluence) {
        TestPlayer testPlayer = new TestPlayer(new LLMBridgePlayer(name, rangeOfInfluence));
        testPlayer.setAIPlayer(true);
        return testPlayer;
    }

    @Test
    public void fourSeatsOnLLMBridgePlayer_censusDecisionMethodCalls() {
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

        System.out.println("=== LLMBridgePlayer decision-method call counts (4p, 6 turns) ===");
        LLMBridgePlayer.printCallCounts();
    }
}
