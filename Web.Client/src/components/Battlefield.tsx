import type { CardsView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface BattlefieldProps {
  cards: CardsView;
}

const LAND_TYPE = "Land";

export function Battlefield({ cards }: BattlefieldProps) {
  const list = Object.values(cards);
  const lands = list.filter((c) => c.types?.includes(LAND_TYPE));
  const nonLands = list.filter((c) => !c.types?.includes(LAND_TYPE));

  return (
    <div className="battlefield">
      <div className="battlefield-row lands">
        {lands.map((card) => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
      <div className="battlefield-row permanents">
        {nonLands.map((card) => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
