package mage.web.gateway;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.constants.ManaType;
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
import org.apache.log4j.Logger;

import java.util.UUID;
import java.util.function.Consumer;

/**
 * One instance per browser WebSocket connection - owns a single JBoss-Remoting
 * {@link Session} to Mage.Server, same role {@link SmokeTestCli}'s one-shot main()
 * played, but long-lived and driven by real incoming WS messages instead of a canned
 * decklist file and a hardcoded username.
 * <p>
 * The wire protocol from the browser is deliberately NOT a generic "answer_dialog by
 * index" (an earlier, incorrect guess) - the real {@code Session} API is typed
 * ({@code sendPlayerUUID}/{@code Boolean}/{@code Integer}/{@code String}/
 * {@code ManaType}), and every dialog-shaped {@link ClientCallback} (GAME_TARGET,
 * GAME_ASK, GAME_SELECT, GAME_CHOOSE_ABILITY, GAME_PLAY_MANA, ...) maps to exactly one
 * of those five regardless of which dialog triggered it - so the browser just needs to
 * pick the right one of these five generic calls per dialog type it renders, mirroring
 * what the Swing client's click handlers do.
 *
 * @author CarmaNayeli
 */
final class GatewaySession {

    private static final Logger logger = Logger.getLogger(GatewaySession.class);
    /** File-backed, stateless, one process (a single Fly machine) - shared across every
     * session rather than one instance each, same reasoning as the class's own javadoc. */
    private static final AccountStore accountStore = new AccountStore();

    private final String mageHost;
    private final int magePort;
    private final Consumer<String> outbound;

    private Session session;
    /**
     * Captured from the first GAME_*-family callback carrying a non-null objectId
     * (GAME_INIT fires first) - every subsequent {@code sendPlayer*} call needs this,
     * and there's no dedicated "here is your game id" push distinct from that
     * convention (confirmed by ClientCallbackTranslator/GameSessionPlayer both tagging
     * objectId as the relevant game's id for GAME_* methods).
     */
    private volatile UUID gameId;
    /** The game's chat channel, joined once {@link #gameId} is first captured (see
     * {@link #onCallback}) - needed to let the player actually talk back, not just
     * receive the game's own log/the bot's table talk. */
    private volatile UUID chatId;
    /** Set once this connection is logged into an account (see "login"/"register"/
     * "login_with_token") - null means playing as a guest, same as before accounts
     * existed at all. */
    private volatile String accountUsername;
    private volatile String accountToken;

    GatewaySession(String mageHost, int magePort, Consumer<String> outbound) {
        this.mageHost = mageHost;
        this.magePort = magePort;
        this.outbound = outbound;
    }

