import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Library } from "./Library";

describe("Library", () => {
  it("shows the card count in the label and the pile", () => {
    render(<Library count={53} />);
    expect(screen.getByText("Library (53)")).toBeInTheDocument();
    expect(screen.getByText("53")).toBeInTheDocument();
  });

  it("renders a count of zero rather than hiding (an empty library is still a real zone)", () => {
    render(<Library count={0} />);
    expect(screen.getByText("Library (0)")).toBeInTheDocument();
  });
});
