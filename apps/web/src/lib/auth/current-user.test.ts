import { describe, it, expect } from "vitest";
import { slugify } from "./current-user";

describe("slugify", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugify("Ben Pickering")).toBe("ben-pickering");
  });
  it("collapses non-alphanumerics", () => {
    expect(slugify("Ben & Co.")).toBe("ben-co");
  });
  it("trims leading/trailing dashes", () => {
    expect(slugify("---foo---")).toBe("foo");
  });
  it("falls back when input is empty", () => {
    expect(slugify("")).toBe("workspace");
    expect(slugify("@@@")).toBe("workspace");
  });
  it("caps length", () => {
    expect(slugify("a".repeat(60)).length).toBeLessThanOrEqual(40);
  });
});
