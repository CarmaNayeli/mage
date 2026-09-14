package mage.server.util;

import mage.server.util.config.Config;
import mage.server.util.config.Plugin;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

public class ConfigFactoryTest {

    @Test
    @DisplayName("should unmarshal configuration from file")
    void loadConfig() {
        final Config config = ConfigFactory.loadFromFile("config/config.xml");

        assertThat(config.getServer().getServerName()).isEqualTo("mage-server");
        assertThat(config.getServer().getPort()).isEqualTo(17171);
    }

    @Test
    @DisplayName("should register the LLM bridge as a selectable player type")
    void loadConfigIncludesLLMBridgePlayerType() {
        final Config config = ConfigFactory.loadFromFile("config/config.xml");

        Plugin llmBridge = config.getPlayerTypes().getPlayerType().stream()
                .filter(p -> "Computer - LLM".equals(p.getName()))
                .findFirst()
                .orElse(null);

        assertThat(llmBridge).isNotNull();
        assertThat(llmBridge.getJar()).isEqualTo("mage-player-ai-llm.jar");
        assertThat(llmBridge.getClassName()).isEqualTo("mage.player.ai.llm.LLMBridgePlayer");
    }

    @Test
    @DisplayName("should fail if config is malformed")
    void failOnMalformed() {
        assertThatExceptionOfType(ConfigurationException.class)
                .isThrownBy(() -> ConfigFactory.loadFromFile(Paths.get("src", "test", "data", "config_error.xml").toString()));
    }

    @Test
    @DisplayName("should fail if file does not exist")
    void failOnNotFound() {
        assertThatExceptionOfType(ConfigurationException.class)
                .isThrownBy(() -> ConfigFactory.loadFromFile("does not exist"));
    }
}
