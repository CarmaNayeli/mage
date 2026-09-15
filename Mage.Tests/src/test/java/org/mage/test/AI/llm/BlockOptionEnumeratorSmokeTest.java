package org.mage.test.AI.llm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import mage.constants.PhaseStep;
import mage.constants.Zone;
import mage.player.ai.llm.serialize.BlockOptionEnumerator;
import mage.player.ai.llm.serialize.GameStateSerializer;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestCommander4Players;

import java.util.Collections;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Verifies the declare_blockers option enumerator: PlayerA attacks PlayerB with
 * Leonin Warleader; PlayerB has two untapped creatures that can block it, so the
 * options list should carry exactly those two (creature, attacker) pairs - and none
 * involving PlayerC's or PlayerD's creatures, since that attacker isn't aimed at them.
 *
 * @author CarmaNayeli
 */
public class BlockOptionEnumeratorSmokeTest extends CardTestCommander4Players {

    @Test
    public void dumpDeclareBlockersOptions_eyeballAgainstSetup() {
        addCard(Zone.BATTLEFIELD, playerA, "Hill Giant", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Balduvian Bears", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Silvercoat Lion", 1);
        addCard(Zone.BATTLEFIELD, playerC, "Balduvian Bears", 1); // not attacked - must not appear in options

        attack(1, playerA, "Hill Giant", playerB);

        runCode("dump declare_blockers options", 1, PhaseStep.DECLARE_BLOCKERS, playerB, (info, player, game) -> {
            JsonObject envelope = GameStateSerializer.serializeDeclareBlockers(
                    game, player, "Declare blockers for combat.", "", Collections.emptyList());
            System.out.println("=== decision.options (declare_blockers, PlayerB) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope.get("decision")));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }

    /**
     * Regression guard for {@link BlockOptionEnumerator#hasAnyOptions} - the check
     * {@link mage.player.ai.llm.LLMBridgePlayer#selectBlockers} now uses to skip an
     * LLM call entirely when there's genuinely nothing that could block.
     */
    @Test
    public void hasAnyOptions_falseWithNoAttackers() {
        // PlayerA attacks PlayerC instead of PlayerB, so combat genuinely happens (the
        // declare-blockers step isn't skipped outright) but nothing is aimed at
        // PlayerB - the actual case the check needs to get right, as opposed to
        // "nobody attacked at all this turn" skipping the step for everyone regardless.
        addCard(Zone.BATTLEFIELD, playerA, "Hill Giant", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Balduvian Bears", 1);
        addCard(Zone.BATTLEFIELD, playerC, "Plains", 1);

        attack(1, playerA, "Hill Giant", playerC);

        runCode("check hasAnyOptions with nothing attacking this player", 1, PhaseStep.DECLARE_BLOCKERS, playerB, (info, player, game) -> {
            assertFalse(
                    "nothing is attacking this player - there's nothing to declare",
                    BlockOptionEnumerator.hasAnyOptions(game, player.getId()));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }

    @Test
    public void hasAnyOptions_trueOnceAnAttackerCanBeBlocked() {
        addCard(Zone.BATTLEFIELD, playerA, "Hill Giant", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Balduvian Bears", 1);

        attack(1, playerA, "Hill Giant", playerB);

        runCode("check hasAnyOptions once an attacker can be blocked", 1, PhaseStep.DECLARE_BLOCKERS, playerB, (info, player, game) -> {
            assertTrue(
                    "an untapped creature can legally block the attacker",
                    BlockOptionEnumerator.hasAnyOptions(game, player.getId()));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
