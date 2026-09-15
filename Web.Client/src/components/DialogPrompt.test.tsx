import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogPrompt } from "./DialogPrompt";

describe("DialogPrompt", () => {
  it("renders the dialog type, message, and each option", () => {
    render(
      <DialogPrompt
        type="GAME_ASK"
        payload={{ message: "Do you want to mulligan?", options: [{ index: 0, label: "Yes" }, { index: 1, label: "No" }] }}
        onChoose={() => {}}
      />,
    );

    expect(screen.getByText("GAME_ASK")).toBeInTheDocument();
    expect(screen.getByText("Do you want to mulligan?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("calls onChoose with the clicked option's index", () => {
    const onChoose = vi.fn();
    render(
      <DialogPrompt
        type="GAME_SELECT"
        payload={{ options: [{ index: 0, label: "Bolt" }, { index: 1, label: "Counterspell" }] }}
        onChoose={onChoose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Counterspell" }));
    expect(onChoose).toHaveBeenCalledWith(1);
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it("renders with no options or message without crashing", () => {
    render(<DialogPrompt type="GAME_CHOOSE_ABILITY" payload={{}} onChoose={() => {}} />);
    expect(screen.getByText("GAME_CHOOSE_ABILITY")).toBeInTheDocument();
  });
});
