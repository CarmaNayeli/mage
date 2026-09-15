package mage.game;

import org.junit.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * Custom unit tests for {@link GameChatLog}.
 */
public class GameChatLogTest {

    @Test
    public void recentIsEmptyForAnUnknownGame() {
        assertTrue(GameChatLog.recent(UUID.randomUUID()).isEmpty());
    }

    @Test
    public void recordsMessagesOldestFirstPrefixedWithSender() {
        UUID gameId = UUID.randomUUID();
        try {
            GameChatLog.record(gameId, "carma", "gg already?");
            GameChatLog.record(gameId, "carma", "you're going down");

            List<String> recent = GameChatLog.recent(gameId);
            assertEquals(2, recent.size());
            assertEquals("carma: gg already?", recent.get(0));
            assertEquals("carma: you're going down", recent.get(1));
        } finally {
            GameChatLog.clear(gameId);
        }
    }

    @Test
    public void omitsTheSenderPrefixWhenNoneIsGiven() {
        UUID gameId = UUID.randomUUID();
        try {
            GameChatLog.record(gameId, "", "a system-ish message with no sender");
            assertEquals("a system-ish message with no sender", GameChatLog.recent(gameId).get(0));
        } finally {
            GameChatLog.clear(gameId);
        }
    }

    @Test
    public void keepsOnlyTheMostRecentEntries() {
        UUID gameId = UUID.randomUUID();
        try {
            for (int i = 0; i < 30; i++) {
                GameChatLog.record(gameId, "carma", "message " + i);
            }
            List<String> recent = GameChatLog.recent(gameId);
            assertEquals(20, recent.size());
            assertEquals("carma: message 10", recent.get(0));
            assertEquals("carma: message 29", recent.get(recent.size() - 1));
        } finally {
            GameChatLog.clear(gameId);
        }
    }

    @Test
    public void clearRemovesEverythingForThatGame() {
        UUID gameId = UUID.randomUUID();
        GameChatLog.record(gameId, "carma", "gg");
        GameChatLog.clear(gameId);
        assertTrue(GameChatLog.recent(gameId).isEmpty());
    }

    @Test
    public void ignoresEmptyOrNullMessagesAndDoesNotThrowOnANullGameId() {
        UUID gameId = UUID.randomUUID();
        try {
            GameChatLog.record(gameId, "carma", "");
            GameChatLog.record(gameId, "carma", null);
            assertTrue(GameChatLog.recent(gameId).isEmpty());

            GameChatLog.record(null, "carma", "hello?"); // must not throw
        } finally {
            GameChatLog.clear(gameId);
        }
    }

    @Test
    public void gamesDoNotShareEntries() {
        UUID gameA = UUID.randomUUID();
        UUID gameB = UUID.randomUUID();
        try {
            GameChatLog.record(gameA, "carma", "only in game A");
            assertTrue(GameChatLog.recent(gameB).isEmpty());
        } finally {
            GameChatLog.clear(gameA);
            GameChatLog.clear(gameB);
        }
    }
}