    void handleMessage(String rawJson) {
        JsonObject action;
        try {
            action = JsonParser.parseString(rawJson).getAsJsonObject();
        } catch (RuntimeException e) {
            logger.warn("Malformed action from client: " + rawJson, e);
            return;
        }

        String call = action.has("call") ? action.get("call").getAsString() : null;
        JsonArray args = action.has("args") ? action.getAsJsonArray("args") : new JsonArray();

        try {
            switch (call == null ? "" : call) {
                case "join_practice_table":
                    joinPracticeTable(args.get(0).getAsJsonObject());
                    break;
                case "send_uuid":
                    requireGame();
                    session.sendPlayerUUID(gameId, UUID.fromString(args.get(0).getAsString()));
                    break;
                case "send_boolean":
                    requireGame();
                    session.sendPlayerBoolean(gameId, args.get(0).getAsBoolean());
                    break;
                case "send_integer":
                    requireGame();
                    session.sendPlayerInteger(gameId, args.get(0).getAsInt());
                    break;
                case "send_string":
                    requireGame();
                    session.sendPlayerString(gameId, args.get(0).getAsString());
                    break;
                case "send_mana_type":
                    requireGame();
                    session.sendPlayerManaType(gameId, UUID.fromString(args.get(0).getAsString()),
                            ManaType.valueOf(args.get(1).getAsString()));
                    break;
                case "chat":
                    // Only meaningful once the game's chat has actually been joined
                    // (see onCallback) - silently drop anything sent before that, same
                    // as every other call here requiring requireGame().
                    if (chatId != null && session != null) {
                        session.sendChatMessage(chatId, args.get(0).getAsString());
                    }
                    break;
                case "concede":
                    // Mirrors the Swing client's CLIENT_CONCEDE_MATCH (MageFrame.java) -
                    // our practice tables are single-game matches, so conceding the
                    // match is the same as conceding the one game on it, and this is
                    // the one call that works whether or not gameId has been captured
                    // yet (e.g. the player bails from the join screen before any
                    // GAME_INIT ever arrived).
                    if (gameId != null && session != null) {
                        session.quitMatch(gameId);
                    }
                    break;
                case "register":
                    handleAccountResult(accountStore.register(
                            getString(args.get(0).getAsJsonObject(), "username", ""),
                            getString(args.get(0).getAsJsonObject(), "password", "")));
                    break;
                case "login":
                    handleAccountResult(accountStore.login(
                            getString(args.get(0).getAsJsonObject(), "username", ""),
                            getString(args.get(0).getAsJsonObject(), "password", "")));
                    break;
                case "login_with_token": {
                    // Silent on failure (an expired/invalid stored token just means
                    // "play as a guest," not an error worth interrupting anyone with) -
                    // sent automatically on connect if the browser has a token saved,
                    // not from a user action.
                    AccountStore.AccountResult result = accountStore.loginWithToken(args.get(0).getAsString());
                    if (result != null) {
                        handleAccountResult(result);
                    }
                    break;
                }
                case "logout":
                    accountStore.logout(accountToken);
                    accountUsername = null;
                    accountToken = null;
                    sendEnvelope("ACCOUNT_LOGGED_OUT", null);
                    break;
                case "save_deck":
                    requireAccount();
                    JsonObject deckToSave = args.get(0).getAsJsonObject();
                    accountStore.saveDeck(accountUsername,
                            getString(deckToSave, "name", "deck"),
                            getString(deckToSave, "format", null),
                            getString(deckToSave, "deck", ""));
                    sendDeckList();
                    break;
                case "list_decks":
                    requireAccount();
                    sendDeckList();
                    break;
                case "load_deck": {
                    requireAccount();
                    AccountStore.DeckContent deck = accountStore.loadDeck(accountUsername, args.get(0).getAsString());
                    if (deck == null) {
                        sendGatewayError("No saved deck named \"" + args.get(0).getAsString() + "\".");
                    } else {
                        JsonObject data = new JsonObject();
                        data.addProperty("name", deck.name);
                        data.addProperty("format", deck.format);
                        data.addProperty("deck", deck.deck);
                        sendEnvelope("ACCOUNT_DECK", data);
                    }
                    break;
                }
                case "delete_deck":
                    requireAccount();
                    accountStore.deleteDeck(accountUsername, args.get(0).getAsString());
                    sendDeckList();
                    break;
                case "update_settings":
                    requireAccount();
                    JsonObject settings = accountStore.updateSettings(accountUsername, args.get(0).getAsJsonObject());
                    sendEnvelope("ACCOUNT_SETTINGS", settings);
                    break;
                default:
                    logger.warn("Unknown call from client: " + call);
            }
        } catch (RuntimeException e) {
            logger.error("Failed to handle client action \"" + call + "\"", e);
        }
    }

    void close() {
        if (session != null) {
            session.connectStop(false, false);
        }
    }

    private void requireGame() {
        if (gameId == null) {
            throw new IllegalStateException("No active game on this connection yet");
        }
    }

    private void requireAccount() {
        if (accountUsername == null) {
            throw new IllegalStateException("Not logged into an account on this connection");
        }
    }

    private void handleAccountResult(AccountStore.AccountResult result) {
        if (!result.ok) {
            sendGatewayError(result.error);
            return;
        }
        accountUsername = result.username;
        accountToken = result.token;
        JsonObject data = new JsonObject();
        data.addProperty("username", result.username);
        data.addProperty("token", result.token);
        data.add("settings", result.settings);
        sendEnvelope("ACCOUNT_LOGGED_IN", data);
    }

    private void sendDeckList() {
        JsonArray decks = new JsonArray();
        for (AccountStore.DeckSummary deck : accountStore.listDecks(accountUsername)) {
            JsonObject entry = new JsonObject();
            entry.addProperty("name", deck.name);
            entry.addProperty("format", deck.format);
            decks.add(entry);
        }
        sendEnvelope("ACCOUNT_DECKS", decks);
    }

