package org.mage.test.AI.llm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import mage.constants.PhaseStep;
import mage.constants.Zone;
import mage.player.ai.llm.serialize.Glossary;
import mage.player.ai.llm.serialize.PermanentSerializer;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestPlayerBase;

/**
 * "First evening" step 4 from xmage-llm-bridge-design.md: serialize you.battlefield
 * only, dump it to stdout, eyeball it against what the addCard calls below actually
 * put on the table.
 *
 * @author CarmaNayeli
 */
public class PermanentSerializerSmokeTest extends CardTestPlayerBase {

    @Test
    public void dumpBattlefieldJson_eyeballAgainstSetup() {
        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 3);
        addCard(Zone.BATTLEFIELD, playerA, "Regal Caracal", 1);
        addCard(Zone.BATTLEFIELD, playerB, "Balduvian Bears", 1);

        addCounters(1, PhaseStep.PRECOMBAT_MAIN, playerA, "Regal Caracal", mage.counters.CounterType.P1P1, 2);

        runCode("dump you.battlefield", 1, PhaseStep.POSTCOMBAT_MAIN, playerA, (info, player, game) -> {
            JsonArray battlefield = PermanentSerializer.serializeControlledBattlefield(game, player.getId(), new Glossary());
            System.out.println("=== you.battlefield (PlayerA) ===");
            System.out.println(new GsonBuilder().setPrettyPrinting().create().toJson(battlefield));
        });

        setStrictChooseMode(true);
        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();
    }
}
