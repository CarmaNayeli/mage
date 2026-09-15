import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeckEntry } from "./DeckEntry";

function fillForm(name: string, decklist: string) {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: decklist } });
}

describe("DeckEntry", () => {
  it("disables submit until both name and decklist are non-empty", () => {
    render(<DeckEntry onSubmit={() => {}} />);
    const submit = screen.getByRole("button", { name: "Start game" });
    expect(submit).toBeDisabled();

    fillForm("Carma", "20 Mountain");
    expect(submit).not.toBeDisabled();
  });

  it("treats whitespace-only input as empty", () => {
    render(<DeckEntry onSubmit={() => {}} />);
    fillForm("   ", "   ");
    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();
  });

  it("submits with the basic opponent mode and freeform format by default", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("  Carma  ", "20 Mountain\n20 Forest");

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith({
      playerName: "Carma",
      format: "freeform",
      playerDeck: "20 Mountain\n20 Forest",
      opponentMode: "basic",
      opponentDeck: undefined,
      difficulty: undefined,
    });
  });

  it("requires an opponent decklist when 'provide' is selected, and submits it", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("Carma", "20 Mountain");

    fireEvent.click(screen.getByRole("radio", { name: "Provide a deck" }));
    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();

    const textareas = screen.getAllByLabelText("Decklist");
    fireEvent.change(textareas[1], { target: { value: "10 Shock" } });
    expect(screen.getByRole("button", { name: "Start game" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ opponentMode: "provide", opponentDeck: "10 Shock" }),
    );
  });

  it("submits the selected format and difficulty for the counter-deck mode", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("Carma", "20 Mountain");

    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "commander" } });
    fireEvent.click(screen.getByRole("radio", { name: "Analyze my deck and build a counter" }));
    fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "hard" } });

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ format: "commander", opponentMode: "counter", difficulty: "hard" }),
    );
  });

  it("shows a joining state and disables the form while disabled", () => {
    render(<DeckEntry onSubmit={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Joining..." })).toBeDisabled();
    expect(screen.getByLabelText("Your name")).toBeDisabled();
    expect(screen.getByLabelText("Decklist")).toBeDisabled();
  });

  it("renders an error message when given one", () => {
    render(<DeckEntry onSubmit={() => {}} error="Couldn't reach the server" />);
    expect(screen.getByText("Couldn't reach the server")).toBeInTheDocument();
  });

  it("renders no error message when error is null", () => {
    render(<DeckEntry onSubmit={() => {}} error={null} />);
    expect(screen.queryByText(/couldn't reach/i)).not.toBeInTheDocument();
  });
});
