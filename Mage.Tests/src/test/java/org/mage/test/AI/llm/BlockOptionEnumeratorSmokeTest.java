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
}
