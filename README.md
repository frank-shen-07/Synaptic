# Synaptic

Synaptic is a full-stack idea exploration app. A user enters one seed idea, gets a graph of AI-generated directions, clicks into any node to inspect a structured dossier, runs cross-checks against external sources, and exports the session as a one-pager.

## Current product behavior

- Start with one seed idea
- Generate up to 5 top-level idea nodes
- Expand a node into up to 5 child ideas
- Render idea nodes as a clean circular graph
- Open a modal on node click for full idea details
- Run cross-check on demand from the node modal
- Export a one-pager PDF
- Sign in with email/password or Google
- Verify email and reset passwords with Supabase Auth
- Persist sessions, ideas, and edges in Supabase
- Run Exa, patent, and GitHub cross-checks with Jina reranking

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- React Flow
- D3
- OpenAI Responses API for structured generation
- Exa for web and paper search
- Serper patents for patent lookup
- GitHub search for repository discovery
- Jina reranker for prior-art ordering
- Supabase for canonical persistence

## Architecture

The runtime split is:

- OpenAI
  - idea generation
  - node expansion
  - critique / tension analysis
  - one-pager generation

- External search
  - Exa web and paper search
  - Serper patent search
  - GitHub repository search
  - Jina reranking for final match ordering

- Supabase
  - Auth for login, Google OAuth, email verification, and recovery
  - source of truth for sessions
  - normalized storage for ideas and edges
  - per-user session ownership and privacy

Diagram assets:

- [Architecture doc](/Users/frankshen/Documents/GitHub/Synaptic/docs/architecture.md)
- [Architecture SVG](/Users/frankshen/Documents/GitHub/Synaptic/docs/architecture.svg)
- [Auth setup doc](/Users/frankshen/Documents/GitHub/Synaptic/docs/auth.md)

## Environment

Create a `.env.local` file from [.env.example](/Users/frankshen/Documents/GitHub/Synaptic/.env.example).

Required variables:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

EXA_API_KEY=
SERPER_API_KEY=
JINA_API_KEY=

SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Recommended:

- Use `gpt-5-mini` for generation
- `NEXT_PUBLIC_SUPABASE_URL` should usually match `SUPABASE_URL`
- Do not use `SUPABASE_SERVICE_ROLE_KEY` in client-side code

## Setup

1. Install dependencies
2. Create `.env.local`
3. Run [0001_synaptic.sql](/Users/frankshen/Documents/GitHub/Synaptic/supabase/migrations/0001_synaptic.sql)
4. Run [0002_auth_ownership.sql](/Users/frankshen/Documents/GitHub/Synaptic/supabase/migrations/0002_auth_ownership.sql)
5. Configure Supabase Auth URLs and Google provider settings from [auth.md](/Users/frankshen/Documents/GitHub/Synaptic/docs/auth.md)
6. Start the app

```bash
npm install
npm run dev
```

`npm install` will pull in the graph renderer dependencies, including `d3` and the TypeScript dev types for it.

If you are adding them manually for any reason:

```bash
npm install d3
npm install -D @types/d3
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
```

## Important notes

- Existing saved sessions keep the content they were generated with. Improvements to generation affect new sessions and new expansions.
- Cross-check is on-demand from the node modal, not automatic on initial graph generation.
- If OpenAI returns brittle or low-quality structured output, switch to a stronger generation model before debugging the parser.
- Sessions are now private to the authenticated Supabase user. Older rows without `user_id` will not appear in the app.

## Key files

- [app/page.tsx](/Users/frankshen/Documents/GitHub/Synaptic/app/page.tsx): landing page and session launcher
- [app/session/[id]/page.tsx](/Users/frankshen/Documents/GitHub/Synaptic/app/session/[id]/page.tsx): shareable session route
- [components/graph-workbench.tsx](/Users/frankshen/Documents/GitHub/Synaptic/components/graph-workbench.tsx): main graph UI and node modal
- [components/thought-node.tsx](/Users/frankshen/Documents/GitHub/Synaptic/components/thought-node.tsx): circular node renderer
- [lib/agent/engine.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/agent/engine.ts): session orchestration
- [lib/agent/search.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/agent/search.ts): cross-check search pipeline
- [lib/integrations/openai.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/integrations/openai.ts): OpenAI generation helpers
- [lib/integrations/supabase.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/integrations/supabase.ts): Supabase admin client
- [lib/integrations/supabase-browser.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/integrations/supabase-browser.ts): browser auth client
- [lib/integrations/supabase-server.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/integrations/supabase-server.ts): server auth client
- [proxy.ts](/Users/frankshen/Documents/GitHub/Synaptic/proxy.ts): auth session refresh
- [lib/storage/sessions.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/storage/sessions.ts): Supabase persistence layer
- [lib/graph/schema.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/graph/schema.ts): graph/session schema
- [lib/graph/layout.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/graph/layout.ts): graph layout
