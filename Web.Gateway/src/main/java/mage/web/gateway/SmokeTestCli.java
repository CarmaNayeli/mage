package mage.web.gateway;

import mage.cards.decks.Deck;
import mage.constants.MultiplayerAttackOption;
import mage.constants.RangeOfInfluence;
import mage.constants.SkillLevel;
import mage.game.match.MatchOptions;
import mage.game.mulligan.MulliganType;
import mage.interfaces.callback.ClientCallback;
import mage.players.PlayerType;
import mage.players.net.UserData;
import mage.players.net.UserGroup;
import mage.players.net.UserSkipPrioritySteps;
import mage.remote.Connection;
import mage.remote.Session;
import mage.remote.SessionImpl;

import java.util.UUID;

/**
 * Phase 1's "first concrete milestone" from the web-client plan: connect to a real,
 * already-running Mage.Server exactly as {@code Mage.Client} would, create a two-player
 * duel table with one human seat (this process, standing in for a browser) and one
 * {@link PlayerType#LLM_BRIDGE} seat, submit a real decklist for the human seat, and
 * dump every translated {@link ClientCallback} to stdout.
 * <p>
 * No WebSocket, no React - this only exists to prove the JBoss-Remoting connection, the
 * session/table/deck plumbing, and {@link ClientCallbackTranslator}'s JSON conversion
 * all work end to end against the real server before any browser-facing code is built
 * on top of them.
 * <p>
 * Usage: {@code java -cp ... mage.web.gateway.SmokeTestCli <host> <port> <decklistFile>}
 *
 * @author CarmaNayeli
 */
public final class SmokeTestCli {

    private SmokeTestCli() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: SmokeTestCli <host> <port> <decklistFile>");
            System.exit(1);
            return;
        }
        String host = args[0];
        int port = Integer.parseInt(args[1]);
        String decklistPath = args[2];

        String decklistText = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(decklistPath)),
                java.nio.charset.StandardCharsets.UTF_8);

        DeckSubmission.Result deckResult = DeckSubmission.parseAndValidate(decklistText, "Constructed - Freeform Unlimited");
        if (deckResult.deck == null) {
            System.err.println("Deck import/validation failed: " + deckResult.errors);
            System.exit(1);
            return;
        }
        if (!deckResult.errors.isEmpty()) {
            System.out.println("Deck import warnings: " + deckResult.errors);
        }
        Deck deck = deckResult.deck;

        GatewayMageClient client = new GatewayMageClient(callback -> {
            System.out.println("<< " + ClientCallbackTranslator.toJson(callback));
        });

        Session session = new SessionImpl(client);

        Connection connection = new Connection();
        connection.setHost(host);
        connection.setPort(port);
        connection.setUsername("WebGatewaySmokeTest");
        connection.setPassword("");
        connection.setProxyType(Connection.ProxyType.NONE);
        connection.setUserData(defaultUserData());

        System.out.println(">> connecting to " + host + ':' + port + " ...");
        boolean connected = session.connectStart(connection);
        if (!connected) {
            System.err.println("Failed to connect/log in.");
            System.exit(1);
            return;
        }
        System.out.println(">> connected, session id: " + session.getSessionId());

        UUID roomId = session.getMainRoomId();
        System.out.println(">> main room id: " + roomId);

        MatchOptions matchOptions = new MatchOptions("Web gateway smoke test", "Two Player Duel", false);
        matchOptions.setAttackOption(MultiplayerAttackOption.LEFT);
        matchOptions.setRange(RangeOfInfluence.ONE);
        matchOptions.setDeckType("Constructed - Freeform Unlimited");
        matchOptions.setSkillLevel(SkillLevel.CASUAL);
        matchOptions.setMullgianType(MulliganType.GAME_DEFAULT);

        UUID tableId = session.createTable(roomId, matchOptions).getTableId();
        System.out.println(">> table created: " + tableId);

        boolean joinedAsHuman = session.joinTable(roomId, tableId, connection.getUsername(),
                PlayerType.HUMAN, 0, deck.prepareCardsOnlyDeck(), "");
        System.out.println(">> joined as human: " + joinedAsHuman);

        boolean joinedLlmSeat = session.joinTable(roomId, tableId, "Practice Bot",
                PlayerType.LLM_BRIDGE, 0, deck.prepareCardsOnlyDeck(), "");
        System.out.println(">> joined LLM_BRIDGE seat: " + joinedLlmSeat);

        System.out.println(">> waiting for callbacks - Ctrl+C to stop");
        Thread.sleep(Long.MAX_VALUE);
    }

    private static UserData defaultUserData() {
        UserData userData = UserData.getDefaultUserDataView();
        userData.setGroupId(UserGroup.PLAYER.getGroupId());
        userData.setUserSkipPrioritySteps(new UserSkipPrioritySteps());
        return userData;
    }
}
