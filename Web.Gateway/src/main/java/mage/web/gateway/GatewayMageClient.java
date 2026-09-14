package mage.web.gateway;

import mage.interfaces.MageClient;
import mage.interfaces.callback.ClientCallback;
import mage.utils.MageVersion;
import org.apache.log4j.Logger;

import java.util.function.Consumer;

/**
 * The gateway's implementation of the same client-side interface
 * {@code Mage.Client}'s Swing client implements - this is what makes the gateway a
 * normal remote client of {@code Mage.Server} rather than anything server-side needs
 * to know about. Every server push ({@link #onCallback}) is handed to a
 * {@link Consumer} supplied by whoever owns this client (the CLI harness today, a
 * WebSocket session later) rather than doing any translation itself - this class stays
 * a thin adapter, translation is {@link ClientCallbackTranslator}'s job.
 *
 * @author CarmaNayeli
 */
public class GatewayMageClient implements MageClient {

    private static final Logger logger = Logger.getLogger(GatewayMageClient.class);

    private final MageVersion version = new MageVersion(GatewayMageClient.class);
    private final Consumer<ClientCallback> callbackHandler;

    public GatewayMageClient(Consumer<ClientCallback> callbackHandler) {
        this.callbackHandler = callbackHandler;
    }

    @Override
    public MageVersion getVersion() {
        return version;
    }

    @Override
    public void connected(String message) {
        logger.info("connected: " + message);
    }

    @Override
    public void disconnected(boolean askToReconnect, boolean keepMySessionActive) {
        logger.info("disconnected (askToReconnect=" + askToReconnect + ", keepMySessionActive=" + keepMySessionActive + ")");
    }

    @Override
    public void showMessage(String message) {
        logger.info("server message: " + message);
    }

    @Override
    public void showError(String message) {
        logger.error("server error: " + message);
    }

    @Override
    public void onNewConnection() {
        logger.info("new connection established");
    }

    @Override
    public void onCallback(ClientCallback callback) {
        callback.decompressData();
        callbackHandler.accept(callback);
    }
}
