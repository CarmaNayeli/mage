package org.mage.test.AI.llm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import mage.abilities.ActivatedAbility;
import mage.constants.PhaseStep;
import mage.constants.Zone;
import mage.player.ai.llm.serialize.GameStateSerializer;
import org.junit.Assert;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestCommander4Players;

import java.util.Collections;
import java.util.List;

/**
 * Verifies the choose_target option enumerator against Lightning Bolt's own "any
 * target" Target object (no reimplementation of its targeting rules): with three
 * opponents and no creatures on the battlefield, the only legal targets are the three
 * opposing players.
 *
 * @author CarmaNayeli
 */
public class ChooseTargetOptionEnumeratorSmokeTest extends CardTestCommander4Players {

    @Test
    public void dumpChooseTargetOptions_eyeballAgainstSetup() {
        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 1);
        addCard(Zone.HAND, playerA, "Lightning Bolt", 1);

        runCode("dump choose_target options", 1, PhaseStep.PRECOMBAT_MAIN, playerA, (info, player, game) -> {
            List<ActivatedAbility> playable = player.getPlayable(game, true);
            ActivatedAbility boltAbility = playable.stream()
                    .filter(ability -> ability.toString().startsWith("Cast Lightning Bolt"))
                    .findFirst()
                    .orElse(null);
            Assert.assertNotNull("Lightning Bolt should be castable", boltAbility);

            JsonObject envelope = GameStateSerializer.serializeChooseTarget(
                    game, player, boltAbility, boltAbility.getTargets().get(0),
                    "Choose a target for Lightning Bolt.", "", Collections.emptyList());
            System.out.println("=== decision.options (choose_target, Lightning Bolt) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope.get("decision")));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
