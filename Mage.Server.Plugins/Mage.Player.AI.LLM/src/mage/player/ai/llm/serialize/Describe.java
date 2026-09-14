package mage.player.ai.llm.serialize;

import mage.game.Game;

import java.util.UUID;

/**
 * Resolves any object id (player, permanent, stack object, card) to a human-readable
 * label for use in option/target descriptions. Falls back to the short id scheme when
 * the object can't be found (e.g. it left the game between enumeration and lookup).
 */
final class Describe {

    private Describe() {
    }

    static String name(UUID id, Game game) {
        if (game.getPlayer(id) != null) {
            return game.getPlayer(id).getName();
        }
        if (game.getObject(id) != null) {
            return game.getObject(id).getName();
        }
        return Ids.permanentId(id);
    }
}
