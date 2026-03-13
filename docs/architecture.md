# Synaptic Architecture

## Diagram

![Synaptic architecture](./architecture.svg)

## Source Diagram

```mermaid
flowchart LR
    U[User] --> F[Next.js / React Flow UI]
    F --> A[Next.js Route Handlers]
    A --> O[OpenAI Responses API]
    A --> E[Elasticsearch]
    A --> S[Supabase]

    O -->|structured idea generation| A
    O -->|embeddings| A
    E -->|similar idea search / indexed sessions| A
    S -->|sessions / ideas / edges| A
    A --> F
```

## Request lifecycle

```mermaid
sequenceDiagram
    participant User
    participant UI as Next.js UI
    participant API as Route Handler
    participant OpenAI as OpenAI API
    participant Elastic as Elasticsearch
    participant Supabase as Supabase

    User->>UI: Enter seed or expand/cross-check node
    UI->>API: POST action
    API->>OpenAI: Generate structured ideas or analysis
    API->>Supabase: Persist session snapshot + idea rows + edge rows
    API->>OpenAI: Create embeddings
    API->>Elastic: Index session and idea documents
    Elastic-->>API: Similar indexed ideas for retrieval/cross-check
    API-->>UI: Updated graph session JSON
```

## Stack

- Frontend: Next.js 16, React 19, React Flow, Tailwind CSS
- AI generation: OpenAI Responses API with structured JSON outputs
- Embeddings: OpenAI embeddings API
- Search/indexing: Elasticsearch dense vector + semantic search
- Persistence: Supabase tables for sessions, ideas, and idea edges

## Data model

- `sessions`
  - canonical session snapshot
  - graph JSON
  - insights JSON
  - one-pager JSON
- `ideas`
  - one row per node
  - parent-child relationship via `parent_id`
  - detailed idea dossier in JSON
  - prior-art results and cross-check metadata
- `idea_edges`
  - relationship labels and explanations for graph rendering

## Process responsibilities

- OpenAI
  - generate initial idea branches
  - generate child branches on expansion
  - generate critiques / tensions
  - generate one-pager
  - generate embeddings for semantic indexing

- Elasticsearch
  - index sessions for retrieval
  - index individual ideas for similarity search
  - return nearest prior internal ideas during cross-check

- Supabase
  - primary source of truth for sessions
  - normalized storage for ideas and edges
  - backing store for resumable/shareable sessions
