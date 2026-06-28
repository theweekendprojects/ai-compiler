# AI Compiler

> The first AI-native programming language. Write intent. The AI VM executes it.

**[aicompiler.dev](https://aicompiler.dev)** — try the live demo, no account needed.

![AI Compiler demo](docs/screenshots/demo.gif)

```
.aic  →  aicompiler compile  →  .aix  →  aivm run  →  output
```

## What it is

AI Compiler is a programming language where you write **what** you want to happen — not how. The compiler turns your program into `.aix` bytecode. The AI VM executes each step using a real language model.

```markdown
# Workflow: ProcessRefund

## Inputs
- orderId: the order to refund

## Tools
- database: PostgreSQL
- payment: Stripe API
- email: SendGrid

## Steps

### 1. LoadOrder
Load the order from the database using {orderId}.
Fail with "Order not found" if no record exists.

### 2. IssueRefund
Refund {LoadOrder.total} via payment tool.
Store the confirmation id as refundConfirmationId.

### 3. NotifyCustomer
Email {LoadOrder.customerEmail} with the refund confirmation.
If email fails, log the error but do not halt.
```

Save that as `refund.aic`. Then:

```bash
aicompiler compile refund.aic   # produces refund.aix
aivm run refund.aix --input '{"orderId": "ORD-123"}'
```

## How it works

| Step | File | What happens |
|---|---|---|
| Write | `.aic` | You describe what to do in plain English |
| Compile | `aicompiler compile` | AI resolves all ambiguity → `.aix` bytecode |
| Run | `aivm run` | AI VM executes each step, calls real tools |

The `.aix` bytecode is structured JSON — human-readable, versionable in git, deterministic (lock files).

## Stack

- **Language:** `.aic` (Markdown-based workflow syntax)
- **Bytecode:** `.aix` (AI Executable — structured JSON opcodes)
- **Compiler:** Cloudflare Worker + Llama 3.3 70B
- **VM:** Cloudflare Worker + Llama 3.3 70B  
- **Web demo:** Astro 7 + React 19 + Monaco Editor
- **AI SDK:** Vercel AI SDK v7

## Project structure

```
ai-compiler/
├── packages/core/        # .aic parser, .aix compiler, AiVM engine
├── workers/aivm-worker/  # Cloudflare Worker — compile/run/stream API
├── web/                  # aicompiler.dev — landing page + live demo
├── cli/                  # aicompiler + aivm CLI (Node.js)
└── examples/             # hello.aic, UserService.aic
```

## Deploy

```bash
# Worker
cd workers/aivm-worker
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_API_TOKEN   # Workers AI Read token
npx wrangler deploy

# Web
cd web
CLOUDFLARE_API_TOKEN=<edit-workers-token> npx wrangler deploy
```

## Built by

[The Weekend Projects](https://github.com/theweekendprojects) — MIT License
