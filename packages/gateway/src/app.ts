import Fastify, { type FastifyInstance } from "fastify";
import { chatCompletionRequestSchema, type ChatCompletionChunk, type ChatCompletionRequest, type ChatCompletionResponse, type LlmProvider, loadConfig } from "@platform/shared";

interface ChatRouteOptions {
  provider?: LlmProvider;
}

function openAiError(message: string, type: string, code: string) {
  return { error: { message, type, param: null, code } };
}

async function writeWithBackpressure(response: NodeJS.WritableStream, chunk: string): Promise<boolean> {
  if (response.write(chunk)) return true;
  return new Promise((resolve) => {
    response.once("drain", () => resolve(true));
    response.once("close", () => resolve(false));
  });
}

export function buildApp(options: ChatRouteOptions = {}): FastifyInstance {
  const config = loadConfig();
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: unknown }>("/v1/chat/completions", async (request, reply) => {
    const parsed = chatCompletionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(openAiError("Invalid chat completion request", "invalid_request_error", "invalid_request"));
    }
    if (!options.provider) {
      return reply.code(500).send(openAiError("No LLM provider is configured", "server_error", "provider_unavailable"));
    }

    const chatRequest: ChatCompletionRequest = parsed.data;
    const controller = new AbortController();
    const onClose = () => {
      if (!reply.raw.writableEnded) controller.abort();
    };
    reply.raw.once("close", onClose);

    try {
      const chunks: ChatCompletionChunk[] = [];
      let content = "";
      for await (const chunk of options.provider.streamChat(chatRequest, controller.signal)) {
        if (controller.signal.aborted) break;
        if (chatRequest.stream) {
          if (!reply.sent) {
            reply.hijack();
            reply.raw.writeHead(200, {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              connection: "keep-alive",
              "x-accel-buffering": "no"
            });
          }
          if (!(await writeWithBackpressure(reply.raw, `data: ${JSON.stringify(chunk)}\n\n`))) {
            controller.abort();
            break;
          }
        } else {
          chunks.push(chunk);
          content += chunk.choices[0]?.delta.content ?? "";
        }
      }

      if (chatRequest.stream) {
        if (!controller.signal.aborted && !reply.raw.destroyed) reply.raw.end("data: [DONE]\n\n");
        return reply;
      }

      const lastChunk = chunks.at(-1);
      const response: ChatCompletionResponse = {
        id: lastChunk?.id ?? `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: lastChunk?.created ?? Math.floor(Date.now() / 1000),
        model: chatRequest.model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }]
      };
      return reply.send(response);
    } catch (error) {
      if (controller.signal.aborted || reply.raw.destroyed) return reply;
      request.log.error({ err: error }, "LLM provider request failed");
      if (chatRequest.stream && reply.sent) {
        await writeWithBackpressure(reply.raw, `data: ${JSON.stringify(openAiError("The LLM provider failed", "server_error", "provider_error"))}\n\n`);
        reply.raw.end("data: [DONE]\n\n");
        return reply;
      }
      return reply.code(502).send(openAiError("The LLM provider failed", "server_error", "provider_error"));
    } finally {
      reply.raw.off("close", onClose);
    }
  });

  return app;
}
