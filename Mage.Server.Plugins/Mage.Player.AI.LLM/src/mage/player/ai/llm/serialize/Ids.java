package mage.player.ai.llm.serialize;

import java.util.UUID;

/**
 * Short, stable id schemes for the envelope: "p_" for battlefield/stack object
 * instances (permanent identity), "c_" for card glossary keys (shared by every
 * instance of the same named card, which is what makes glossary dedup work).
 */
final class Ids {

    private Ids() {
    }

    static String permanentId(UUID id) {
        return "p_" + id.toString().substring(0, 8);
    }

    static String cardId(String cardName) {
        return "c_" + cardName.toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
