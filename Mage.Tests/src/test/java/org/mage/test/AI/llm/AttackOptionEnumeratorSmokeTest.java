package org.mage.test.AI.llm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import mage.constants.PhaseStep;
import mage.constants.Zone;
import mage.player.ai.llm.serialize.AttackOptionEnumerator;
import mage.player.ai.llm.serialize.GameStateSerializer;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestCommander4Players;

import java.util.Collections;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Verifies the declare_attackers option enumerator: PlayerA has two untapped,
 * non-sick creatures in a MultiplayerAttackOption.MULTIPLE game (any opponent is a
 * legal defender), so the options list should carry one entry per (creature,
 * opponent) pair - 2 creatures x 3 opponents = 6 options.
 *
 * @author CarmaNayeli
 */
public class AttackOptionEnumeratorSmokeTest extends CardTestCommander4Players {

    @Test
    public void dumpDeclareAttackersOptions_eyeballAgainstSetup() {
        addCard(Zone.BATTLEFIELD, playerA, "Leonin Warleader", 1);
        addCard(Zone.BATTLEFIELD, playerA, "Balduvian Bears", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Forest", 1);
        addCard(Zone.BATTLEFIELD, playerC, "Plains", 1);
        addCard(Zone.BATTLEFIELD, playerD, "Swamp", 1);

        runCode("dump declare_attackers options", 1, PhaseStep.DECLARE_ATTACKERS, playerA, (info, player, game) -> {
            JsonObject envelope = GameStateSerializer.serializeDeclareAttackers(
                    game, player, "Declare attackers for combat.", "", Collections.emptyList());
            System.out.println("=== decision.options (declare_attackers, PlayerA) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope.get("decision")));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }

    /**
     * Regression guard for {@link AttackOptionEnumerator#hasAnyOptions} - the check
     * {@link mage.player.ai.llm.LLMBridgePlayer#selectAttackers} now uses to skip an
     * LLM call entirely when there's genuinely nothing that could attack.
     */
    @Test
    public void hasAnyOptions_falseWithNoCreatures() {
        addCard(Zone.BATTLEFIELD, playerA, "Plains", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Forest", 1);

        runCode("check hasAnyOptions with nothing on board", 1, PhaseStep.DECLARE_ATTACKERS, playerA, (info, player, game) -> {
            assertFalse(
                    "no creatures at all - there's nothing to declare",
                    AttackOptionEnumerator.hasAnyOptions(game, player.getId(), GameStateSerializer.assignSeats(game)));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }

    @Test
    public void hasAnyOptions_trueOnceACreatureCanAttack() {
        addCard(Zone.BATTLEFIELD, playerA, "Balduvian Bears", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Forest", 1);

        runCode("check hasAnyOptions once a creature can attack", 1, PhaseStep.DECLARE_ATTACKERS, playerA, (info, player, game) -> {
            assertTrue(
                    "an untapped, non-sick creature with a legal opponent to attack exists",
                    AttackOptionEnumerator.hasAnyOptions(game, player.getId(), GameStateSerializer.assignSeats(game)));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
