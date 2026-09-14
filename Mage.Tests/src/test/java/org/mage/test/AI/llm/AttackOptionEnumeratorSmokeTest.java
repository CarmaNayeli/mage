package org.mage.test.AI.llm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import mage.constants.PhaseStep;
import mage.constants.Zone;
import mage.player.ai.llm.serialize.GameStateSerializer;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestCommander4Players;

import java.util.Collections;

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
            JsonObject envelope = GameStateSerializer.serialize(
                    game, player, "declare_attackers", "Declare attackers for combat.",
                    "", Collections.emptyList());
            System.out.println("=== decision.options (declare_attackers, PlayerA) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope.get("decision")));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
