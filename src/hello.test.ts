import { describe, expect, it } from "vitest";
import { hello } from "./hello.js";

describe("hello", () => {
  it("greets the world by default", () => {
    expect(hello()).toBe("Hello, world!");
  });

  it("greets a named caller", () => {
    expect(hello("Give Protocol")).toBe("Hello, Give Protocol!");
  });
});
