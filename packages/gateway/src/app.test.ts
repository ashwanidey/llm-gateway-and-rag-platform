import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { MockProvider } from "./providers/mock.js";

describe("chat completions integration", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { app = buildApp({ provider: new MockProvider() }); });
  afterEach(async () => app.close());

  it("streams OpenAI-compatible SSE chunks and the terminal marker", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: { model: "mock-model", messages: [{ role: "user", content: "hello" }], stream: true }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain('"object":"chat.completion.chunk"');
    const content = response.body.split("\n")
      .filter((line) => line.startsWith("data: {") )
      .map((line) => JSON.parse(line.slice(6)) as { choices: Array<{ delta: { content?: string } }> })
      .map((chunk) => chunk.choices[0]?.delta.content ?? "")
      .join("");
    expect(content).toBe("Mock response: hello");
    expect(response.body).toContain("data: [DONE]");
  });

  it("supports a non-stream response through the same provider adapter", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: { model: "mock-model", messages: [{ role: "user", content: "hello" }] }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().choices[0].message.content).toBe("Mock response: hello");
  });

  it("returns a clear validation error for invalid requests", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/chat/completions", payload: { messages: [] } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });
});
