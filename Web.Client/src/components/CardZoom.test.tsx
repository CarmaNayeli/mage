import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CardView } from "../types/gameView";
import { CardZoom } from "./CardZoom";

describe("CardZoom", () => {
  it("renders the direct Scryfall image when expansionSetCode/cardNumber are present", () => {
    const card: CardView = { id: "c1", name: "Lightning Bolt", expansionSetCode: "lea", cardNumber: "161" };
    render(<CardZoom card={card} />);
    const img = screen.getByAltText("Lightning Bolt") as HTMLImageElement;
    expect(img.src).toBe("https://api.scryfall.com/cards/lea/161/en?format=image");
  });

  it("falls back to a fuzzy name search when expansionSetCode/cardNumber is missing entirely", () => {
    const card: CardView = { id: "c1", name: "Skyhunter Skirmisher" };
    render(<CardZoom card={card} />);
    const img = screen.getByAltText("Skyhunter Skirmisher") as HTMLImageElement;
    expect(img.src).toBe("https://api.scryfall.com/cards/named?fuzzy=Skyhunter%20Skirmisher&format=image");
  });

  it("falls back to a fuzzy name search when the direct image 404s, then to the text fallback (with rules text) if that also fails", () => {
    const card: CardView = {
      id: "c1",
      name: "Skyhunter Skirmisher",
      expansionSetCode: "bad",
      cardNumber: "999",
      power: "1",
      toughness: "1",
      rules: ["Flying", "Double strike"],
    };
    render(<CardZoom card={card} />);

    const primaryImg = screen.getByAltText("Skyhunter Skirmisher") as HTMLImageElement;
    expect(primaryImg.src).toBe("https://api.scryfall.com/cards/bad/999/en?format=image");

    fireEvent.error(primaryImg);
    const namedImg = screen.getByAltText("Skyhunter Skirmisher") as HTMLImageElement;
    expect(namedImg.src).toBe("https://api.scryfall.com/cards/named?fuzzy=Skyhunter%20Skirmisher&format=image");

    fireEvent.error(namedImg);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skyhunter Skirmisher" })).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Flying")).toBeInTheDocument();
  });
});
