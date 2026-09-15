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
});
