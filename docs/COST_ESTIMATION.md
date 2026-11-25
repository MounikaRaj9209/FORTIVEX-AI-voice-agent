# Operating Cost Estimation

> **Note**: Provider rates vary by region, contract volume, and model tier. The figures below use **configurable unit-cost assumptions** rather than guaranteed vendor prices.

## Configurable Pricing Assumptions

| Component | MVP Assumption (Demo Mode) | Live AI Assumption (Configurable Unit Rate) |
|---|---|---|
| LLM (`gpt-4o-mini` class) | \$0 (Local deterministic engine) | ~\$0.002 per 3-minute call (~2,500 input + 600 output tokens) |
| Speech-to-Text (`whisper-1` class) | \$0 (Browser Web Speech API) | ~\$0.006 / minute |
| Text-to-Speech (`tts-1` class) | \$0 (Browser `speechSynthesis`) | ~\$0.004 / minute (based on ~150 spoken chars/min) |
| Embeddings | \$0 (Local feature-hashing vectors) | <\$0.0001 per knowledge document |
| Compute, DB & Vector Store | \$0 local / \$15–\$25/mo single VPS | Scaled cloud tier (see below) |

## Scenario A: Small MVP Deployment (~1,000 calls/month, avg 3 min/call = 3,000 mins)

- **Demo Mode (No paid AI APIs)**:
  - Compute (1 small container / VPS): \$12 – \$20 / month
  - SQLite / Managed Postgres hobby tier: \$0 – \$15 / month
  - **Total MVP Demo Mode**: **~\$12 – \$35 / month**
- **Live AI Mode (3,000 voice minutes/month)**:
  - LLM calls: 1,000 × \$0.002 = ~\$2.00
  - STT (3,000 min × \$0.006): ~\$18.00
  - TTS (3,000 min × \$0.004): ~\$12.00
  - Hosting + Managed Postgres + Storage: ~\$35.00
  - **Total MVP Live AI Mode**: **~\$67 / month**

## Scenario B: Production Scale (100,000 Registered Users, ~50,000 active calls/month = 150,000 mins)

- **AI Inference (150,000 voice minutes/month)**:
  - LLM Orchestration + Summaries: ~\$120 – \$250
  - STT (150,000 min × \$0.006): ~\$900 (reducible via self-hosted Whisper on GPU nodes)
  - TTS (150,000 min × \$0.004): ~\$600
- **Cloud Infrastructure**:
  - Kubernetes / ECS Backend Pods (4–12 vCPU autoscaled): ~\$350 – \$600
  - Managed PostgreSQL (HA + Read Replica): ~\$250 – \$450
  - Redis Cluster (caching & rate limiting): ~\$80 – \$150
  - Managed Vector DB (pgvector / Qdrant): ~\$100 – \$250
  - Object Storage (S3/GCS) + Monitoring (Grafana/Datadog): ~\$120 – \$250
- **Estimated Production Total**: **~\$2,520 – \$3,450 / month** (~ \$0.05 – \$0.07 per 3-minute AI sales call)
