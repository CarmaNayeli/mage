package mage.web.gateway;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Real, server-persisted accounts (name + password + settings), backed by plain files
 * on the Fly volume mounted at {@code /data} (see fly.toml's {@code [mounts]} - a Fly
 * volume is pinned to a single machine, which is why this app runs on exactly one now).
 * No database: an account is a folder, its decks are the same plain-text decklists the
 * join screen already accepts (with two optional {@code # name:}/{@code # format:}
 * header lines this store writes and understands, so a hand-dropped `.txt` file with
 * no headers at all still works - it just falls back to the filename for a name and
 * whatever format the join screen already has selected).
 * <p>
 * Layout under the base directory:
 * <pre>
 * accounts/&lt;username&gt;/account.json   {passwordHash, createdAt}
 * accounts/&lt;username&gt;/settings.json  arbitrary small JSON blob (tableTalk, ...)
 * accounts/&lt;username&gt;/decks/*.txt    one file per saved deck
 * tokens/&lt;token&gt;                     file's own content is the username it belongs to
 * </pre>
 * Session tokens are their own tiny files rather than a field inside account.json so a
 * lookup is a single file read by token, not a scan of every account.
 * <p>
 * One process (a single Fly machine), traffic-light hobby app - a single coarse lock
 * for every mutation is simpler than per-account locking and the contention it's
 * guarding against essentially never happens here.
 *
 * @author CarmaNayeli
 */
final class AccountStore {

    private static final Logger logger = Logger.getLogger(AccountStore.class);
    private static final Pattern NAME_HEADER = Pattern.compile("^#\\s*name:\\s*(.+)$");
    private static final Pattern FORMAT_HEADER = Pattern.compile("^#\\s*format:\\s*(.+)$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Path accountsDir;
    private final Path tokensDir;
    private final Object lock = new Object();

    static final class AccountResult {
        final boolean ok;
        final String error;
        final String username;
        final String token;
        final JsonObject settings;

        private AccountResult(boolean ok, String error, String username, String token, JsonObject settings) {
            this.ok = ok;
            this.error = error;
            this.username = username;
            this.token = token;
            this.settings = settings;
        }

        static AccountResult ok(String username, String token, JsonObject settings) {
            return new AccountResult(true, null, username, token, settings);
        }

        static AccountResult error(String message) {
            return new AccountResult(false, message, null, null, null);
        }
    }

    static final class DeckSummary {
        final String name;
        final String format;

        DeckSummary(String name, String format) {
            this.name = name;
            this.format = format;
        }
    }

    static final class DeckContent {
        final String name;
        final String format;
        final String deck;

        DeckContent(String name, String format, String deck) {
            this.name = name;
            this.format = format;
            this.deck = deck;
        }
    }

    AccountStore() {
        this(Paths.get(System.getenv().getOrDefault("XEFFIGY_DATA_DIR", "/data")));
    }

    AccountStore(Path baseDir) {
        this.accountsDir = baseDir.resolve("accounts");
        this.tokensDir = baseDir.resolve("tokens");
        try {
            Files.createDirectories(accountsDir);
            Files.createDirectories(tokensDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not create account storage directories under " + baseDir, e);
        }
    }

    AccountResult register(String rawUsername, String password) {
        String username = Usernames.sanitize(rawUsername);
        if (password == null || password.isEmpty()) {
            return AccountResult.error("Password can't be empty.");
        }
        synchronized (lock) {
            Path accountDir = accountsDir.resolve(username);
            if (Files.exists(accountDir)) {
                return AccountResult.error("That username is taken.");
            }
            try {
                Files.createDirectories(accountDir.resolve("decks"));
                JsonObject account = new JsonObject();
                account.addProperty("passwordHash", PasswordHasher.hash(password));
                account.addProperty("createdAt", Instant.now().toString());
                writeJson(accountDir.resolve("account.json"), account);

                JsonObject settings = defaultSettings();
                writeJson(accountDir.resolve("settings.json"), settings);

                String token = issueToken(username);
                return AccountResult.ok(username, token, settings);
            } catch (IOException e) {
                logger.error("Failed to register account " + username, e);
                return AccountResult.error("Couldn't create that account - try again.");
            }
        }
    }

    AccountResult login(String rawUsername, String password) {
        String username = Usernames.sanitize(rawUsername);
        synchronized (lock) {
            Path accountFile = accountsDir.resolve(username).resolve("account.json");
            if (!Files.exists(accountFile)) {
                return AccountResult.error("No account with that username.");
            }
            try {
                JsonObject account = readJson(accountFile);
                String storedHash = account.get("passwordHash").getAsString();
                if (!PasswordHasher.verify(password == null ? "" : password, storedHash)) {
                    return AccountResult.error("Wrong password.");
                }
                String token = issueToken(username);
                return AccountResult.ok(username, token, getSettings(username));
            } catch (IOException | JsonSyntaxException e) {
                logger.error("Failed to read account " + username, e);
                return AccountResult.error("Couldn't log in - try again.");
            }
        }
    }

    /**
     * Silent (returns {@code null}, not an error result) - called automatically on
     * every connect if the browser has a stored token, so an invalid/expired one
     * should just fall through to "not logged in" rather than surface as a visible
     * error the player never asked for.
     */
    AccountResult loginWithToken(String token) {
        if (token == null || token.isEmpty()) {
            return null;
        }
        synchronized (lock) {
            String username = readToken(token);
            if (username == null) {
                return null;
            }
            return AccountResult.ok(username, token, getSettings(username));
        }
    }

    void logout(String token) {
        if (token == null) {
            return;
        }
        synchronized (lock) {
            deleteIfExists(tokenFile(token));
        }
    }

    JsonObject getSettings(String username) {
        synchronized (lock) {
            Path file = accountsDir.resolve(username).resolve("settings.json");
            try {
                return Files.exists(file) ? readJson(file) : defaultSettings();
            } catch (IOException e) {
                logger.warn("Failed to read settings for " + username + ", using defaults", e);
                return defaultSettings();
            }
        }
    }

    /**
     * Merges {@code updates} into the existing settings (only the keys provided
     * change) and returns the full, resulting settings object.
     */
    JsonObject updateSettings(String username, JsonObject updates) {
        synchronized (lock) {
            JsonObject settings = getSettings(username);
            for (String key : updates.keySet()) {
                settings.add(key, updates.get(key));
            }
            try {
                writeJson(accountsDir.resolve(username).resolve("settings.json"), settings);
            } catch (IOException e) {
                logger.error("Failed to write settings for " + username, e);
            }
            return settings;
        }
    }

    void saveDeck(String username, String name, String format, String deckText) {
        synchronized (lock) {
            Path decksDir = accountsDir.resolve(username).resolve("decks");
            String slug = slugify(name);
            StringBuilder content = new StringBuilder();
            content.append("# name: ").append(name).append('\n');
            if (format != null && !format.isEmpty()) {
                content.append("# format: ").append(format).append('\n');
            }
            content.append(deckText == null ? "" : deckText);
            try {
                Files.createDirectories(decksDir);
                Files.write(decksDir.resolve(slug + ".txt"), content.toString().getBytes(StandardCharsets.UTF_8));
            } catch (IOException e) {
                logger.error("Failed to save deck \"" + name + "\" for " + username, e);
            }
        }
    }

    List<DeckSummary> listDecks(String username) {
        synchronized (lock) {
            Path decksDir = accountsDir.resolve(username).resolve("decks");
            List<DeckSummary> result = new ArrayList<>();
            if (!Files.isDirectory(decksDir)) {
                return result;
            }
            try (DirectoryStream<Path> files = Files.newDirectoryStream(decksDir, "*.txt")) {
                for (Path file : files) {
                    DeckContent parsed = readDeckFile(file);
                    result.add(new DeckSummary(parsed.name, parsed.format));
                }
            } catch (IOException e) {
                logger.error("Failed to list decks for " + username, e);
            }
            result.sort((a, b) -> a.name.compareToIgnoreCase(b.name));
            return result;
        }
    }

    DeckContent loadDeck(String username, String name) {
        synchronized (lock) {
            Path file = findDeckFile(username, name);
            if (file == null) {
                return null;
            }
            try {
                return readDeckFile(file);
            } catch (IOException e) {
                logger.error("Failed to load deck \"" + name + "\" for " + username, e);
                return null;
            }
        }
    }

    void deleteDeck(String username, String name) {
        synchronized (lock) {
            Path file = findDeckFile(username, name);
            if (file != null) {
                deleteIfExists(file);
            }
        }
    }

    private Path findDeckFile(String username, String name) {
        Path decksDir = accountsDir.resolve(username).resolve("decks");
        // Fast path: this store's own saveDeck() names the file after a slug of the
        // display name, so most lookups resolve without scanning the directory at all.
        Path bySlug = decksDir.resolve(slugify(name) + ".txt");
        if (Files.exists(bySlug)) {
            return bySlug;
        }
        // Slow path: a hand-dropped file whose name doesn't match its own header (or
        // has none) - fall back to matching every file's parsed display name.
        if (!Files.isDirectory(decksDir)) {
            return null;
        }
        try (DirectoryStream<Path> files = Files.newDirectoryStream(decksDir, "*.txt")) {
            for (Path file : files) {
                if (readDeckFile(file).name.equalsIgnoreCase(name)) {
                    return file;
                }
            }
        } catch (IOException e) {
            logger.error("Failed to search decks for " + username, e);
        }
        return null;
    }

    private static DeckContent readDeckFile(Path file) throws IOException {
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        String name = null;
        String format = null;
        int bodyStart = 0;
        for (String line : lines) {
            java.util.regex.Matcher nameMatch = NAME_HEADER.matcher(line);
            java.util.regex.Matcher formatMatch = FORMAT_HEADER.matcher(line);
            if (nameMatch.matches()) {
                name = nameMatch.group(1).trim();
                bodyStart++;
            } else if (formatMatch.matches()) {
                format = formatMatch.group(1).trim();
                bodyStart++;
            } else {
                break;
            }
        }
        if (name == null) {
            String fileName = file.getFileName().toString();
            name = fileName.endsWith(".txt") ? fileName.substring(0, fileName.length() - 4) : fileName;
        }
        String body = String.join("\n", lines.subList(Math.min(bodyStart, lines.size()), lines.size()));
        return new DeckContent(name, format, body);
    }

    private String issueToken(String username) throws IOException {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Files.write(tokenFile(token), username.getBytes(StandardCharsets.UTF_8));
        return token;
    }

    private String readToken(String token) {
        Path file = tokenFile(token);
        if (!Files.exists(file)) {
            return null;
        }
        try {
            return new String(Files.readAllBytes(file), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            logger.warn("Failed to read token file", e);
            return null;
        }
    }

    private Path tokenFile(String token) {
        // Tokens are generated here (URL-safe base64 of random bytes), never taken raw
        // from elsewhere as a path component, so there's no path-traversal surface -
        // still, resolve() against a fixed directory rather than any string concat.
        return tokensDir.resolve(token);
    }

    private static void deleteIfExists(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            logger.warn("Failed to delete " + path, e);
        }
    }

    private static JsonObject defaultSettings() {
        JsonObject settings = new JsonObject();
        settings.addProperty("tableTalk", false);
        return settings;
    }

    private static String slugify(String name) {
        String slug = name.toLowerCase().trim().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        return slug.isEmpty() ? "deck" : slug;
    }

    private static JsonObject readJson(Path file) throws IOException {
        String content = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
        return JsonParser.parseString(content).getAsJsonObject();
    }

    private static void writeJson(Path file, JsonObject json) throws IOException {
        Files.write(file, json.toString().getBytes(StandardCharsets.UTF_8));
    }
}
