# LLM Gateway + RAG Platform

A TypeScript monorepo for an OpenAI-compatible LLM gateway and a future RAG platform and evaluation harness.

## Milestone 1 quickstart

Requirements: Node.js 20+ and npm.

```sh
npm install
docker compose up -d
npm run dev
```

The gateway listens on `http://localhost:3000`. Its mock provider runs without API keys. Send a streaming request:

```sh
curl http://localhost:3000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"mock-model","messages":[{"role":"user","content":"Hi"}],"stream":true}'
```

The response uses OpenAI-style Server-Sent Events and ends with `data: [DONE]`. Set `HOST`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`, or `REDIS_URL` in the environment to override local defaults. Copy `.env.example` as a starting point if desired; it contains local development values only.

## Workspace

- `packages/gateway`: Fastify chat completions API and mock provider adapter.
- `packages/shared`: request validation, provider contract, and environment config.
- `packages/rag`: reserved for the RAG milestone.
- `packages/eval`: reserved for the evaluation milestone.

Useful commands: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
