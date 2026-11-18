# LLM Gateway + RAG Platform: Requirements

A requirements checklist for building a Node.js LLM gateway with a RAG platform and an evaluation harness, scoped so the project reads as production-grade on an SDE1 resume.

## 1. Positioning

**One-line pitch:** A self-hostable, OpenAI-compatible LLM gateway that adds routing, caching, rate limiting, cost tracking and guardrails in front of multiple model providers, plus a multi-tenant RAG service built on top of it, with an automated evaluation harness that measures retrieval and answer quality.

**Why this combination stands out**

- The gateway shows backend and distributed-systems depth: rate limiting, caching, resilience, observability.
- The RAG platform shows applied AI depth: retrieval, ranking, evaluation.
- The evaluation harness shows engineering rigor. Most student RAG projects have no measurement; yours will have numbers.
- The RAG service consumes the gateway, so the two form one coherent system instead of two toy demos.

**Suggested stack (adjust freely):** Node.js + TypeScript, Fastify (or Express), PostgreSQL + pgvector (or Qdrant), Redis, BullMQ for background jobs, Docker Compose, OpenTelemetry + Prometheus + Grafana, Vitest/Jest, k6 for load tests, GitHub Actions for CI.

## 2. High-Level Architecture

- **Clients / SDKs** call the gateway with an OpenAI-compatible API.
- **Gateway layer:** auth, rate limiting, routing, caching, guardrails, provider adapters, usage metering.
- **RAG service:** ingestion workers, chunking and embedding pipeline, vector and keyword indexes, retrieval and reranking, answer generation with citations.
- **Evaluation harness:** dataset management, metric computation, experiment runner, CI regression gate.
- **Admin plane:** tenant, API key and budget management, usage dashboards.
- **Observability plane:** traces, metrics, structured logs, alerts.

## 3. LLM Gateway Requirements

### 3.1 Core API

- OpenAI-compatible endpoints: `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`.
- **Streaming via Server-Sent Events** with correct chunk forwarding, client disconnect handling and upstream cancellation (AbortController).
- Provider adapter interface so each provider (OpenAI, Anthropic, Gemini, Groq, local Ollama) is a plugin that normalizes requests, responses, errors and token usage.
- Support for function/tool calling and structured JSON output passed through correctly.
- Request and response schema validation (Zod or JSON Schema) with clear error codes.
- OpenAPI spec generated from the code.

### 3.2 Routing and Resilience

- Model aliasing (e.g. `fast`, `smart`, `cheap`) mapped to concrete provider models via config.
- **Fallback chains:** if provider A fails or times out, retry on provider B.
- **Retries with exponential backoff and jitter**, only for retryable errors (429, 5xx, timeouts).
- **Circuit breaker** per provider (closed, open, half-open) with health tracking.
- **Load balancing** across multiple API keys or deployments: round-robin, weighted, least-latency.
- Routing policies: cost-based, latency-based, capability-based (context length, vision, tools).
- Per-request timeouts, deadlines and **hedged requests** (stretch).
- Hot-reloadable routing config without restarts.

### 3.3 Rate Limiting, Quotas and Budgets

- Multiple algorithms implemented and compared: fixed window, sliding window, token bucket, leaky bucket.
- Distributed rate limiting in Redis using **atomic Lua scripts**.
- Limits on requests per minute **and** tokens per minute, per API key, per tenant and per model.
- Monthly or daily **spend budgets** with soft alerts and hard cutoffs.
- Standard rate-limit headers (`X-RateLimit-Remaining`, `Retry-After`) and 429 responses.
- Concurrency limits and a **priority request queue** with backpressure and load shedding.

### 3.4 Caching

- **Exact-match cache** keyed on a normalized request hash (model, messages, parameters), with TTL.
- **Semantic cache:** embed the prompt, find near-duplicates by cosine similarity above a tunable threshold.
- Cache-control rules: skip caching for non-deterministic requests (high temperature), tool calls or user opt-out.
- Cache invalidation strategy, hit/miss metrics and measured cost and latency savings.
- Request coalescing (single-flight) so identical in-flight requests share one upstream call.

