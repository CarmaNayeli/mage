package mage.player.ai.llm.client;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * The bridge's whole configuration surface: a real environment variable when set,
 * falling back to a plain {@code KEY=value} line in a {@code .env} file - {@code .env}
 * is already in this repo's {@code .gitignore}. Searches the working directory and its
 * parents so one file at the repo root works whether the server/tests are launched
 * from root or a module subdirectory. No dotenv library dependency for this.
 * <p>
 * Originally just the {@code ANTHROPIC_API_KEY} lookup inside {@link LLMDecisionClient};
 * pulled out so model choice ({@code ANTHROPIC_PRIMARY_MODEL} / {@code
 * ANTHROPIC_ECONOMY_MODEL}) can use the same mechanism instead of duplicating it.
 *
 * @author CarmaNayeli
 */
final class DotEnv {

    private DotEnv() {
    }

    static String get(String key) {
        String fromEnv = System.getenv(key);
        return (fromEnv != null && !fromEnv.isEmpty()) ? fromEnv : readFromDotEnvFile(key);
    }

    static String getOrDefault(String key, String defaultValue) {
        String value = get(key);
        return value != null ? value : defaultValue;
    }

    private static String readFromDotEnvFile(String key) {
        File dir = new File(".").getAbsoluteFile();
        for (int i = 0; i < 8 && dir != null; i++, dir = dir.getParentFile()) {
            File envFile = new File(dir, ".env");
            if (envFile.isFile()) {
                String value = readDotEnvValue(envFile, key);
                if (value != null) {
                    return value;
                }
            }
        }
        return null;
    }

    static String readDotEnvValue(File envFile, String key) {
        try {
            for (String line : Files.readAllLines(envFile.toPath(), StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                int equals = trimmed.indexOf('=');
                if (trimmed.isEmpty() || trimmed.startsWith("#") || equals <= 0
                        || !trimmed.substring(0, equals).trim().equals(key)) {
                    continue;
                }
                String value = trimmed.substring(equals + 1).trim();
                if (value.length() >= 2 && (value.charAt(0) == '"' || value.charAt(0) == '\'')
                        && value.charAt(value.length() - 1) == value.charAt(0)) {
                    value = value.substring(1, value.length() - 1);
                }
                return value.isEmpty() ? null : value;
            }
        } catch (IOException e) {
            return null;
        }
        return null;
    }
}