    /**
     * {@code request} shape: {@code {playerName, format, playerDeck, opponentMode,
     * opponentDeck?, difficulty?}}. {@code opponentMode} is one of "provide" (use
     * {@code opponentDeck}), "basic" (a bundled fixed decklist, see
     * {@link BasicDecks}), or "counter" (Claude analyzes {@code playerDeck} and
     * builds one at the requested {@code difficulty}, see
     * {@link CounterDeckGenerator}).
     */
    private void joinPracticeTable(JsonObject request) {
        String playerName = Usernames.sanitize(getString(request, "playerName", ""));
        Format format = Format.byId(getString(request, "format", "freeform"));
        String playerDeckText = getString(request, "playerDeck", "");
        String opponentMode = getString(request, "opponentMode", "basic");
        String difficulty = getString(request, "difficulty", "medium");

        sendProgress("Validating your deck…");
        DeckSubmission.Result playerDeckResult = DeckSubmission.parseAndValidate(playerDeckText, format.deckType);
        if (playerDeckResult.deck == null) {
            sendGatewayError("Your deck: " + String.join("; ", playerDeckResult.errors));
            return;
        }

        DeckSubmission.Result opponentDeckResult = resolveOpponentDeck(request, format, playerDeckText, opponentMode, difficulty);
        if (opponentDeckResult.deck == null) {
            sendGatewayError("Opponent deck: " + String.join("; ", opponentDeckResult.errors));
            return;
        }

        sendProgress("Connecting to the game server…");
        GatewayMageClient client = new GatewayMageClient(this::onCallback);
        session = new SessionImpl(client);

        Connection connection = new Connection();
        connection.setHost(mageHost);
        connection.setPort(magePort);
        connection.setUsername(playerName);
        connection.setPassword("");
        connection.setProxyType(Connection.ProxyType.NONE);
        connection.setUserData(defaultUserData());

        if (!session.connectStart(connection)) {
            sendGatewayError("Could not connect to the game server as \"" + playerName + "\".");
            return;
        }

        sendProgress("Creating your table…");
        UUID roomId = session.getMainRoomId();

        MatchOptions matchOptions = new MatchOptions("Practice table", format.gameType, false);
        matchOptions.setAttackOption(MultiplayerAttackOption.LEFT);
        matchOptions.setRange(RangeOfInfluence.ONE);
        matchOptions.setDeckType(format.deckType);
        matchOptions.setSkillLevel(SkillLevel.CASUAL);
        matchOptions.setMullgianType(MulliganType.GAME_DEFAULT);
        // Default quit ratio requirement is 0% (never having quit) - a practice tool
        // where visitors routinely just close the tab mid-game would otherwise lock
        // a returning player out of ever creating another table (confirmed locally:
        // one abrupt disconnect raised the quit ratio to 100%, and the next
        // createTable failed with "Your quit ratio 100% is higher than the table
        // requirement 0%"). 100 here means "no requirement."
        matchOptions.setQuitRatio(100);
        // Table.numSeats/seats[] are built from this list at construction time, and
        // getNextAvailableSeat() matches a joinTable call's PlayerType against a
        // seat's PRE-DECLARED type with `==` - leaving this empty (MatchOptions'
        // default) creates a table with zero seats and every joinTable call fails
        // with "No available seats" (the bug SmokeTestCli originally had).
        matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
        matchOptions.getPlayerTypes().add(PlayerType.LLM_BRIDGE);

        UUID tableId = session.createTable(roomId, matchOptions).getTableId();

        sendProgress("Seating you at the table…");
        boolean joinedHuman = session.joinTable(roomId, tableId, playerName, PlayerType.HUMAN, 0,
                playerDeckResult.deck.prepareCardsOnlyDeck(), "");
        if (!joinedHuman) {
            sendGatewayError("Could not join the table as a human player.");
            return;
        }

        sendProgress("Seating the practice bot…");
        boolean joinedBot = session.joinTable(roomId, tableId, "Practice Bot", PlayerType.LLM_BRIDGE, 0,
                opponentDeckResult.deck.prepareCardsOnlyDeck(), "");
        if (!joinedBot) {
            sendGatewayError("Could not seat the practice bot.");
            return;
        }

        sendProgress("Starting the match…");
        session.startMatch(roomId, tableId);
    }

