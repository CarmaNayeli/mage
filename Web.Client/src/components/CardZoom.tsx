import { useEffect, useState } from "react";
import { scryfallImageUrl, scryfallNamedImageUrl, type CardView } from "../types/gameView";
import { stripHtmlTags } from "../utils/text";

interface CardZoomProps {
  card: CardView;
}

/** A large preview of one card - shown while the zoom key (Z) is held down over it
 * (see utils/useCardZoom.ts), since card tiles on the board are too small to read
 * rules text off of.
 *
 * Deliberately `pointer-events: none` (see App.css) - this used to be a clickable
 * backdrop, but a backdrop that can receive the mouse is exactly the bug: appearing
 * on top of the cursor changes what element is "under" it, which fires a real
 * mouseleave on the card being hovered (browsers recompute hover state against
 * whatever's now on top, not just actual pointer movement), clearing the hover that
 * was keeping the zoom open - which closes the overlay, uncovers the card, re-fires
 * mouseenter, reopens it, and so on: a flicker loop, confirmed as the "flashes then
 * disappears" bug. Letting clicks/hover pass straight through avoids it entirely. */
export function CardZoom({ card }: CardZoomProps) {
  const primaryUrl = scryfallImageUrl(card);
  // Same fallback chain as CardTile - independently, since this is a separate <img>
  // (not just a scaled-up copy of the small tile's element) and would otherwise
  // re-attempt the exact set+number URL that already failed there, landing back on
  // plain text even when the tile itself already found real art via the name search.
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [namedFailed, setNamedFailed] = useState(false);
  useEffect(() => {
    setPrimaryFailed(false);
    setNamedFailed(false);
  }, [card.id]);

  const usingNamed = !primaryUrl || primaryFailed;
  const imageUrl = usingNamed ? (namedFailed ? null : scryfallNamedImageUrl(card.name)) : primaryUrl;

  return (
    <div className="card-zoom-backdrop">
      <div className="card-zoom">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.name}
            onError={() => (usingNamed ? setNamedFailed(true) : setPrimaryFailed(true))}
          />
        ) : (
          <div className="card-zoom-fallback">
            <h3>{card.displayName ?? card.name}</h3>
            {(card.power || card.toughness) && (
              <div className="card-zoom-pt">
                {card.power ?? "?"}/{card.toughness ?? "?"}
              </div>
            )}
            {card.rules?.map((line, i) => <p key={i}>{stripHtmlTags(line)}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
