package mage.web.gateway;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import mage.interfaces.callback.ClientCallback;
import org.apache.log4j.Logger;

/**
 * Turns a {@link ClientCallback} - the server's own push envelope, tagged by
 * {@link mage.interfaces.callback.ClientCallbackMethod} - into the JSON envelope a
 * browser gets over WebSocket: {@code {"type": "<method name>", "objectId": ...,
 * "data": {...}}}.
 * <p>
 * Deliberately plain reflection-based Gson, not the {@code @Expose}-restricted instance
 * {@link mage.view.GameView#toJson} uses internally for its own debug logging feature -
 * that one only serializes a hand-picked subset of fields, but a real client needs the
 * whole view. The real risk this class exists to catch: XMage's view classes weren't
 * written with "must Gson-serialize cleanly" as a design constraint (unlike the
 * envelope in xmage-llm-bridge-design.md, which was designed JSON-first from day one),
 * so a circular reference or an unexpected field type could throw here. Failing loud
 * with the callback's method name attached beats a silent hang on the browser side.
 *
 * @author CarmaNayeli
 */
public final class ClientCallbackTranslator {

    private static final Logger logger = Logger.getLogger(ClientCallbackTranslator.class);

    private static final Gson GSON = new GsonBuilder().serializeNulls().create();

    private ClientCallbackTranslator() {
    }

    public static String toJson(ClientCallback callback) {
        JsonObject envelope = new JsonObject();
        envelope.addProperty("type", callback.getMethod().name());
        envelope.addProperty("objectId", callback.getObjectId() == null ? null : callback.getObjectId().toString());
        try {
            envelope.add("data", GSON.toJsonTree(callback.getData()));
        } catch (RuntimeException e) {
            logger.error("Failed to serialize callback data for " + callback.getMethod(), e);
            envelope.addProperty("data", (String) null);
            envelope.addProperty("serializationError", e.toString());
        }
        return GSON.toJson(envelope);
    }
}
