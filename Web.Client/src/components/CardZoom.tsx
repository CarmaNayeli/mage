import { scryfallImageUrl, type CardView } from "../types/gameView";
import { stripHtmlTags } from "../utils/text";

interface CardZoomProps {
  card: CardView;
}

/** A large preview of one card - shown while the zoom key (Z) is held down over it
 * (see Board.tsx's keyboard shortcut handling), since card tiles on the board are too
 * small to read rules text off of.
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
  const imageUrl = scryfallImageUrl(card);

  return (
    <div className="card-zoom-backdrop">
      <div className="card-zoom">
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} />
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
