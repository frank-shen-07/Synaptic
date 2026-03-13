# Synaptic

Synaptic is a full-stack Next.js MVP for one complete thinking session:

- enter one seed idea
- generate a structured thought graph
- expand nodes deeper or wider
- label relationships between nodes
- run devil's-advocate critique
- crosscheck live prior art from web and GitHub search
- surface tensions/conflicts
- export a one-pager as PDF

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- React Flow for the graph canvas
- OpenAI Responses API + embeddings
- Elasticsearch indexing and semantic search
- Supabase persistence
- Typed server-side graph/agent pipeline in `lib/agent`

## Architecture

The app follows the same shape as the requested system:

1. Frontend action
2. API route
3. Server-side typed tool/agent operation
4. Structured graph JSON returned
5. Session persisted
6. Graph re-rendered

Current service expectations:

- OpenAI for structured generation and embeddings
- Elasticsearch for semantic search and idea/session indexing
- Supabase for sessions, ideas, and edges

## Run

1. Create `.env.local` from `.env.example`
2. Apply [supabase/migrations/0001_synaptic.sql](/Users/frankshen/Documents/GitHub/Synaptic/supabase/migrations/0001_synaptic.sql) in Supabase
3. Start the app

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
```

## Key Files

- `app/page.tsx`: landing page and session launcher
- `app/session/[id]/page.tsx`: shareable thinking session route
- `components/graph-workbench.tsx`: graph UI, expansion, crosscheck, export
- `lib/graph/schema.ts`: graph/session schema
- `lib/agent/engine.ts`: OpenAI-backed seed expansion, node expansion, critique, tension detection, one-pager generation
- `lib/agent/search.ts`: Elasticsearch + web prior-art crosscheck
- `lib/storage/sessions.ts`: Supabase persistence
- `docs/architecture.md`: architecture and request-flow diagrams
