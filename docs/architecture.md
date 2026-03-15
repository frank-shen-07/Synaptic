# Synaptic Architecture

## Diagram

The checked-in `architecture.svg` predates the current cross-check pipeline. Use the Mermaid diagrams below as the source of truth.

## Source Diagram

```mermaid
flowchart LR
    U[User] --> F[Next.js / React Flow UI]
    F --> A[Next.js Route Handlers]
    A --> O[OpenAI Responses API]
    A --> X[Exa]
    A --> P[Serper patents]
    A --> G[GitHub REST API]
    A --> E[Elasticsearch]
    A --> J[Jina reranker]
    A --> S[Supabase]

    O -->|structured idea generation| A
    X -->|web + paper results| A
    P -->|patent results| A
    G -->|repository results| A
    E -->|indexed corpus results| A
    J -->|reranked matches| A
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
    participant Exa as Exa
    participant Serper as Serper patents
    participant GitHub as GitHub REST API
    participant Elastic as Elasticsearch
    participant Jina as Jina reranker
    participant Supabase as Supabase

    User->>UI: Enter seed or expand/cross-check node
    UI->>API: POST action
    API->>OpenAI: Generate structured ideas or analysis
    API->>Supabase: Persist session snapshot + idea rows + edge rows
    API->>Exa: Search web + paper sources
    API->>Serper: Search patents
    API->>GitHub: Search repositories
    API->>Elastic: Search indexed corpus
    Exa-->>API: Candidate prior-art hits
    Serper-->>API: Candidate patent hits
    GitHub-->>API: Candidate repo hits
    Elastic-->>API: Candidate indexed hits
    API->>Jina: Rerank deduplicated hits
    Jina-->>API: Final ordered prior-art hits
    API-->>UI: Updated graph session JSON
```

## Stack

- Frontend: Next.js 16, React 19, React Flow, Tailwind CSS
- AI generation: OpenAI Responses API with structured JSON outputs
- Search: Exa, Serper patents, GitHub REST API, optional Elasticsearch, Jina reranker
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

- External search
  - search web and paper sources via Exa
  - search patents via Serper
  - search repositories via GitHub
  - search an optional indexed corpus via Elasticsearch
  - rerank combined results via Jina

- Supabase
  - primary source of truth for sessions
  - normalized storage for ideas and edges
  - backing store for resumable/shareable sessions
