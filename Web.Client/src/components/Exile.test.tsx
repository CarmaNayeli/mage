import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CardView } from "../types/gameView";
import { Exile } from "./Exile";

function card(overrides: Partial<CardView> & { id: string; name: string }): CardView {
  return { cardTypes: [], ...overrides };
}

describe("Exile", () => {
  it("always shows an Exile zone, even with nothing exiled", () => {
    render(<Exile exiles={[]} />);
    expect(screen.getByText("Exile (0)")).toBeInTheDocument();
    expect(screen.getByText("Nothing exiled")).toBeInTheDocument();
  });

  it("treats exile entries with no cards the same as no entries at all", () => {
    render(<Exile exiles={[{ id: "exile-1", name: "Exile", cards: {} }]} />);
    expect(screen.getByText("Exile (0)")).toBeInTheDocument();
  });

  it("renders real exiled cards under their zone name", () => {
    render(
      <Exile
        exiles={[{ id: "exile-1", name: "Exile", cards: { "c1": card({ id: "c1", name: "Swords to Plowshares" }) } }]}
      />,
    );
    expect(screen.getByText("Exile")).toBeInTheDocument();
    // getByTitle, not getByText - CardTile tries a Scryfall image before falling back
    // to text (see CardTile.test.tsx), so this fixture (no expansionSetCode/
    // cardNumber) renders as an <img> in this environment, not plain text.
    expect(screen.getByTitle("Swords to Plowshares")).toBeInTheDocument();
  });
});
