import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("loads safe local defaults without secrets", () => {
    expect(loadConfig({})).toMatchObject({ HOST: "0.0.0.0", PORT: 3000, LOG_LEVEL: "info" });
  });

  it("coerces port and rejects invalid values", () => {
    expect(loadConfig({ PORT: "4100" }).PORT).toBe(4100);
    expect(() => loadConfig({ PORT: "0" })).toThrow();
    expect(() => loadConfig({ REDIS_URL: "not-a-url" })).toThrow();
  });
});
