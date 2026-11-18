import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock.js";

describe("MockProvider", () => {
  it("emits OpenAI-style assistant content and a stop chunk", async () => {
    const provider = new MockProvider();
    const chunks = [];
    for await (const chunk of provider.streamChat({ model: "mock-model", messages: [{ role: "user", content: "hello" }], stream: true }, new AbortController().signal)) {
      chunks.push(chunk);
    }

    expect(chunks[0]?.choices[0]?.delta.role).toBe("assistant");
    expect(chunks.map((chunk) => chunk.choices[0]?.delta.content ?? "").join("")).toBe("Mock response: hello");
    expect(chunks.at(-1)?.choices[0]?.finish_reason).toBe("stop");
  });

  it("stops producing content after cancellation", async () => {
    const provider = new MockProvider();
    const controller = new AbortController();
    const iterator = provider.streamChat({ model: "mock-model", messages: [{ role: "user", content: "hello" }], stream: true }, controller.signal)[Symbol.asyncIterator]();
    await iterator.next();
    controller.abort();
    expect((await iterator.next()).done).toBe(true);
  });
});
