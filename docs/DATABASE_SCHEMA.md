# Database Schema

The MVP uses **SQLite** via SQLAlchemy ORM (`fortivex.db`) and is configured via `DATABASE_URL` to switch seamlessly to **PostgreSQL** in production.

## Entity-Relationship Diagram

```mermaid
erDiagram
    USERS {
        int id PK
        string full_name
        string email UK
        string hashed_password
        string role
        bool is_active
        datetime created_at
    }
    LEADS {
        int id PK
        string name
        string email
        string phone
        string company
        string industry
        string budget
        string timeline
        text requirements
        string status
        int lead_score
        string priority
        string sentiment
        string buying_intent
        string qualification_status
        string preferred_language
    }
    CALLS {
        int id PK
        int lead_id FK
        string customer_name
        string language
        string mode
        string status
        string current_phase
        string sentiment
        string buying_intent
        int duration_seconds
        datetime started_at
        datetime ended_at
    }
    MESSAGES {
        int id PK
        int call_id FK
        string role
        text content
        string language
        string sentiment
        string buying_intent
        string phase
        text sources_json
        datetime created_at
    }
    APPOINTMENTS {
        int id PK
        int lead_id FK
        int call_id FK
        string customer_name
        string customer_email
        string appointment_date
        string appointment_time
        string purpose
        string status
        string calendar_provider
    }
    KNOWLEDGE_DOCUMENTS {
        int id PK
        string title
        string category
        string file_name
        string file_type
        text content
        int chunk_count
    }
    KNOWLEDGE_CHUNKS {
        int id PK
        int document_id FK
        int chunk_index
        text content
        text embedding_json
    }
    CALL_SUMMARIES {
        int id PK
        int call_id FK UK
        text summary
        text customer_requirements
        text customer_objections
        string sentiment
        string buying_intent
        string lead_qualification_result
        float lead_score
        text follow_up_recommendations
        text appointment_details
    }

    LEADS ||--o{ CALLS : "has"
    LEADS ||--o{ APPOINTMENTS : "schedules"
    CALLS ||--o{ MESSAGES : "contains"
    CALLS ||--o| CALL_SUMMARIES : "generates"
    CALLS ||--o{ APPOINTMENTS : "books"
    KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_CHUNKS : "splits_into"
```
