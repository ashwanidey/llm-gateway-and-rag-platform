import { z } from "zod";

export const chatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.union([z.string(), z.null()])
  }).passthrough()).min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  user: z.string().optional()
}).passthrough();

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: "assistant"; content?: string };
    finish_reason: "stop" | null;
  }>;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: "stop";
  }>;
}

export interface LlmProvider {
  readonly name: string;
  streamChat(request: ChatCompletionRequest, signal: AbortSignal): AsyncIterable<ChatCompletionChunk>;
}
