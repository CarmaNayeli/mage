import type { CardsView, CardView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface HandProps {
  cards: CardsView;
  onCardClick?: (card: CardView) => void;
  playableIds?: Set<string>;
  onHover?: (card: CardView | null) => void;
}

export function Hand({ cards, onCardClick, playableIds, onHover }: HandProps) {
  const list = Object.values(cards ?? {});

  return (
    <div className="hand">
      {list.length === 0 ? (
        <div className="zone-empty">Empty hand</div>
      ) : (
        list.map((card) => {
          const playable = playableIds?.has(card.id) ?? false;
          return (
            <CardTile key={card.id} card={card} onClick={playable ? onCardClick : undefined} playable={playable} onHover={onHover} />
          );
        })
      )}
    </div>
  );
}
