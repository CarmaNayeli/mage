import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CardView } from "../types/gameView";
import { CommandZone } from "./CommandZone";

const commander: CardView = { id: "c1", name: "Krenko, Mob Boss", mageObjectType: "COMMANDER" };
const emblem = { id: "e1", name: "Emblem" } as unknown as CardView; // no mageObjectType: "COMMANDER"

describe("CommandZone", () => {
  it("renders nothing when there's no commander (most games, outside the Commander format)", () => {
    const { container } = render(<CommandZone commandList={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when commandList is undefined", () => {
    const { container } = render(<CommandZone />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a commander card, ignoring non-Commander entries in the same list (emblems/dungeons/planes)", () => {
    render(<CommandZone commandList={[commander, emblem]} />);
    expect(screen.getByText("Commander")).toBeInTheDocument();
    expect(screen.getByTitle("Krenko, Mob Boss")).toBeInTheDocument();
    expect(screen.queryByTitle("Emblem")).not.toBeInTheDocument();
  });

  it("is clickable when playable, and not otherwise", () => {
    const onCardClick = vi.fn();
    const { rerender } = render(<CommandZone commandList={[commander]} onCardClick={onCardClick} playableIds={new Set()} />);
    fireEvent.click(screen.getByTitle("Krenko, Mob Boss"));
    expect(onCardClick).not.toHaveBeenCalled();

    rerender(<CommandZone commandList={[commander]} onCardClick={onCardClick} playableIds={new Set(["c1"])} />);
    fireEvent.click(screen.getByTitle("Krenko, Mob Boss"));
    expect(onCardClick).toHaveBeenCalledWith(commander);
  });
});