### 3.5 Token Counting and Cost Tracking

- Accurate token counting per provider (tiktoken or equivalent) for both prompts and completions, including streamed responses.
- Pricing table per model, cost computed per request and aggregated per key, tenant, model and day.
- Usage ledger stored durably (append-only), with async writes so metering never blocks the request path.
- Usage query API and CSV export.

### 3.6 Auth and Multi-Tenancy

- API key issuance, rotation and revocation; keys stored **hashed**, shown once.
- Tenants, projects and keys hierarchy with scoped permissions (RBAC): which models, which endpoints, which budgets.
- Optional JWT/OIDC support for the admin plane.
- Audit log of admin actions.

### 3.7 Guardrails

- **PII detection and redaction** (emails, phone numbers, card numbers, Aadhaar-style IDs) before leaving the gateway.
- Prompt injection heuristics and a configurable blocklist.
- Output filters (e.g. secrets leakage, banned content) with block, redact or flag modes.
- Max prompt size and max output token enforcement.
- Pluggable guardrail pipeline (pre-request and post-response hooks / middleware chain).

### 3.8 Observability

- **Structured JSON logs** with request IDs propagated end to end.
- **Distributed tracing** with OpenTelemetry: one trace spans gateway, cache, provider call and RAG steps.
- **Prometheus metrics:** request rate, error rate, p50/p95/p99 latency, time-to-first-token, tokens per second, cache hit ratio, provider health, spend.
- Grafana dashboards committed to the repo.
- Alert rules (error spike, latency SLO breach, budget exhaustion).

## 4. RAG Platform Requirements

### 4.1 Ingestion Pipeline

- Document loaders for PDF, Markdown, HTML, DOCX, plain text, and URL/web crawl.
- **Asynchronous ingestion** with a job queue (BullMQ): upload returns immediately, workers process, status endpoint reports progress.
- Text extraction and cleaning, with metadata capture (source, title, page, author, timestamps).
- **Deduplication** using content hashing; **incremental re-indexing** that only re-embeds changed chunks.
- Document versioning and soft deletion with index cleanup.
- Failure handling: retries, dead-letter queue, partial-failure reporting.
- Defend against SSRF and oversized files when ingesting URLs and uploads.

### 4.2 Chunking

- Multiple strategies implemented behind one interface: fixed-size with overlap, recursive character/sentence splitting, **semantic chunking**, structure-aware chunking (headings, code blocks, tables).
- **Parent-child (small-to-big) retrieval:** index small chunks, return the larger parent for context.
- Configurable per collection, with the strategy compared in the evaluation harness.

### 4.3 Embeddings and Storage

- Embedding provider abstraction (routed through your own gateway), batching, rate-limit aware, with embedding cache.
- Vector store with **HNSW or IVFFlat** index; understand and document the recall/latency trade-off and index parameters.
- Metadata filtering, collection/namespace separation per tenant.
- Embedding model versioning and a re-embedding migration path.

### 4.4 Retrieval

