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
- File-backed JSON persistence in `.data/sessions`
- Typed server-side graph/agent pipeline in `lib/agent`

## Architecture

The app follows the same shape as the requested system:

1. Frontend action
2. API route
3. Server-side typed tool/agent operation
4. Structured graph JSON returned
5. Session persisted
6. Graph re-rendered

Current local adapters:

- Persistence uses local JSON files instead of Supabase
- Crosscheck uses live DuckDuckGo HTML search plus GitHub repository search
- The reasoning pipeline is deterministic/template-driven rather than calling an external LLM

That keeps the demo runnable without external credentials while preserving a clean seam for swapping in:

- Elastic Agent Builder / Elasticsearch retrieval
- Supabase persistence
- A hosted model provider for stricter AI generation

## Run

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
- `lib/agent/engine.ts`: seed expansion, node expansion, critique, tension detection, one-pager generation
- `lib/agent/search.ts`: live prior-art crosscheck
- `lib/storage/sessions.ts`: local persistence
