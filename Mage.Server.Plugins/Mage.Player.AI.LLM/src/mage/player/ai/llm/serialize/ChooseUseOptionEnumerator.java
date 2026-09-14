package mage.player.ai.llm.serialize;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * chooseUse is always a yes/no decision (optional costs, "may" effects) - the engine
 * doesn't enumerate anything here since there's nothing to enumerate, but the shape
 * stays consistent with every other decision type: an indexed options list the model
 * picks from rather than a bare boolean it has to get exactly right.
 *
 * @author CarmaNayeli
 */
public final class ChooseUseOptionEnumerator {

    private ChooseUseOptionEnumerator() {
    }

    public static JsonArray enumerate() {
        JsonArray options = new JsonArray();

        JsonObject yes = new JsonObject();
        yes.addProperty("index", 0);
        yes.addProperty("label", "Yes");
        yes.addProperty("action", "yes");
        options.add(yes);

        JsonObject no = new JsonObject();
        no.addProperty("index", 1);
        no.addProperty("label", "No");
        no.addProperty("action", "no");
        options.add(no);

        return options;
    }
}