    private DeckSubmission.Result resolveOpponentDeck(JsonObject request, Format format, String playerDeckText,
                                                       String opponentMode, String difficulty) {
        switch (opponentMode) {
            case "provide":
                sendProgress("Validating the opponent's deck…");
                return DeckSubmission.parseAndValidate(getString(request, "opponentDeck", ""), format.deckType);

            case "counter":
                // Up to two attempts at a real Claude call producing something that
                // actually imports/validates - LLM output isn't guaranteed well-formed,
                // and this is going through the exact same import path a human's pasted
                // decklist does, no special trust. Falls back to the fixed basic deck
                // (never fails) rather than blocking the game from starting at all.
                for (int attempt = 1; attempt <= 2; attempt++) {
                    sendProgress(attempt == 1
                            ? "Analyzing your deck and building a " + difficulty + " counter deck…"
                            : "First attempt didn't come out right - trying again…");
                    try {
                        String generated = CounterDeckGenerator.generate(playerDeckText, format, difficulty);
                        sendProgress("Validating the generated deck…");
                        DeckSubmission.Result result = DeckSubmission.parseAndValidate(generated, format.deckType);
                        if (result.deck != null) {
                            return result;
                        }
                        logger.warn("Counter-deck attempt " + attempt + " failed validation: " + result.errors);
                    } catch (RuntimeException e) {
                        logger.error("Counter-deck generation attempt " + attempt + " failed", e);
                    }
                }
                logger.warn("Counter-deck generation failed twice - falling back to the basic deck");
                sendProgress("Counter-deck generation didn't pan out - using a basic deck instead…");
                return DeckSubmission.parseAndValidate(BasicDecks.forFormat(format), format.deckType);

            case "basic":
            default:
                sendProgress("Preparing the opponent's deck…");
                return DeckSubmission.parseAndValidate(BasicDecks.forFormat(format), format.deckType);
        }
    }

    private static String getString(JsonObject obj, String field, String defaultValue) {
        return obj.has(field) && !obj.get(field).isJsonNull() ? obj.get(field).getAsString() : defaultValue;
    }

    private void onCallback(ClientCallback callback) {
        callback.decompressData();
        if (gameId == null && callback.getObjectId() != null && callback.getMethod().name().startsWith("GAME_")) {
            gameId = callback.getObjectId();
            // The game's own log (informPlayers - play-by-play, the LLM bot's "says"
            // lines, timeouts, etc.) is delivered over CHATMESSAGE, but ONLY to users
            // who've explicitly joined that chat (ChatSession.broadcast only fans out
            // to its own users map) - without this, none of it ever reaches the
            // browser, silently, since nothing here ever failed or errored. Keeping
            // the chatId around also lets the player talk back (see "chat" above).
            session.getGameChatId(gameId).ifPresent(id -> {
                chatId = id;
                session.joinChat(id);
            });
        }
        outbound.accept(ClientCallbackTranslator.toJson(callback));
    }

    private void sendGatewayError(String message) {
        logger.warn(message);
        JsonObject envelope = new JsonObject();
        envelope.addProperty("type", "GATEWAY_ERROR");
        envelope.add("objectId", null);
        envelope.addProperty("data", message);
        outbound.accept(envelope.toString());
    }

    /**
     * Granular status while {@code joinPracticeTable} works through its several
     * genuinely slow steps (a real Claude call for "counter" mode can take tens of
     * seconds) - without these the browser has nothing to show but a single static
     * "Joining..." for the whole duration, which reads as hung.
     */
    private void sendProgress(String message) {
        JsonObject envelope = new JsonObject();
        envelope.addProperty("type", "GATEWAY_PROGRESS");
        envelope.add("objectId", null);
        envelope.addProperty("data", message);
        outbound.accept(envelope.toString());
    }

    /** Generic gateway-originated push for anything whose payload isn't a bare string
     * (unlike {@link #sendGatewayError}/{@link #sendProgress}) - the account/deck
     * responses (ACCOUNT_LOGGED_IN, ACCOUNT_DECKS, ACCOUNT_DECK, ACCOUNT_SETTINGS,
     * ACCOUNT_LOGGED_OUT) all carry an object, array, or (for logged-out) nothing. */
    private void sendEnvelope(String type, JsonElement data) {
        JsonObject envelope = new JsonObject();
        envelope.addProperty("type", type);
        envelope.add("objectId", null);
        envelope.add("data", data);
        outbound.accept(envelope.toString());
    }

    private static UserData defaultUserData() {
        UserData userData = UserData.getDefaultUserDataView();
        userData.setGroupId(UserGroup.PLAYER.getGroupId());
        userData.setUserSkipPrioritySteps(new UserSkipPrioritySteps());
        return userData;
    }
}
