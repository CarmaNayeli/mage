import type { CardView } from "../types/gameView";
import { LAND_CARD_TYPE, type CardsView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface BattlefieldProps {
  cards: CardsView;
  onCardClick?: (card: CardView) => void;
  playableIds?: Set<string>;
  onHover?: (card: CardView | null) => void;
}

export function Battlefield({ cards, onCardClick, playableIds, onHover }: BattlefieldProps) {
  const list = Object.values(cards ?? {});
  const lands = list.filter((c) => c.cardTypes?.includes(LAND_CARD_TYPE));
  const nonLands = list.filter((c) => !c.cardTypes?.includes(LAND_CARD_TYPE));

  const renderCard = (card: CardView) => {
    const playable = playableIds?.has(card.id) ?? false;
    return (
      <CardTile key={card.id} card={card} onClick={playable ? onCardClick : undefined} playable={playable} onHover={onHover} />
    );
  };

  return (
    <div className="battlefield">
      <div className="battlefield-row lands">{lands.map(renderCard)}</div>
      <div className="battlefield-row permanents">{nonLands.map(renderCard)}</div>
    </div>
  );
}
