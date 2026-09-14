package mage.player.ai.llm.client;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Covers {@link DotEnv#readDotEnvValue} - the fallback for when a config value (the
 * API key, a model override) isn't set as a real environment variable, added because
 * this parsing logic is exactly the kind of thing that silently reads the wrong line
 * (or the wrong key) without anyone noticing until a game tries to call the API.
 */
class DotEnvTest {

    @TempDir
    Path tempDir;

    private File writeEnvFile(String contents) throws IOException {
        File file = tempDir.resolve(".env").toFile();
        Files.write(file.toPath(), contents.getBytes(StandardCharsets.UTF_8));
        return file;
    }

    @Test
    void readsAPlainKeyValueLine() throws IOException {
        File envFile = writeEnvFile("ANTHROPIC_API_KEY=sk-ant-test-123\n");
        assertEquals("sk-ant-test-123", DotEnv.readDotEnvValue(envFile, "ANTHROPIC_API_KEY"));
    }

    @Test
    void stripsMatchingSurroundingQuotes() throws IOException {
        File envFile = writeEnvFile("ANTHROPIC_API_KEY=\"sk-ant-test-123\"\n");
        assertEquals("sk-ant-test-123", DotEnv.readDotEnvValue(envFile, "ANTHROPIC_API_KEY"));
    }

    @Test
    void ignoresCommentsAndBlankLinesAndUnrelatedKeys() throws IOException {
        File envFile = writeEnvFile(String.join("\n",
                "# a comment",
                "",
                "SOME_OTHER_KEY=irrelevant",
                "ANTHROPIC_API_KEY=sk-ant-test-123",
                ""));
        assertEquals("sk-ant-test-123", DotEnv.readDotEnvValue(envFile, "ANTHROPIC_API_KEY"));
    }

    @Test
    void returnsNullWhenKeyIsAbsent() throws IOException {
        File envFile = writeEnvFile("SOME_OTHER_KEY=value\n");
        assertNull(DotEnv.readDotEnvValue(envFile, "ANTHROPIC_API_KEY"));
    }

    @Test
    void returnsNullForAnEmptyValue() throws IOException {
        File envFile = writeEnvFile("ANTHROPIC_API_KEY=\n");
        assertNull(DotEnv.readDotEnvValue(envFile, "ANTHROPIC_API_KEY"));
    }

    @Test
    void trimsWhitespaceAroundTheValue() throws IOException {
        File envFile = writeEnvFile("ANTHROPIC_API_KEY =   sk-ant-test-123  \n");
        assertEquals("sk-ant-test-123", DotEnv.readDotEnvValue(envFile, "ANTHROPIC_API_KEY"));
    }

    @Test
    void readsAModelOverrideKeyJustAsWellAsTheApiKey() throws IOException {
        File envFile = writeEnvFile("ANTHROPIC_PRIMARY_MODEL=claude-sonnet-5\n");
        assertEquals("claude-sonnet-5", DotEnv.readDotEnvValue(envFile, "ANTHROPIC_PRIMARY_MODEL"));
    }
}
