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
 * Verifies the choose_mode option enumerator against Dromoka's Command's real Modes
 * object (choose two of four) rather than a hand-built stand-in - each option's label
 * should read as the mode's actual effect text, and min/max should both come back 2.
 *
 * @author CarmaNayeli
 */
public class ModeOptionEnumeratorSmokeTest extends CardTestCommander4Players {

    @Test
    public void dumpChooseModeOptions_eyeballAgainstCard() {
        addCard(Zone.BATTLEFIELD, playerA, "Plains", 2);
        addCard(Zone.BATTLEFIELD, playerA, "Forest", 2);
        addCard(Zone.HAND, playerA, "Dromoka's Command", 1);
        addCard(Zone.BATTLEFIELD, playerA, "Balduvian Bears", 1); // "target creature you control"
        addCard(Zone.BATTLEFIELD, playerB, "Storm Crow", 1); // "creature you don't control" + "creature with flying"
        addCard(Zone.BATTLEFIELD, playerC, "Oblivion Ring", 1); // "target player sacrifices an enchantment"

        runCode("dump choose_mode options", 1, PhaseStep.PRECOMBAT_MAIN, playerA, (info, player, game) -> {
            List<ActivatedAbility> playable = player.getPlayable(game, true);
            ActivatedAbility command = playable.stream()
                    .filter(ability -> ability.toString().startsWith("Cast Dromoka's Command"))
                    .findFirst()
                    .orElse(null);
            Assert.assertNotNull("Dromoka's Command should be castable", command);

            JsonObject envelope = GameStateSerializer.serializeChooseMode(
                    game, player, command, command.getModes(),
                    "Choose two modes for Dromoka's Command.", "", Collections.emptyList());
            System.out.println("=== decision.options (choose_mode, Dromoka's Command) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope.get("decision")));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
