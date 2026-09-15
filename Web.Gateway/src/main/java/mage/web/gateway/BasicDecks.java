package mage.web.gateway;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

/**
 * The "use a basic deck" option's fixed decklists - bundled resources, not generated.
 * Sourced from XMage's own bundled sample decks (Mage.Client/release/sample-decks),
 * stripped of the {@code [SET:NUM]} print-hint syntax {@link mage.cards.decks.importer.TxtDeckImporter}
 * doesn't understand (it re-resolves every card by name anyway via
 * {@code findPreferredCoreExpansionCard}, so the original file's specific
 * printing never mattered). Real, complete, previously-legal constructed/Commander
 * decks - not hand-assembled, so no risk of an invalid count or an accidentally
 * banned/duplicate card.
 * <p>
 * Only two variants for now: one plain constructed decklist (used for every non-
 * Commander format - format-legality is whatever the selected format's validator
 * says, this doesn't try to be Standard-legal specifically) and one Commander
 * decklist (100 cards, singleton, valid commander in the {@code SB:} line).
 *
 * @author CarmaNayeli
 */
final class BasicDecks {

    private BasicDecks() {
    }

    static String forFormat(Format format) {
        String resource = format.isCommander() ? "/decks/basic-commander.txt" : "/decks/basic-constructed.txt";
        try (InputStream in = BasicDecks.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Missing bundled deck resource: " + resource);
            }
            return new String(readAll(in), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read bundled deck resource: " + resource, e);
        }
    }

    // InputStream.readAllBytes() is Java 9+; this module still compiles at
    // --release 8 (see the root pom), so a manual copy loop it is.
    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }
}
