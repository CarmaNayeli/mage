package mage.web.gateway;

import org.apache.log4j.Logger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The gateway's production entry point: an always-on WebSocket server, one
 * {@link GatewaySession} per browser connection, each bridging to its own JBoss-Remoting
 * session against Mage.Server. Replaces {@link SmokeTestCli}'s one-shot proof-of-concept
 * as the module's real {@code main} class - SmokeTestCli is kept around as a standalone
 * debugging tool (invoke it directly by class name), not wired to anything anymore.
 *
 * @author CarmaNayeli
 */
public final class GatewayServer extends WebSocketServer {

    private static final Logger logger = Logger.getLogger(GatewayServer.class);

    private final String mageHost;
    private final int magePort;
    private final Map<WebSocket, GatewaySession> sessions = new ConcurrentHashMap<>();

    public GatewayServer(int listenPort, String mageHost, int magePort) {
        super(new InetSocketAddress("0.0.0.0", listenPort));
        this.mageHost = mageHost;
        this.magePort = magePort;
    }

    public static void main(String[] args) {
        if (args.length < 3) {
            System.err.println("Usage: GatewayServer <listenPort> <mageHost> <magePort>");
            System.exit(1);
            return;
        }
        int listenPort = Integer.parseInt(args[0]);
        String mageHost = args[1];
        int magePort = Integer.parseInt(args[2]);

        DeckValidatorRegistration.registerAll();

        GatewayServer server = new GatewayServer(listenPort, mageHost, magePort);
        server.start();
    }

    @Override
    public void onStart() {
        logger.info("Gateway WebSocket server listening on port " + getPort() + ", bridging to " + mageHost + ":" + magePort);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        GatewaySession session = new GatewaySession(mageHost, magePort, conn::send);
        sessions.put(conn, session);
        logger.info("Browser connected: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        GatewaySession session = sessions.get(conn);
        if (session != null) {
            session.handleMessage(message);
        }
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        GatewaySession session = sessions.remove(conn);
        if (session != null) {
            session.close();
        }
        logger.info("Browser disconnected: " + reason);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        logger.error("WebSocket error" + (conn == null ? "" : " on " + conn.getRemoteSocketAddress()), ex);
    }
}
