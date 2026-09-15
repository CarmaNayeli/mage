import { useEffect, useState } from "react";
import { scryfallImageUrl, scryfallNamedImageUrl, type CardView } from "../types/gameView";

interface CardTileProps {
  card: CardView;
  onClick?: (card: CardView) => void;
  selected?: boolean;
  /** Highlights cards that are legal to click right now (in canPlayObjects, or a
   * declare-attackers/blockers selection) - without this, nothing on the board hints
   * at what's actually clickable. */
  playable?: boolean;
  /** Reports hover in/out (card, then null) - drives the keyboard shortcuts (zoom,
   * activate-hovered-card) that have nowhere else to know what the mouse is over. */
  onHover?: (card: CardView | null) => void;
}

export function CardTile({ card, onClick, selected, playable, onHover }: CardTileProps) {
  const primaryUrl = scryfallImageUrl(card);
  // Two ways an image can fail to show up: expansionSetCode/cardNumber is missing
  // entirely, or Scryfall just doesn't recognize that exact set+number combo (both
  // real - some prints/promos aren't indexed the same way). Either one falls through
  // to a fuzzy name search, which almost always finds *some* printing to show; only
  // if that ALSO fails does this drop to the plain text tile.
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [namedFailed, setNamedFailed] = useState(false);
  useEffect(() => {
    setPrimaryFailed(false);
    setNamedFailed(false);
  }, [card.id]);

  const usingNamed = !primaryUrl || primaryFailed;
  const imageUrl = usingNamed ? (namedFailed ? null : scryfallNamedImageUrl(card.name)) : primaryUrl;

  return (
    <div
      className={`card-tile${card.tapped ? " tapped" : ""}${selected ? " selected" : ""}${playable ? " playable" : ""}`}
      onClick={onClick ? () => onClick(card) : undefined}
      onMouseEnter={onHover ? () => onHover(card) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      title={card.name}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={card.name}
          loading="lazy"
          onError={() => (usingNamed ? setNamedFailed(true) : setPrimaryFailed(true))}
        />
      ) : (
        <div className="card-tile-fallback">
          <span>{card.displayName ?? card.name}</span>
          {(card.power || card.toughness) && (
            <span className="card-tile-pt">
              {card.power ?? "?"}/{card.toughness ?? "?"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
