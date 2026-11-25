# Security Architecture

## Controls Implemented in the MVP

1. **Authentication & Password Hashing**:
   - Passwords hashed with `bcrypt` via `passlib`.
   - Stateless `HS256` JWT bearer tokens with configurable expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`).
   - Protected routes enforce `get_current_user` dependency (`401 Unauthorized` on missing/invalid tokens).
2. **Secret & Environment Hygiene**:
   - All secrets (`SECRET_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`) are loaded via `pydantic-settings` from `.env` / environment variables; zero secrets are hardcoded in source.
   - `.env.example` documents required variables safely.
3. **Input & Upload Validation**:
   - Strict Pydantic schemas validate email formats, appointment `YYYY-MM-DD` / `HH:MM` patterns, string lengths, and allowed lead status enums.
   - Knowledge uploads restrict extensions to `.pdf`, `.txt`, `.md`, `.csv` and enforce a 5 MB file size cap.
4. **CORS & Transport**:
   - Explicit allowlist via `CORS_ORIGINS` (no wildcard `*` with credentials).
5. **PII Minimization**:
   - Application avoids logging raw customer transcripts, phone numbers, or passwords to stdout.

## Production Hardening Checklist

- Rotate `SECRET_KEY` using a KMS/Secrets Manager and enforce HTTPS/WSS via TLS 1.3 at the load balancer.
- Add per-IP and per-user rate limiting on `/api/auth/login` and `/api/ai/*`.
- Enable tenant-level Row-Level Security (RLS) in PostgreSQL for multi-organization isolation.
- Encrypt sensitive PII columns (customer phone/email) and call recordings at rest with customer-managed keys.
