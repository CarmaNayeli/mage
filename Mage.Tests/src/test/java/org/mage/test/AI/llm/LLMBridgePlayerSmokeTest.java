package org.mage.test.AI.llm;

import mage.constants.PhaseStep;
import mage.constants.RangeOfInfluence;
import mage.constants.Zone;
import mage.player.ai.llm.LLMBridgePlayer;
import org.junit.Test;
import org.mage.test.player.TestPlayer;
import org.mage.test.serverside.base.CardTestPlayerBaseAI;

import java.util.Arrays;
import java.util.List;

/**
 * "First evening" smoke test from xmage-llm-bridge-design.md: subclass ComputerPlayer,
 * override nothing, confirm a real game runs on it. Both seats are driven end-to-end
 * by LLMBridgePlayer - if this completes without an unhandled exception, the class is
 * wired correctly and ready for the serializer/escalation work to be layered on top.
 *
 * @author CarmaNayeli
 */
public class LLMBridgePlayerSmokeTest extends CardTestPlayerBaseAI {

    @Override
    public List<String> getFullSimulatedPlayers() {
        return Arrays.asList("PlayerA", "PlayerB");
    }

    @Override
    protected TestPlayer createPlayer(String name, RangeOfInfluence rangeOfInfluence) {
        if (getFullSimulatedPlayers().contains(name)) {
            TestPlayer testPlayer = new TestPlayer(new LLMBridgePlayer(name, RangeOfInfluence.ONE));
            testPlayer.setAIPlayer(true);
            return testPlayer;
        }
        return super.createPlayer(name, rangeOfInfluence);
    }

    @Test
    public void bothSeatsRunOnLLMBridgePlayer_gameProgressesNaturally() {
        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 4);
        addCard(Zone.HAND, playerA, "Lightning Bolt", 2);
        addCard(Zone.BATTLEFIELD, playerA, "Balduvian Bears", 2);

        addCard(Zone.BATTLEFIELD, playerB, "Forest", 4);
        addCard(Zone.BATTLEFIELD, playerB, "Balduvian Bears", 2);

        setStopAt(4, PhaseStep.END_TURN);
        execute();
    }
}
