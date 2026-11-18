import type { ChatCompletionChunk, ChatCompletionRequest, LlmProvider } from "@platform/shared";

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async *streamChat(request: ChatCompletionRequest, signal: AbortSignal): AsyncIterable<ChatCompletionChunk> {
    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    const latestUserMessage = [...request.messages].reverse().find((message) => message.role === "user")?.content;
    const answer = `Mock response: ${typeof latestUserMessage === "string" ? latestUserMessage : "Hello!"}`;
    const words = answer.match(/\S+\s*/g) ?? [answer];

    yield {
      id,
      object: "chat.completion.chunk",
      created,
      model: request.model,
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }]
    };

    for (const content of words) {
      if (signal.aborted) return;
      yield {
        id,
        object: "chat.completion.chunk",
        created,
        model: request.model,
        choices: [{ index: 0, delta: { content }, finish_reason: null }]
      };
      await Promise.resolve();
    }

    if (!signal.aborted) {
      yield {
        id,
        object: "chat.completion.chunk",
        created,
        model: request.model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
      };
    }
  }
}
