/**
 * Provisional TypeScript shapes mirroring mage.view.GameView and friends
 * (Mage.Common/src/main/java/mage/view/). Hand-written from the Java source, not
 * codegenned and not yet validated against a real GAME_UPDATE payload (the deployed
 * smoke test hadn't reached a live game when this was written - see
 * xmage-llm-bridge-design.md's sibling plan doc for the web client). Expect drift:
 * revisit every field here against an actual dump before trusting it in production
 * rendering logic, per the web-client plan's own "not codegenned initially" call.
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
  exiles: ExileView[];
  revealed: RevealedView[];
  lookedAt: RevealedView[];
  companion: RevealedView[];
  combat: CombatGroupView[];
  phase: string;
  step: string;
  activePlayerId: UUID;
  activePlayerName: string;
  priorityPlayerName: string;
  turn: number;
  special: boolean;
  rollbackTurnsAllowed: boolean;
}

/** A CardsView is a Map<UUID, CardView> on the Java side - id-keyed, not an array. */
export type CardsView = Record<UUID, CardView>;
export type SimpleCardsView = Record<UUID, unknown>;

export interface PlayerView {
  playerId: UUID;
  name: string;
  life: number;
  human: boolean;
  inGame: boolean;
  hasLeft: boolean;
  handCount: number;
  graveyard: CardsView;
  battlefield: CardsView;
  manaPool?: Record<string, number>;
  // PlayerView carries substantially more fields (commander info, counters, designations,
  // topCard when revealed, etc.) not yet captured here - add as real payloads need them.
  [key: string]: unknown;
}

export interface CardView {
  id: UUID;
  name: string;
  displayName?: string;
  power?: string;
  toughness?: string;
  manaCost?: string[];
  types?: string[];
  subTypes?: string[];
  tapped?: boolean;
  controllerId?: UUID;
  ownerId?: UUID;
  /** Set code + collector number, when known - enough to build a Scryfall image URL. */
  expansionSetCode?: string;
  cardNumber?: string;
  rules?: string[];
  [key: string]: unknown;
}

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
