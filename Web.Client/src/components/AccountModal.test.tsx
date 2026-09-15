import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountModal } from "./AccountModal";

describe("AccountModal", () => {
  it("shows a pending state after submitting, until an error arrives to explain why it stopped", () => {
    const { rerender } = render(<AccountModal onClose={() => {}} onLogin={() => {}} onRegister={() => {}} error={null} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carma" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();

    rerender(<AccountModal onClose={() => {}} onLogin={() => {}} onRegister={() => {}} error="Incorrect password." />);
    expect(screen.getByText("Incorrect password.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).not.toBeDisabled();
  });

  it("logs in with the entered username/password", () => {
    const onLogin = vi.fn();
    render(<AccountModal onClose={() => {}} onLogin={onLogin} onRegister={() => {}} error={null} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carma" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(onLogin).toHaveBeenCalledWith("carma", "hunter2");
  });

  it("switches to register mode and registers instead of logging in", () => {
    const onLogin = vi.fn();
    const onRegister = vi.fn();
    render(<AccountModal onClose={() => {}} onLogin={onLogin} onRegister={onRegister} error={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Need an account? Create one" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carma" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(onRegister).toHaveBeenCalledWith("carma", "hunter2");
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("disables submit until both fields are filled", () => {
    render(<AccountModal onClose={() => {}} onLogin={() => {}} onRegister={() => {}} error={null} />);
    expect(screen.getByRole("button", { name: "Log In" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carma" } });
    expect(screen.getByRole("button", { name: "Log In" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    expect(screen.getByRole("button", { name: "Log In" })).not.toBeDisabled();
  });

  it("shows a server-reported error", () => {
    render(<AccountModal onClose={() => {}} onLogin={() => {}} onRegister={() => {}} error="That username is already taken." />);
    expect(screen.getByText("That username is already taken.")).toBeInTheDocument();
  });

  it("closes on Cancel and on clicking the backdrop, but not on clicking inside the modal", () => {
    const onClose = vi.fn();
    render(<AccountModal onClose={onClose} onLogin={() => {}} onRegister={() => {}} error={null} />);

    fireEvent.click(screen.getByText("Log In", { selector: "h2" }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
