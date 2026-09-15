package mage.web.gateway;

import java.util.regex.Pattern;

/**
 * Shared by {@link GatewaySession} (sanitizing a per-game display name so it passes
 * config.xml's constraints - 3-14 chars, lowercase, {@code [^a-z0-9_]} invalid) and
 * {@link AccountStore} (an account's username doubles as its on-disk folder name,
 * which needs the exact same treatment, plus it becomes the player's default display
 * name once logged in - one sanitizer, not two that could quietly drift apart).
 *
 * @author CarmaNayeli
 */
final class Usernames {

    private static final Pattern INVALID_USERNAME_CHARS = Pattern.compile("[^a-z0-9_]");

    private Usernames() {
    }

    static String sanitize(String raw) {
        String lower = (raw == null ? "" : raw).trim().toLowerCase();
        String cleaned = INVALID_USERNAME_CHARS.matcher(lower).replaceAll("_");
        if (cleaned.length() < 3) {
            cleaned = (cleaned + "___").substring(0, 3);
        }
        if (cleaned.length() > 14) {
            cleaned = cleaned.substring(0, 14);
        }
        return cleaned;
    }
}
