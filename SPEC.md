# AI Compiler — Internal Product Spec

## What it is

The first AI-native programming language. You write intent in `.aic` files.
The compiler produces `.aibc` bytecode. The AI VM executes it.

```
.aic  →  aicompiler compile  →  .aibc  →  aivm run  →  output
```

No boilerplate. No syntax errors. Just intent.

---

## The pipeline

| Step | File | Tool | Description |
|---|---|---|---|
| 1 | `.aic` | you write it | Plain-English spec — module, context, intents |
| 2 | `.aibc` | `aicompiler compile` | AI bytecode — JSON enriched with tool bindings, model, cache hints |
| 3 | output | `aivm run` | AI VM reads bytecode, executes each intent via LLM, streams result |

### Why 2 steps (like Java)?
Between compile and run you can inject:
- Tool bindings (which DB, which API)
- Provider/model selection per intent
- Security policies
- Cache hints
- Retry policies
- Lock files for deterministic re-runs

---

## .aic syntax

```
module UserService
version 1.0

context:
  A REST API for managing users in PostgreSQL.

tools: [database, http]

intent getAdultUsers:
  Get all users where age > 18, sorted by name.

  input:
    - none

  output:
    - array of user objects: id, name, email, age
```

---

## AI providers

| Provider | Model | Use case |
|---|---|---|
| Anthropic | claude-opus-4-5 | Default, best quality |
| Amazon Bedrock | us.amazon.nova-micro-v1:0 | Fast, cheap routing |
| Google Vertex | gemini-flash | (Phase 2) |
| Cloudflare Workers AI | llama / mistral | (Phase 2, free) |

All routed through **Cloudflare AI Gateway** for:
- Analytics (tokens, cost, latency)
- Caching (same intent = no API call)
- Rate limiting
- Model fallback

---

## Repo structure

```
ai-compiler/                          github.com/theweekendprojects/ai-compiler
├── packages/core/                    .aic parser, .aibc compiler, AiVM engine
│   └── src/
│       ├── parser/index.ts           parseAic(source) → AicSpec
│       ├── compiler/index.ts         compile(spec) → AibcBytecode
│       ├── vm/index.ts               AiVM.execute() / .streamExecute()
│       └── types/index.ts            all shared types
├── workers/aivm-worker/              Cloudflare Worker (Hono)
│   └── src/
│       ├── handlers/compile.ts       POST /compile  → .aibc JSON
│       ├── handlers/run.ts           POST /run      → execute all intents
│       ├── handlers/stream.ts        POST /stream   → SSE stream single intent
│       └── index.ts                  + POST /compile-run shortcut
├── web/                              aicompiler.dev (Astro 7 + CF Pages)
│   └── src/
│       ├── pages/index.astro         landing page + live demo
│       ├── components/LiveDemo.tsx   Monaco editor + compile + stream output
│       └── styles/global.css         dark theme, aurora, glass cards
└── cli/                              npm: aicompiler + aivm commands
    └── bin/
        ├── aicompiler.js             aicompiler compile app.aic → app.aibc
        └── aivm.js                   aivm run app.aibc
```

---

## Tech stack

| Layer | Choice | Version |
|---|---|---|
| AI SDK | Vercel AI SDK | 7.0.4 |
| Anthropic | @ai-sdk/anthropic | 4.0.1 |
| Amazon Bedrock | @ai-sdk/amazon-bedrock | 5.0.2 |
| Worker framework | Hono | 4.12.27 |
| Web framework | Astro | 7.0.3 |
| UI | React | 19.2.7 |
| Styling | Tailwind CSS v4 | 4.3.1 |
| Code editor | @monaco-editor/react | 4.7.0 |
| Validation | Zod | 4.4.3 |
| CLI | Commander | 15.0.0 |
| Deploy | Cloudflare Workers + Pages | wrangler 4.105.0 |

---

## Phases

### Phase 1 — Ship tonight ✅
- [x] packages/core — parser, compiler, AiVM
- [x] workers/aivm-worker — compile + run + stream API
- [x] web/ — landing page + live demo (Monaco + streaming output)
- [x] cli/ — aicompiler + aivm CLI
- [x] examples/ — hello.aic, UserService.aic
- [ ] Deploy aivm-worker to Cloudflare Workers
- [ ] Deploy web/ to Cloudflare Pages (aicompiler.dev)

### Phase 2 — Next weekend
- [ ] Add assistant-ui chat panel next to the editor
  - Users can run a spec, then chat about the output
  - "Change this intent to also filter by city"
  - Conversational spec editing
  - Uses AssistantChatTransport → /stream endpoint
- [ ] Add Google Vertex (Gemini) provider
- [ ] Add Cloudflare Workers AI provider (free inference)
- [ ] Lock files — .aibc.lock for deterministic re-runs
- [ ] VS Code extension — .aic syntax highlighting + inline errors
- [ ] npm publish — @theweekendprojects/ai-compiler

### Phase 3 — Future
- [ ] AI VM formal spec — opcodes, memory model, execution guarantees
- [ ] Multi-agent intents — one intent calls another
- [ ] Import system — `import UserService from "./user.aibc"`
- [ ] AI VM debugger — step through intent execution
- [ ] Paid API — hosted aivm with usage billing

---

## Deployment

### Worker
```bash
cd workers/aivm-worker
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
# URL: https://aivm-worker.theweekendprojects.workers.dev
```

### Web (Cloudflare Pages)
```bash
cd web
# Set env var: PUBLIC_WORKER_URL=https://aivm-worker.theweekendprojects.workers.dev
astro build
wrangler pages deploy dist --project-name ai-compiler-web
# Point aicompiler.dev → CF Pages
```

---

## Design decisions

| Decision | Rationale |
|---|---|
| 2-step pipeline (.aic → .aibc → run) | Allows enrichment between compile and run, like Java |
| .aibc is JSON not binary | Human-readable, versionable in git, debuggable |
| Vercel AI SDK as AI interface | Provider-agnostic — swap Anthropic for Bedrock with one env var |
| Cloudflare AI Gateway | Single proxy for all providers — analytics, caching, fallback |
| Hono for worker | Lightest CF-native framework, typed bindings |
| Astro for web | Static-first, CF Pages adapter, React islands only where needed |
| No assistant-ui in Phase 1 | Unnecessary for one-shot demo — add in Phase 2 for chat |
