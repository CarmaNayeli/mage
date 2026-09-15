import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSavedDecks, type SavedDeck } from "../utils/savedDecks";
import { DeckEntry } from "./DeckEntry";

function fillForm(name: string, decklist: string) {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Decklist"), { target: { value: decklist } });
}

/** Mirrors how App.tsx actually owns the saved-decks list (DeckEntry itself no longer
 * does) - only needed by the save/load/delete tests below. */
function DeckEntryWithSavedDecks() {
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => listSavedDecks());
  return <DeckEntry onSubmit={() => {}} savedDecks={savedDecks} onSavedDecksChange={setSavedDecks} />;
}

beforeEach(() => {
  localStorage.clear();
});

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

  it("leaves the sideboard optional, and joins it with a blank line, for non-Commander formats", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("Carma", "20 Mountain");
    expect(screen.getByRole("button", { name: "Start game" })).not.toBeDisabled();

    const sideboards = screen.getAllByLabelText(/^Sideboard/);
    fireEvent.change(sideboards[0], { target: { value: "4 Shock" } });

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ playerDeck: "20 Mountain\n\n4 Shock" }),
    );
  });

  it("submits the selected format and difficulty for the counter-deck mode", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("Carma", "20 Mountain");

    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "commander" } });
    fireEvent.change(screen.getAllByLabelText(/^Sideboard/)[0], { target: { value: "1 Krenko, Mob Boss" } });
    fireEvent.click(screen.getByRole("radio", { name: "Analyze my deck and build a counter" }));
    fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "hard" } });

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "commander",
        opponentMode: "counter",
        difficulty: "hard",
        playerDeck: "20 Mountain\n\n1 Krenko, Mob Boss",
      }),
    );
  });

  it("requires a non-empty sideboard for Commander format, with a hint to drop the commander there", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("Carma", "99 Island");
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "commander" } });

    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();
    expect(screen.getAllByText(/drop your commander here/i)[0]).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText(/^Sideboard/)[0], { target: { value: "1 Krenko, Mob Boss" } });
    expect(screen.getByRole("button", { name: "Start game" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ playerDeck: "99 Island\n\n1 Krenko, Mob Boss" }),
    );
  });

  it("also requires the opponent's sideboard when providing a Commander deck", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("Carma", "99 Island");
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "commander" } });
    fireEvent.change(screen.getAllByLabelText(/^Sideboard/)[0], { target: { value: "1 Krenko, Mob Boss" } });
    fireEvent.click(screen.getByRole("radio", { name: "Provide a deck" }));

    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();

    const textareas = screen.getAllByLabelText("Decklist");
    fireEvent.change(textareas[1], { target: { value: "99 Plains" } });
    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();

    const sideboards = screen.getAllByLabelText(/^Sideboard/);
    fireEvent.change(sideboards[1], { target: { value: "1 Isperia, Supreme Judge" } });
    expect(screen.getByRole("button", { name: "Start game" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ opponentDeck: "99 Plains\n\n1 Isperia, Supreme Judge" }),
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

  it("saves the current deck under a name, then loads it back later", () => {
    const { unmount } = render(<DeckEntryWithSavedDecks />);
    fillForm("Carma", "20 Mountain\n20 Forest");
    fireEvent.change(screen.getByPlaceholderText("Name this deck to save it"), { target: { value: "Gruul Aggro" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current deck" }));
    expect(screen.getByRole("button", { name: /^Gruul Aggro/ })).toBeInTheDocument();
    unmount();

    // Re-mounting simulates a later visit - the deck should still be there via localStorage.
    render(<DeckEntryWithSavedDecks />);
    fireEvent.click(screen.getByRole("button", { name: /^Gruul Aggro/ }));
    expect(screen.getByLabelText("Decklist")).toHaveValue("20 Mountain\n20 Forest");
  });

  it("deletes a saved deck", () => {
    render(<DeckEntryWithSavedDecks />);
    fillForm("Carma", "20 Mountain");
    fireEvent.change(screen.getByPlaceholderText("Name this deck to save it"), { target: { value: "Mono Red" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current deck" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete Mono Red" }));
    expect(screen.queryByRole("button", { name: /Mono Red/ })).not.toBeInTheDocument();
  });
});
