import { scryfallImageUrl, type CardView } from "../types/gameView";

interface CardTileProps {
  card: CardView;
  onClick?: (card: CardView) => void;
  selected?: boolean;
}

export function CardTile({ card, onClick, selected }: CardTileProps) {
  const imageUrl = scryfallImageUrl(card);

  return (
    <div
      className={`card-tile${card.tapped ? " tapped" : ""}${selected ? " selected" : ""}`}
      onClick={onClick ? () => onClick(card) : undefined}
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
