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

  it("submits the trimmed name and raw decklist text", () => {
    const onSubmit = vi.fn();
    render(<DeckEntry onSubmit={onSubmit} />);
    fillForm("  Carma  ", "20 Mountain\n20 Forest");

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(onSubmit).toHaveBeenCalledWith("20 Mountain\n20 Forest", "Carma");
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
