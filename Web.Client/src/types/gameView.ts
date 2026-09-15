/**
 * TypeScript shapes mirroring mage.view.GameView and friends
 * (Mage.Common/src/main/java/mage/view/). Verified against a REAL GAME_UPDATE/
 * GAME_INIT dump from a live local game (join -> mulligan -> priority), captured
 * while building Web.Gateway's real WebSocket server - not guessed. Fields the UI
 * doesn't currently use are covered by each interface's index signature rather than
 * modeled exhaustively; promote one out of the index signature once real code needs
 * it, verifying against a fresh dump first since anything still untyped here remains
 * unconfirmed.
 */

export type UUID = string;

export interface GameView {
  priorityTime: number;
  bufferTime: number;
  players: PlayerView[];
  myPlayerId: UUID | null;
  myHand: CardsView;
  myHelperEmblems: CardsView;
  opponentHands: Record<string, SimpleCardsView>;
  watchedHands: Record<string, SimpleCardsView>;
  stack: CardsView;
  /** Shape unconfirmed - observed as [{}] (empty) in every real dump so far, nothing
   * was ever exiled during that playtest. Don't trust ExileView's fields until a
   * real payload with something actually exiled has been seen. */
  exiles: ExileView[];
  revealed: RevealedView[];
  lookedAt: RevealedView[];
  companion: RevealedView[];
  combat: CombatGroupView[];
  /** Both null until the game actually starts resolving (confirmed at GAME_INIT time). */
  phase: string | null;
  step: string | null;
  activePlayerId: UUID | null;
  activePlayerName: string;
  priorityPlayerName: string;
  turn: number;
  special: boolean;
  rollbackTurnsAllowed: boolean;
  /** Confirmed real and populated once it's a player's turn to act - there's no
   * separate "you may act now" dialog; a GAME_SELECT/GAME_UPDATE with this populated
   * IS the priority window. */
  canPlayObjects: PlayableObjects | null;
  [key: string]: unknown;
}

export interface PlayableObjects {
  objects: Record<UUID, PlayableObjectStats>;
}

/**
 * Keyed by card id - each array holds {id, value} pairs describing ways to play that
 * card (id here is a distinct ability id, value a display label like "Play Forest").
 * Useful for knowing WHAT's playable (e.g. to highlight hand cards), but NOT for how
 * to play it: confirmed against a real local game that the response send_uuid needs
 * is the card's own id, not any of these ability ids - sending an ability id from
 * here silently did nothing (canPlayObjects stayed unchanged, nothing left hand).
 */
export interface PlayableObjectStats {
  basicManaAbilities: PlayableAbility[];
  basicPlayAbilities: PlayableAbility[];
  basicCastAbilities: PlayableAbility[];
  other: PlayableAbility[];
}

export interface PlayableAbility {
  id: UUID;
  value: string;
}

/** A CardsView is a Map<UUID, CardView> on the Java side - id-keyed, not an array. */
export type CardsView = Record<UUID, CardView>;
export type SimpleCardsView = Record<UUID, unknown>;

export interface PlayerView {
  playerId: UUID;
  name: string;
  life: number;
  /** NOT "human" - that was an earlier, wrong guess; every player always rendered as
   * a bot before this was caught against real data (`!player.human` was always true). */
  isHuman: boolean;
  hasLeft: boolean;
  handCount: number;
  graveyard: CardsView;
  battlefield: CardsView;
  /** Always fully populated (all six colors, zero-valued when empty), not sparse. */
  manaPool?: Record<string, number>;
  [key: string]: unknown;
}

export interface CardView {
  id: UUID;
  name: string;
  displayName?: string;
  power?: string;
  toughness?: string;
  /** NOT "types" - that was an earlier, wrong guess. Values are the Java enum's
   * name(), i.e. UPPERCASE ("LAND", "CREATURE", ...), not "Land"/"Creature". */
  cardTypes?: string[];
  subTypes?: string[];
  /** Set code + collector number, when known - enough to build a Scryfall image URL. */
  expansionSetCode?: string;
  cardNumber?: string;
  rules?: string[];
  [key: string]: unknown;
}

export const LAND_CARD_TYPE = "LAND";

export interface CombatGroupView {
  defenderId: UUID;
  attackers: UUID[];
  blockers: UUID[];
  blockedAttackers: Array<[UUID, UUID]>;
  attackerOrder: UUID[];
  blockerOrder: UUID[];
}

export interface ExileView {
  id: UUID;
  name: string;
  cards: CardsView;
}

export interface RevealedView {
  name: string;
  cards: CardsView;
}

/** Builds a hotlinkable Scryfall image URL - no image hosting needed on our side. */
export function scryfallImageUrl(card: Pick<CardView, "expansionSetCode" | "cardNumber">): string | null {
  if (!card.expansionSetCode || !card.cardNumber) {
    return null;
  }
  return `https://api.scryfall.com/cards/${card.expansionSetCode.toLowerCase()}/${card.cardNumber}/en?format=image`;
}
