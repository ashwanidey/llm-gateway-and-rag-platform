The stack: Node.js, TypeScript strict mode, Fastify, Postgres with pgvector, Redis, BullMQ, Vitest.
A pointer: “Full requirements are in docs/requirements.md. Section 9 sets priorities and Section 10 the build order.”
Working rules: build only the milestone you’re asked for, write tests alongside code, make every provider go through the adapter interface, never hardcode secrets, and keep the mock provider working so everything runs without API keys.
The commands for running tests, lint and type-checking, so Codex can check its own work.