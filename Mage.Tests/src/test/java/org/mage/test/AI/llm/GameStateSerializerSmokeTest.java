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
 * "Second evening" full envelope check from xmage-llm-bridge-design.md: assemble the
 * whole request envelope (you/opponents/stack/turn/glossary) for a real 4-player game
 * and dump it to stdout to eyeball against the scripted setup.
 * <p>
 * Regal Caracal is put on two different players' battlefields deliberately - the
 * glossary should still only carry one "c_regalcaracal" entry (principle 3: dedupe
 * card text ruthlessly), and opponents should show hand_count instead of hand
 * contents (principle 1: perspective-relative, always).
 *
 * @author CarmaNayeli
 */
public class GameStateSerializerSmokeTest extends CardTestCommander4Players {

    @Test
    public void dumpFullEnvelope_eyeballAgainstSetup() {
        addCard(Zone.COMMAND, playerA, "Teysa Karlov");
        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 4);
        addCard(Zone.HAND, playerA, "Lightning Bolt", 1);
        addCard(Zone.BATTLEFIELD, playerA, "Regal Caracal", 1);

        addCard(Zone.BATTLEFIELD, playerB, "Forest", 3);
        addCard(Zone.HAND, playerB, "Giant Growth", 2);

        addCard(Zone.BATTLEFIELD, playerC, "Regal Caracal", 1); // same card, different seat - glossary must dedupe
        addCard(Zone.GRAVEYARD, playerC, "Doom Blade", 1);

        addCard(Zone.BATTLEFIELD, playerD, "Swamp", 2);
        addCard(Zone.BATTLEFIELD, playerD, "Grave Pact", 1);

        runCode("dump full envelope", 1, PhaseStep.POSTCOMBAT_MAIN, playerA, (info, player, game) -> {
            JsonObject envelope = GameStateSerializer.serialize(
                    game, player, "priority", "You have priority.", "", Collections.emptyList());
            System.out.println("=== full envelope (PlayerA) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(envelope));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
