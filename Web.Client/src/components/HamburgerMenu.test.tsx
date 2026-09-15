import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HamburgerMenu } from "./HamburgerMenu";

describe("HamburgerMenu", () => {
  it("opens the dropdown on click and fires the selected item", () => {
    const onClick = vi.fn();
    render(<HamburgerMenu items={[{ label: "Restart", onClick }]} />);

    expect(screen.queryByRole("button", { name: "Restart" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

    expect(onClick).toHaveBeenCalled();
    // Selecting an item closes the dropdown again.
    expect(screen.queryByRole("button", { name: "Restart" })).not.toBeInTheDocument();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <HamburgerMenu items={[{ label: "Restart", onClick: () => {} }]} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("button", { name: "Restart" })).not.toBeInTheDocument();
  });

  it("respects disabled items", () => {
    render(<HamburgerMenu items={[{ label: "Restart", onClick: () => {}, disabled: true }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
  });

  it("expands a submenu without closing the whole menu, then fires the chosen entry and closes on it", () => {
    const onLoad = vi.fn();
    render(<HamburgerMenu items={[{ label: "Load Deck", submenu: [{ label: "Gruul Aggro", onClick: onLoad }] }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByRole("button", { name: "Gruul Aggro" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Load Deck/ }));
    expect(screen.getByRole("button", { name: "Gruul Aggro" })).toBeInTheDocument();
    // Still open - expanding a submenu isn't the same as picking an item.
    expect(screen.getByRole("button", { name: /Load Deck/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gruul Aggro" }));
    expect(onLoad).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Load Deck/ })).not.toBeInTheDocument();
  });

  it("shows a placeholder when a submenu has nothing in it", () => {
    render(<HamburgerMenu items={[{ label: "Load Deck", submenu: [] }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Load Deck/ }));
    expect(screen.getByText("Nothing saved yet")).toBeInTheDocument();
  });
});
