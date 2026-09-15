import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CardView } from "../types/gameView";
import { CardTile } from "./CardTile";

describe("CardTile", () => {
  it("renders the direct Scryfall image when expansionSetCode/cardNumber are present", () => {
    const card: CardView = { id: "c1", name: "Lightning Bolt", expansionSetCode: "lea", cardNumber: "161" };
    render(<CardTile card={card} />);
    const img = screen.getByAltText("Lightning Bolt") as HTMLImageElement;
    expect(img.src).toBe("https://api.scryfall.com/cards/lea/161/en?format=image");
  });

  it("falls back to a fuzzy name search when expansionSetCode/cardNumber is missing entirely", () => {
    const card: CardView = { id: "c1", name: "Skyhunter Skirmisher" };
    render(<CardTile card={card} />);
    const img = screen.getByAltText("Skyhunter Skirmisher") as HTMLImageElement;
    expect(img.src).toBe("https://api.scryfall.com/cards/named?fuzzy=Skyhunter%20Skirmisher&format=image");
  });

  it("falls back to a fuzzy name search when the direct image 404s, then to the plain text tile if that also fails", () => {
    const card: CardView = { id: "c1", name: "Skyhunter Skirmisher", expansionSetCode: "bad", cardNumber: "999" };
    render(<CardTile card={card} />);

    const primaryImg = screen.getByAltText("Skyhunter Skirmisher") as HTMLImageElement;
    expect(primaryImg.src).toBe("https://api.scryfall.com/cards/bad/999/en?format=image");

    fireEvent.error(primaryImg);
    const namedImg = screen.getByAltText("Skyhunter Skirmisher") as HTMLImageElement;
    expect(namedImg.src).toBe("https://api.scryfall.com/cards/named?fuzzy=Skyhunter%20Skirmisher&format=image");

    fireEvent.error(namedImg);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Skyhunter Skirmisher")).toBeInTheDocument();
  });

  it("resets the failure state when switching to a different card (doesn't carry a prior card's broken-image state over)", () => {
    const cardA: CardView = { id: "a", name: "Card A", expansionSetCode: "bad", cardNumber: "1" };
    const cardB: CardView = { id: "b", name: "Card B", expansionSetCode: "lea", cardNumber: "2" };
    const { rerender } = render(<CardTile card={cardA} />);

    fireEvent.error(screen.getByAltText("Card A"));
    fireEvent.error(screen.getByAltText("Card A")); // both primary and named fail -> text tile
    expect(screen.getByText("Card A")).toBeInTheDocument();

    rerender(<CardTile card={cardB} />);
    const img = screen.getByAltText("Card B") as HTMLImageElement;
    expect(img.src).toBe("https://api.scryfall.com/cards/lea/2/en?format=image");
  });

  it("fires onClick/onHover when given (gating on playable is the caller's job, e.g. Battlefield only passes onClick when playable)", () => {
    const card: CardView = { id: "c1", name: "Mountain" };
    const onClick = vi.fn();
    const onHover = vi.fn();
    render(<CardTile card={card} onClick={onClick} onHover={onHover} playable />);

    fireEvent.click(screen.getByTitle("Mountain"));
    expect(onClick).toHaveBeenCalledWith(card);

    fireEvent.mouseEnter(screen.getByTitle("Mountain"));
    expect(onHover).toHaveBeenCalledWith(card);
    fireEvent.mouseLeave(screen.getByTitle("Mountain"));
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("doesn't fire a click at all when no onClick is given", () => {
    const card: CardView = { id: "c1", name: "Mountain" };
    render(<CardTile card={card} />);
    expect(() => fireEvent.click(screen.getByTitle("Mountain"))).not.toThrow();
  });
});
