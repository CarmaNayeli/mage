package mage.web.gateway;

import mage.cards.decks.DeckValidatorFactory;

/**
 * Registers the deck-legality validators the pre-game screen's format selector needs.
 * Mage.Server normally does this itself, reading config.xml's {@code <deckType>}
 * entries at startup and loading each one as an external plugin jar via
 * {@code PluginUtil} - the gateway never runs any of that, so
 * {@link DeckValidatorFactory#instance}'s type map stays empty unless something
 * populates it. Direct compile-time class references here instead of the
 * plugin-loading machinery, since {@code mage-deck-constructed} is just a normal
 * Maven dependency for this module (see pom.xml) - simpler than replicating
 * Mage.Server's dynamic classloader for a small, known set of formats.
 *
 * @author CarmaNayeli
 */
final class DeckValidatorRegistration {

    private DeckValidatorRegistration() {
    }

    static void registerAll() {
        DeckValidatorFactory.instance.addDeckType(Format.STANDARD.deckType, mage.deck.Standard.class);
        DeckValidatorFactory.instance.addDeckType(Format.PIONEER.deckType, mage.deck.Pioneer.class);
        DeckValidatorFactory.instance.addDeckType(Format.MODERN.deckType, mage.deck.Modern.class);
        DeckValidatorFactory.instance.addDeckType(Format.LEGACY.deckType, mage.deck.Legacy.class);
        DeckValidatorFactory.instance.addDeckType(Format.VINTAGE.deckType, mage.deck.Vintage.class);
        DeckValidatorFactory.instance.addDeckType(Format.PAUPER.deckType, mage.deck.Pauper.class);
        DeckValidatorFactory.instance.addDeckType(Format.FREEFORM.deckType, mage.deck.FreeformUnlimited.class);
        DeckValidatorFactory.instance.addDeckType(Format.COMMANDER.deckType, mage.deck.Commander.class);
    }
}
