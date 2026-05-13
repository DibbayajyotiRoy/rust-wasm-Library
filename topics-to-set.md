# GitHub topics to set on the repo

> This is a **scratch/working** file — not for inclusion in releases. Use it
> as a checklist while configuring the repository's GitHub topics, then
> delete the file (or move it to `.github/` if you want to keep it for
> reference). It is intentionally NOT listed in `package.json` `files`,
> so it won't ship to npm.

GitHub topics are a separate signal from npm `keywords[]`. They drive:

- The `https://github.com/topics/<topic>` directory pages — anyone browsing topics finds your repo.
- GitHub's repo-search ranking.
- Public discoverability surfaces that LLM crawlers and code-search tools index.

## How to set them

1. Open the repo home page: <https://github.com/DibbayajyotiRoy/rust-wasm-Library>
2. Click the **⚙️ gear icon** next to the "About" panel on the right.
3. In the **Topics** field, paste the comma-separated list below.
4. Click **Save changes**.

Limits GitHub enforces:
- Max **20 topics**
- Lowercase only, **dashes** (no underscores), max 50 chars per topic
- No leading/trailing dashes

## Recommended set (20 topics, paste this)

```
json-diff, json-patch, rfc-6902, json-pointer, webassembly, rust, wasm, typescript, three-way-merge, state-management, undo-redo, optimistic-ui, react-hook, cli, diff, patch, delta, audit-log, performance, simd
```

## Rationale per topic

| Topic | Why |
|---|---|
| `json-diff` | Primary search intent; the term most people type into GitHub topic search. |
| `json-patch` | RFC 6902-focused users land here. |
| `rfc-6902` | Spec-driven users; high signal, low competition. |
| `json-pointer` | RFC 6901, ditto. |
| `webassembly` | One of the largest tech topics on GitHub; surfaces in trending pages. |
| `rust` | Cross-discovers the Rust community; pulls in non-JS devs curious about WASM tools. |
| `wasm` | Short-form synonym for `webassembly`; both topic pages exist on GitHub. |
| `typescript` | High-traffic ecosystem topic; first-party TypeScript support is a selling point. |
| `three-way-merge` | Niche but high-intent — collaborative-editing folks land here directly. |
| `state-management` | Umbrella term; pulls in Redux / Zustand / Jotai-curious devs. |
| `undo-redo` | Editor-builders search this. |
| `optimistic-ui` | Trendy term in 2024-2026; CRUD-app developers search this. |
| `react-hook` | The React ecosystem indexes this topic heavily. |
| `cli` | You ship a CLI; people search for tools, not just libraries. |
| `diff` | Generic but unavoidable; large topic page traffic. |
| `patch` | Generic, but pairs with `diff` semantically. |
| `delta` | Common synonym (replication / database / sync queries). |
| `audit-log` | Compliance / financial-software developers search this. |
| `performance` | High-volume topic; you have legit perf numbers. |
| `simd` | Niche but on-brand and unusual for a JS package — stands out. |

## Topics I deliberately omitted

- `nodejs` — too generic; npm keyword covers this, GitHub slot better used elsewhere.
- `claude`, `gpt`, `anthropic`, `openai`, `cursor` — cargo-culty; AI agents find the package via `AGENTS.md` content, not via brand-name topics. GitHub may also flag these as off-topic.
- `awesome`, `library`, `package`, `tool` — meta-topics that don't drive discovery.
- `bun`, `deno`, `cloudflare-workers`, `vercel-edge` — runtime-specific; the README covers them, and GitHub's runtime topic pages are sparse.
- `mcp`, `model-context-protocol` — premature; add when `diffcore-mcp` ships.

## When to revisit

- After **`diffcore-mcp`** launches: drop `simd` (still informative but lower intent) and add `mcp` or `model-context-protocol`.
- After **Vue/Svelte/Solid hooks** ship: drop one of the lower-volume topics for `vue-composable`, `svelte-store`, or `solid-signal`.
- If you go past **1k stars**: consider replacing `delta` with a more specific term like `collaborative-editing` or `state-sync`.
