# Scalability Architecture (100,000 Registered Users)

> **Important Distinction**: The local MVP built in this repository runs on a single FastAPI process with SQLite and in-process vector search for zero-dependency evaluation. It has **not** been load-tested at 100,000 users. Below is the proposed production architecture to scale this codebase to 100,000+ registered users and thousands of concurrent voice sessions.

## MVP vs. Production-Scale Architecture

| Layer | Local MVP (Implemented) | 100,000-User Production Blueprint |
|---|---|---|
| API & Compute | Single Uvicorn/FastAPI instance | Stateless FastAPI pods behind ALB/NGINX Ingress with Horizontal Pod Autoscaler (HPA) |
| Database | SQLite (`fortivex.db`) | Managed PostgreSQL (Primary + Read Replicas + PgBouncer connection pooling) |
| Caching & State | In-process memory | Redis Cluster for JWT revocation, rate limiting, slot locks, and active call state |
| Async Jobs | Synchronous / FastAPI async | Celery / ARQ workers backed by RabbitMQ or Redis Streams for PDF ingestion & post-call summaries |
| Vector Search | JSON embeddings in `knowledge_chunks` | Dedicated pgvector (HNSW index) or managed Qdrant / Pinecone / Milvus cluster |
| File & Audio Storage | In-memory upload read | Amazon S3 / GCS with pre-signed URLs for PDFs and call recordings |
| Voice Transport | REST + WebSocket turn-based | Dedicated WebRTC / SIP media gateways (LiveKit / Twilio Media Streams) + streaming STT/TTS |
| Deployment | Docker Compose | Kubernetes (EKS/GKE) or AWS ECS Fargate across multiple Availability Zones |

## Key Scaling Strategies

1. **Stateless Backend Services**: Keep JWT validation and conversation context externalized in Redis + PostgreSQL so any FastAPI pod can serve any request or reconnect a WebSocket.
2. **Database Optimization**:
   - Index `leads(status, updated_at)`, `appointments(appointment_date, appointment_time)` with a partial unique constraint `WHERE status != 'Cancelled'` to enforce double-booking protection atomically at the DB level.
   - Partition `messages` and `calls` tables monthly by `created_at`.
3. **Background Workers & Message Queues**: Offload PDF parsing, chunk embedding generation, CRM webhook delivery, and post-call LLM summarization to worker queues so user-facing voice turns remain under 500ms.
4. **Rate Limiting & Circuit Breakers**: Enforce per-tenant token-bucket rate limits in Redis at the API gateway and circuit-break external LLM/STT/TTS calls with graceful fallback.
5. **Observability**: Export OpenTelemetry traces, Prometheus metrics (P95 turn latency, token spend, STT error rate), and structured JSON logs to Grafana / Datadog.
