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
 * Verifies the choose_use option enumerator: always exactly Yes/No, regardless of
 * game state - there's nothing to enumerate for a boolean decision, so this mostly
 * checks the envelope wires it in correctly under the "choose_use" decision type.
 *
 * @author CarmaNayeli
 */
public class ChooseUseOptionEnumeratorSmokeTest extends CardTestCommander4Players {

    @Test
    public void dumpChooseUseOptions_alwaysYesNo() {
        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 1);

        runCode("dump choose_use options", 1, PhaseStep.PRECOMBAT_MAIN, playerA, (info, player, game) -> {
            JsonObject envelope = GameStateSerializer.serializeChooseUse(
                    game, player, "Discard a card to draw a card?", "", Collections.emptyList());
            System.out.println("=== decision.options (choose_use) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope.get("decision")));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
