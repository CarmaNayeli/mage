import { beforeEach, describe, expect, it } from "vitest";
import { deleteDeck, listSavedDecks, saveDeck } from "./savedDecks";

beforeEach(() => {
  localStorage.clear();
});

describe("savedDecks", () => {
  it("starts empty", () => {
    expect(listSavedDecks()).toEqual([]);
  });

  it("saves and lists a deck, sorted by name", () => {
    saveDeck({ name: "Burn", format: "standard", playerDeck: "20 Mountain", sideboard: "" });
    saveDeck({ name: "Aggro", format: "modern", playerDeck: "20 Forest", sideboard: "" });
    expect(listSavedDecks().map((d) => d.name)).toEqual(["Aggro", "Burn"]);
  });

  it("overwrites a deck saved under the same name", () => {
    saveDeck({ name: "Burn", format: "standard", playerDeck: "20 Mountain", sideboard: "" });
    saveDeck({ name: "Burn", format: "standard", playerDeck: "18 Mountain\n2 Forest", sideboard: "" });
    const decks = listSavedDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].playerDeck).toBe("18 Mountain\n2 Forest");
  });

  it("deletes a deck by name", () => {
    saveDeck({ name: "Burn", format: "standard", playerDeck: "20 Mountain", sideboard: "" });
    deleteDeck("Burn");
    expect(listSavedDecks()).toEqual([]);
  });
});
