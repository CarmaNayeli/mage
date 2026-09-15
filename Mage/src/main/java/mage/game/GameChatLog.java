package mage.game;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A small, capped, per-game buffer of real table talk (chat a human player actually
 * typed) - written by the server's chat layer ({@code mage.server.ChatSession}, on a
 * TALK message tied to a game's own chat session) and read by an AI seat (e.g.
 * {@code LLMBridgePlayer}, in Mage.Server.Plugins/Mage.Player.AI.LLM) so it can react
 * to what a human said.
 * <p>
 * Deliberately NOT part of {@link GameState}: that gets deep-copied constantly for AI
 * simulation/lookahead and rollback, and chat has no business riding along on every one
 * of those copies (or being erased by a rollback, for that matter - a message someone
 * actually sent isn't part of the rules state to undo). This is a plain, cheap
 * side-channel keyed by the same game id both a server-side chat broadcast and a
 * mid-game AI player already have on hand, living in this module (Mage) rather than
 * either of the two that actually use it, since neither depends on the other.
 * <p>
 * Entries are capped ({@link #MAX_ENTRIES}) since this is meant to be "recent
 * conversation," not a transcript - and {@link #clear} should be called once a game
 * ends, or this leaks one entry per game for the life of the server process.
 */
public final class GameChatLog {

    private static final int MAX_ENTRIES = 20;
    private static final Map<UUID, Deque<String>> logs = new ConcurrentHashMap<>();

    private GameChatLog() {
    }

    public static void record(UUID gameId, String from, String message) {
        if (gameId == null || message == null || message.isEmpty()) {
            return;
        }
        Deque<String> log = logs.computeIfAbsent(gameId, id -> new ArrayDeque<>());
        synchronized (log) {
            log.addLast((from == null || from.isEmpty() ? "" : from + ": ") + message);
            while (log.size() > MAX_ENTRIES) {
                log.removeFirst();
            }
        }
    }

    /**
     * Oldest first. Empty (never a null list) if nothing's been said, or the game id
     * isn't recognized.
     */
    public static List<String> recent(UUID gameId) {
        Deque<String> log = logs.get(gameId);
        if (log == null) {
            return Collections.emptyList();
        }
        synchronized (log) {
            return new ArrayList<>(log);
        }
    }

    public static void clear(UUID gameId) {
        logs.remove(gameId);
    }
}
