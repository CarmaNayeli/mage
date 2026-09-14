package mage.server.game;

import mage.constants.RangeOfInfluence;
import mage.player.ai.llm.LLMBridgePlayer;
import mage.players.Player;
import mage.players.PlayerType;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the reflection-based instantiation {@link PlayerFactory#createPlayer} does for
 * every registered {@link PlayerType} - added alongside registering
 * {@link PlayerType#LLM_BRIDGE}, since a mismatched constructor signature here would
 * otherwise only surface as a silent "PlayerFactory error" log line at runtime (the
 * factory swallows the reflection exception - see {@code createPlayer}'s catch block)
 * rather than a build failure.
 */
class PlayerFactoryTest {

    @Test
    void createsAnLLMBridgePlayerOnceRegisteredForItsPlayerType() {
        PlayerFactory.instance.addPlayerType(PlayerType.LLM_BRIDGE.toString(), LLMBridgePlayer.class);

        Optional<Player> player = PlayerFactory.instance.createPlayer(
                PlayerType.LLM_BRIDGE, "Test Bot", RangeOfInfluence.ONE, 5);

        assertThat(player).isPresent();
        assertThat(player.get()).isInstanceOf(LLMBridgePlayer.class);
        assertThat(player.get().getName()).isEqualTo("Test Bot");
    }
}
