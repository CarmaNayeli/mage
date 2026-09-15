import { beforeEach, describe, expect, it } from "vitest";
import { loadTableTalk, saveTableTalk } from "./settings";

beforeEach(() => {
  localStorage.clear();
});

describe("table talk setting", () => {
  it("defaults to on when nothing has been saved yet", () => {
    expect(loadTableTalk()).toBe(true);
  });

  it("round-trips a saved value", () => {
    saveTableTalk(false);
    expect(loadTableTalk()).toBe(false);
    saveTableTalk(true);
    expect(loadTableTalk()).toBe(true);
  });
});
