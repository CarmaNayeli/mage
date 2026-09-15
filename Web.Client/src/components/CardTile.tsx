import { scryfallImageUrl, type CardView } from "../types/gameView";

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
  const imageUrl = scryfallImageUrl(card);

  return (
    <div
      className={`card-tile${card.tapped ? " tapped" : ""}${selected ? " selected" : ""}${playable ? " playable" : ""}`}
      onClick={onClick ? () => onClick(card) : undefined}
      onMouseEnter={onHover ? () => onHover(card) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      title={card.name}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={card.name} loading="lazy" />
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
