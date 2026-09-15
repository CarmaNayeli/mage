import { scryfallImageUrl, type CardView } from "../types/gameView";
import { stripHtmlTags } from "../utils/text";

interface CardZoomProps {
  card: CardView;
  onClose: () => void;
}

/** A large preview of one card - opened by pressing the zoom key (Z) while hovering
 * it (see Board.tsx's keyboard shortcut handling), since card tiles on the board are
 * too small to read rules text off of. */
export function CardZoom({ card, onClose }: CardZoomProps) {
  const imageUrl = scryfallImageUrl(card);

  return (
    <div className="card-zoom-backdrop" onClick={onClose}>
      <div className="card-zoom" onClick={(e) => e.stopPropagation()}>
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
