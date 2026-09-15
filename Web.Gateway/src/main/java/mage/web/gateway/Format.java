package mage.web.gateway;

/**
 * The formats offered by the pre-game screen. Bundles the two strings each one maps
 * to: {@code deckType} for {@link mage.game.match.MatchOptions#setDeckType} /
 * {@link mage.cards.decks.DeckValidatorFactory} (deck-legality checking), and
 * {@code gameType} for {@link mage.game.match.MatchOptions#setGameType} (table
 * rules). For every format except Commander these two are independent concerns -
 * only the deck-legality check changes, the underlying game stays a plain two-player
 * duel. Commander needs both to change together: singleton/commander-zone deck rules
 * AND 40-life/command-zone table rules.
 *
 * @author CarmaNayeli
 */
public enum Format {
    FREEFORM("freeform", "Freeform (no restrictions)", "Constructed - Freeform Unlimited", "Two Player Duel"),
    STANDARD("standard", "Standard", "Constructed - Standard", "Two Player Duel"),
    PIONEER("pioneer", "Pioneer", "Constructed - Pioneer", "Two Player Duel"),
    MODERN("modern", "Modern", "Constructed - Modern", "Two Player Duel"),
    LEGACY("legacy", "Legacy", "Constructed - Legacy", "Two Player Duel"),
    VINTAGE("vintage", "Vintage", "Constructed - Vintage", "Two Player Duel"),
    PAUPER("pauper", "Pauper", "Constructed - Pauper", "Two Player Duel"),
    COMMANDER("commander", "Commander", "Variant Magic - Commander", "Commander Two Player Duel");

    public final String id;
    public final String displayName;
    public final String deckType;
    public final String gameType;

    Format(String id, String displayName, String deckType, String gameType) {
        this.id = id;
        this.displayName = displayName;
        this.deckType = deckType;
        this.gameType = gameType;
    }

    public boolean isCommander() {
        return this == COMMANDER;
    }

    public static Format byId(String id) {
        for (Format format : values()) {
            if (format.id.equals(id)) {
                return format;
            }
        }
        return FREEFORM;
    }
}
