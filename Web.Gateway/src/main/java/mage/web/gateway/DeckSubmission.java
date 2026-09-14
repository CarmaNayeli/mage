package mage.web.gateway;

import mage.cards.decks.Deck;
import mage.cards.decks.DeckCardLists;
import mage.cards.decks.DeckValidator;
import mage.cards.decks.DeckValidatorError;
import mage.cards.decks.DeckValidatorFactory;
import mage.cards.decks.importer.TxtDeckImporter;
import mage.game.GameException;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns a pasted, plain "N Card Name"-style decklist (what a player copies straight out
 * of a deckbuilding site) into a validated {@link Deck}, reusing XMage's own import and
 * legality pipeline instead of reimplementing decklist parsing.
 * <p>
 * {@link mage.cards.decks.importer.PlainTextDeckImporter#importDeck} is file-path based,
 * so the pasted text is staged to a short-lived temp file first - the only new plumbing
 * here, everything else (parsing, card lookup, format legality) is existing engine code.
 *
 * @author CarmaNayeli
 */
public final class DeckSubmission {

    public static final class Result {
        /**
         * The validated deck, or {@code null} if parsing/validation failed - check
         * {@link #errors} either way, since a successful parse can still carry
         * warnings.
         */
        public final Deck deck;
        public final List<String> errors;

        private Result(Deck deck, List<String> errors) {
            this.deck = deck;
            this.errors = errors;
        }
    }

    private DeckSubmission() {
    }

    public static Result parseAndValidate(String decklistText, String deckTypeName) {
        List<String> errors = new ArrayList<>();

        File tempFile;
        try {
            tempFile = File.createTempFile("web-gateway-deck", ".txt");
            Files.write(tempFile.toPath(), decklistText.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            errors.add("Could not stage the decklist for import: " + e.getMessage());
            return new Result(null, errors);
        }

        try {
            StringBuilder importErrors = new StringBuilder();
            DeckCardLists deckCardLists = new TxtDeckImporter(false).importDeck(tempFile.getAbsolutePath(), importErrors, false);
            if (importErrors.length() > 0) {
                errors.add(importErrors.toString().trim());
            }
            if (deckCardLists.getCards().isEmpty()) {
                errors.add("No cards recognized in the decklist.");
                return new Result(null, errors);
            }

            Deck deck = Deck.load(deckCardLists, false, false);

            DeckValidator validator = DeckValidatorFactory.instance.createDeckValidator(deckTypeName);
            if (validator != null && !validator.validate(deck)) {
                for (DeckValidatorError error : validator.getErrorsListSorted()) {
                    errors.add(error.getMessage());
                }
                return new Result(null, errors);
            }

            return new Result(deck, errors);
        } catch (GameException e) {
            errors.add(e.getMessage());
            return new Result(null, errors);
        } finally {
            tempFile.delete();
        }
    }
}
