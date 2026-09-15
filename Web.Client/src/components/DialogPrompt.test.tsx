import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameView } from "../types/gameView";
import { DialogPrompt } from "./DialogPrompt";

const noop = () => {};

describe("DialogPrompt", () => {
  it("renders GAME_ASK as Yes/No, responding with send_boolean", () => {
    const onRespond = vi.fn();
    render(<DialogPrompt type="GAME_ASK" payload={{ message: "Do you want to mulligan?" }} game={null} onRespond={onRespond} />);

    expect(screen.getByText("GAME_ASK")).toBeInTheDocument();
    expect(screen.getByText("Do you want to mulligan?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onRespond).toHaveBeenCalledWith("send_boolean", [true]);

    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onRespond).toHaveBeenCalledWith("send_boolean", [false]);
  });

  it("renders GAME_TARGET's targets as buttons, resolving names from the game state", () => {
    const onRespond = vi.fn();
    const game = {
      myHand: { "card-1": { id: "card-1", name: "Lightning Bolt" } },
    } as unknown as GameView;

    render(
      <DialogPrompt
        type="GAME_TARGET"
        payload={{ targets: ["card-1", "unknown-id"], flag: false }}
        game={game}
        onRespond={onRespond}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lightning Bolt" }));
    expect(onRespond).toHaveBeenCalledWith("send_uuid", ["card-1"]);

    // Unresolvable ids still render (truncated) rather than being dropped.
    expect(screen.getByRole("button", { name: "unknown-" })).toBeInTheDocument();
    // Not required (flag: false) - a Cancel option must be offered.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onRespond).toHaveBeenCalledWith("send_boolean", [false]);
  });

  it("omits Cancel for GAME_TARGET when the target is required", () => {
    render(<DialogPrompt type="GAME_TARGET" payload={{ targets: [], flag: true }} game={null} onRespond={noop} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("renders GAME_CHOOSE_ABILITY's choices map, responding with send_uuid", () => {
    const onRespond = vi.fn();
    render(
      <DialogPrompt
        type="GAME_CHOOSE_ABILITY"
        payload={{ choices: { "ability-1": "Cast for 3 mana", "ability-2": "Cast for X" } }}
        game={null}
        onRespond={onRespond}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cast for X" }));
    expect(onRespond).toHaveBeenCalledWith("send_uuid", ["ability-2"]);
  });

  it("renders GAME_CHOOSE_CHOICE's keyChoices, responding with send_string", () => {
    const onRespond = vi.fn();
    render(
      <DialogPrompt
        type="GAME_CHOOSE_CHOICE"
        payload={{ choice: { keyChoices: { red: "Red", blue: "Blue" } } }}
        game={null}
        onRespond={onRespond}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    expect(onRespond).toHaveBeenCalledWith("send_string", ["blue"]);
  });

  it("renders GAME_GET_AMOUNT as a number form, responding with send_integer", () => {
    const onRespond = vi.fn();
    render(<DialogPrompt type="GAME_GET_AMOUNT" payload={{ min: 0, max: 5 }} game={null} onRespond={onRespond} />);

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onRespond).toHaveBeenCalledWith("send_integer", [3]);
  });

  it("strips the engine's Swing-style HTML tags out of the message text", () => {
    render(
      <DialogPrompt
        type="GAME_ASK"
        payload={{ message: "Mulligan <font color=#ffff00>down to 6 cards</font>?" }}
        game={null}
        onRespond={noop}
      />,
    );
    expect(screen.getByText("Mulligan down to 6 cards?")).toBeInTheDocument();
  });

  it("renders an unhandled-type fallback without crashing or calling onRespond", () => {
    const onRespond = vi.fn();
    render(<DialogPrompt type="SOME_FUTURE_TYPE" payload={{}} game={null} onRespond={onRespond} />);
    expect(screen.getByText("SOME_FUTURE_TYPE")).toBeInTheDocument();
    expect(onRespond).not.toHaveBeenCalled();
  });
});