- **Hybrid search:** dense vector search + keyword search (Postgres full-text or BM25), merged with **Reciprocal Rank Fusion**.
- **Cross-encoder or LLM reranking** of top-N candidates.
- **Query transformation:** query rewriting, multi-query expansion, HyDE (hypothetical document embeddings), conversation-aware query condensation.
- **Maximal Marginal Relevance (MMR)** for diversity.
- Metadata and permission-aware filtering (ACL-based retrieval so tenants never see each other's data).
- Configurable top-k, score thresholds and a "no answer" path when retrieval confidence is low.

### 4.5 Generation

- Prompt templates with versioning; context assembly that respects the model's context window (token budgeting, truncation, ordering to mitigate lost-in-the-middle).
- **Grounded answers with citations** pointing to document, page and chunk.
- Streaming answers through the gateway.
- Structured output (JSON schema) for extraction-style queries.
- Conversation memory: sliding window plus summarization for long chats.
- Hallucination mitigation: answer only from context, explicit refusal when evidence is missing.

### 4.6 Agentic Extensions (stretch)

- Tool use / function calling loop (e.g. search, calculator, SQL lookup).
- Query routing: decide between retrieval, direct answer or tool call.
- Multi-step / iterative retrieval for complex questions.
- Basic knowledge-graph or entity-linked retrieval (GraphRAG-lite).

## 5. Evaluation Harness (the differentiator)

- **Golden dataset** of question, expected answer and source passages, plus **synthetic question generation** from your corpus.
- **Retrieval metrics:** Recall@k, Precision@k, MRR, nDCG, hit rate.
- **Generation metrics:** faithfulness/groundedness, answer relevance, context precision and recall, citation accuracy.
- **LLM-as-judge** with a rubric, plus awareness of its biases (position bias, verbosity bias) and a small human-labelled calibration set.
- **Experiment runner:** compare configurations side by side (chunk size, embedding model, hybrid vs dense-only, with and without reranker, different LLMs) and store results.
- **CI regression gate:** pull requests fail if quality metrics drop beyond a threshold.
- Cost and latency reported next to quality, so trade-offs are explicit.
- A results report (markdown or dashboard) committed to the repo showing before/after improvements.
- Safety evals: prompt injection and PII leakage test sets run against the gateway guardrails.

## 6. Distributed Systems and Reliability Concepts to Demonstrate

- Idempotency keys on write endpoints and ingestion jobs.
- Backpressure, load shedding and graceful degradation (e.g. serve from cache or cheaper model when a provider is down).
- Graceful shutdown that drains in-flight streams.
- At-least-once job processing with idempotent handlers.
- Connection pooling, keep-alive and HTTP/2 to upstream providers.
- Event-loop awareness in Node: avoiding CPU-blocking work on the main thread, using worker threads or separate workers for heavy tasks.
- Horizontal scalability: stateless gateway instances behind a load balancer, shared state in Redis and Postgres.
- Defined **SLOs** (e.g. gateway overhead under 20 ms p95, 99.9% availability) and measurement against them.
- **Load testing** with k6 and published results; chaos tests that kill a provider or Redis and verify behaviour.

## 7. Security Requirements

- Hashed API keys, constant-time comparison, key scoping and expiry.
- Input validation everywhere; request size limits.
- Secrets via environment or a secrets manager, never in the repo.
- Tenant isolation tests (cross-tenant retrieval must fail).
- Prompt injection awareness for retrieved content (treat documents as untrusted input).
- Audit logging, dependency scanning in CI, and a short threat model in the README.

## 8. Engineering Quality

- TypeScript with strict mode, a clean modular structure (monorepo with `gateway`, `rag`, `eval`, `shared` packages).
- Unit tests, integration tests (Testcontainers or Docker Compose) and contract tests for provider adapters using recorded fixtures.
- Docker Compose that brings up the **entire stack with one command**, including Redis, Postgres, Prometheus and Grafana.
- CI pipeline: lint, type-check, test, build image, run eval smoke test.
- A **mock provider** so the project runs and tests without paid API keys.
- Architecture Decision Records (ADRs) explaining key choices and trade-offs.
- README with architecture diagram, quickstart, benchmarks, and a demo GIF or hosted demo.
- A minimal admin UI or dashboard (React) showing usage, cost, cache hit rate and eval results.
- Client SDK or example app showing a real use case, such as a chat-with-your-docs app.

## 9. Prioritization for a Two-Month Timeline

### Must-have (MVP that already looks strong)

- OpenAI-compatible chat endpoint with streaming and at least 2 providers
- Fallback and retries, API key auth, Redis token-bucket rate limiting
- Exact cache, token and cost tracking, structured logs and Prometheus metrics
- RAG ingestion with async workers, recursive chunking, pgvector, hybrid search, citations
- Evaluation harness with Recall@k, MRR and a faithfulness judge on a golden set
- Docker Compose, tests, CI, good README

### Should-have (this is what makes it stand out)

- Semantic cache, circuit breaker, budgets and quotas, PII redaction
- Reranking, query rewriting, parent-child retrieval, ACL-aware multi-tenant retrieval
- OpenTelemetry tracing, Grafana dashboards, k6 load test results
- Experiment runner and CI quality gate

### Stretch

- Hedged requests, latency-based routing, request coalescing
- Agentic tool use, GraphRAG-lite, semantic chunking
- Admin dashboard UI, chaos tests, safety eval suite

## 10. Suggested Build Order

1. **Foundation:** repo structure, config, mock provider, one real provider, non-streaming then streaming chat endpoint.
2. **Gateway core:** auth, rate limiting, multi-provider routing, retries and fallback, usage and cost tracking.
3. **Gateway depth:** caching (exact then semantic), circuit breaker, guardrails, metrics and tracing.
4. **RAG v1:** ingestion queue, chunking, embeddings via gateway, vector search, grounded answers with citations.
5. **Evaluation harness:** golden set, retrieval and generation metrics, baseline numbers recorded.
6. **RAG v2:** hybrid search, reranking, query transformation; use the harness to prove each improvement.
7. **Hardening:** load tests, chaos tests, security review, dashboards, CI quality gate.
8. **Polish:** README, architecture diagram, benchmark report, demo app, short write-up or blog post.

## 11. Metrics to Capture for Resume Bullets

Measure these in your own runs and only claim what you measured. Placeholders show the shape of a strong bullet.

- Gateway overhead: added p95 latency vs calling the provider directly
- Throughput: sustained requests per second under k6 load
- Cache: hit rate and cost reduction on a repeated-query workload
- Resilience: success rate during a simulated provider outage with fallback enabled
- Retrieval quality: Recall@5 / MRR for dense-only vs hybrid vs hybrid + rerank
- Answer quality: faithfulness score before vs after improvements
- Scale: number of documents and chunks indexed, ingestion throughput

**Bullet templates**

- Built an OpenAI-compatible LLM gateway in Node.js with multi-provider routing, circuit breaking and Redis token-bucket rate limiting, adding under `[X]` ms p95 overhead at `[Y]` req/s.
- Implemented exact and semantic response caching, reducing LLM spend by `[X]%` on a repeated-query workload.
- Designed a multi-tenant RAG pipeline with async ingestion, hybrid retrieval (vector + BM25 with RRF) and cross-encoder reranking, improving Recall@5 from `[A]` to `[B]`.
- Built an automated evaluation harness (Recall@k, MRR, LLM-judged faithfulness) integrated into CI to block quality regressions.

## 12. Concept Coverage Checklist (interview talking points)

- **LLM concepts:** tokenization, context windows, temperature and sampling, streaming, tool calling, structured output, embeddings, cosine similarity
- **Retrieval concepts:** ANN indexes (HNSW vs IVF), BM25, RRF, reranking, chunking trade-offs, query expansion, HyDE, MMR
- **Evaluation concepts:** golden sets, LLM-as-judge and its biases, offline vs online evaluation, regression testing
- **Backend concepts:** rate limiting algorithms, caching strategies, queues, idempotency, backpressure, circuit breakers, retries with jitter
- **Distributed systems:** stateless services, shared state, consistency of counters, at-least-once delivery, graceful degradation
- **Observability:** metrics, logs, traces, SLOs, alerting
- **Security:** API key management, tenant isolation, prompt injection, PII handling
- **Engineering practice:** testing pyramid, CI/CD, containerization, ADRs, documentation

For each item, be ready to answer: what did you build, why did you choose it over the alternative, what broke, and how did you measure it.
