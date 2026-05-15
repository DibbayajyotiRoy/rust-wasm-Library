# Newsletter pitch outlines

> **Internal scratch file.** Not shipped to npm. Personalize each outline in your own voice before sending — most newsletter editors filter aggressively for AI-generated pitches, and a robotic "Hi [Name], I built X..." opener gets archived instantly.
>
> **The principle behind each pitch:** 2 short paragraphs max, one specific value-prop line, one concrete number (size / speed / downloads), one link. Editors get 100+ pitches a week and skim in under 10 seconds.

---

## 1. JavaScript Weekly

| Field | Value |
|---|---|
| **Newsletter** | <https://javascriptweekly.com/> |
| **Editor** | Peter Cooper |
| **Email** | `peter@cooperpress.com` |
| **Subscribers** | ~80,000 |
| **Realistic outcome** | One-line mention with link → 80–200 stars + 200–500 npm downloads in the issue's week |
| **Tone** | Technical, peer-to-peer, no marketing-speak. Cooper is famously allergic to fluff. |

### What to write (outline)

- **Subject:** `Newsletter pitch: diffcore — WASM JSON diff with RFC 6902 + 3-way merge`
- **Para 1 (3–4 sentences):**
  - What it is in plain words.
  - **One** technically interesting detail (your choice — the FNV-1a rolling path hash, the SIMD structural index, the bug post-mortem, the 38 KB WASM bundle, the AGENTS.md ship).
  - The single most specific number that proves it works (npm downloads, GitHub stars, benchmark vs JS).
- **Para 2 (2 sentences):**
  - Where to look: the GitHub URL and the npm URL.
  - One line: "No need to feature it — just sharing in case it fits."  ← critical, removes pressure.
- **Sign-off:** your real first name. Nothing else.

### Things NOT to include

- ❌ Listing every feature
- ❌ "Industry-leading" / "revolutionary" / "next-gen"
- ❌ Asking for a callback or commitment
- ❌ Attached PDFs / press kits

### Submit when

Any weekday, 9 AM US Eastern. Cooper triages on Mondays for the Friday issue.

---

## 2. Node Weekly

| Field | Value |
|---|---|
| **Newsletter** | <https://nodeweekly.com/> |
| **Editor** | Peter Cooper (same publisher as JS Weekly) |
| **Email** | `peter@cooperpress.com` |
| **Subscribers** | ~60,000 |
| **Realistic outcome** | One-line mention → 30–80 stars + Node-specific downloads bump |
| **Tone** | Same as JS Weekly — technical, terse. |

### What to write (outline)

Same shape as JS Weekly, but the **one technically interesting detail** should lean **server-side / Node-specific**:

- Mention CLI exit codes for CI pipelines (`npx diffcore a.json b.json --silent` → exit 0/1/2)
- OR mention streaming engine for large file diffs (`pushLeft` / `pushRight` via DMA into WASM linear memory — no `_malloc` per chunk)
- OR mention zero runtime dependencies — important to Node devs auditing supply chain

### Send it in the same email as the JS Weekly pitch

Since it's the same editor, send **one email** mentioning both — Cooper will route it to whichever newsletter fits better, or both:

- **Subject:** `Pitch for JS Weekly and/or Node Weekly: diffcore`
- **Open:** "Hi Peter — pitch for either newsletter, your call on fit:"
- Then the same 2-para body.

### Submit when

Same as JS Weekly. Mondays AM is the sweet spot.

---

## 3. Bytes.dev

| Field | Value |
|---|---|
| **Newsletter** | <https://bytes.dev/> |
| **Editors** | Tyler McGinnis + team |
| **Submit URL** | <https://bytes.dev/submit> (web form, no email) |
| **Subscribers** | ~100,000+ |
| **Realistic outcome** | One-line link → 50–150 stars + 300–700 downloads in the issue's week |
| **Tone** | Witty, conversational. Bytes.dev cultivates a personality — your pitch can be slightly playful. |

### What to write (outline)

Bytes.dev has a submission form with a few fields. Fill it like this:

- **Tool / Library name:** `diffcore`
- **URL:** `https://github.com/DibbayajyotiRoy/rust-wasm-Library`
- **One-line description (your version of):**
  "A WebAssembly JSON diff library that gives you actual JSON Pointer paths and ships undo/redo + three-way merge alongside the diff."
- **Why is this interesting? (3–4 sentences in your voice):**
  - What you found broken about existing JSON diff libraries
  - The wedge: most are either stale or missing standard RFC 6902 output
  - The unusual bit: 38 KB WASM, ships AGENTS.md for AI agents

### Tone calibration

Bytes.dev hates corporate-speak. The pitch should sound like one developer telling another about a thing they built. Read a few past Bytes issues at <https://bytes.dev/archives> before writing to get the voice.

### Submit when

Their form accepts submissions anytime. The team batches every couple weeks.

---

## 4. This Week in Rust

| Field | Value |
|---|---|
| **Publication** | <https://this-week-in-rust.org/> |
| **How to submit** | PR to <https://github.com/rust-lang/this-week-in-rust> |
| **Subscribers** | ~30,000 Rust devs, plus syndicated everywhere |
| **Realistic outcome** | One-line mention → 20–60 stars from Rust-curious devs |
| **Tone** | Strictly factual. No marketing voice. |

### What to write (outline)

This is a **GitHub PR**, not an email. You:

1. Fork <https://github.com/rust-lang/this-week-in-rust>
2. Find the latest `draft/YYYY-MM-DD-this-week-in-rust.md` file in the `draft/` folder
3. Add a one-line entry under **"Crate of the Week"** or **"Project of the Week"** or **"Updates from the Rust Project"** (read what others added, match the format)

### Entry format (your version of):

```markdown
- [diffcore](https://github.com/DibbayajyotiRoy/rust-wasm-Library) —
  a fast WebAssembly JSON diff engine written in Rust. Emits standard
  RFC 6902 JSON Patch output; ships with applyPatch, revertPatch,
  three-way merge, and a React hook. 38 KB WASM.
```

### Tips

- Keep it under 50 words.
- Don't editorialize ("amazing", "blazing fast" — Rust community is allergic to hype).
- Mention WebAssembly explicitly — it's what makes this Rust-relevant.
- Submit before the Tuesday cutoff for the Wednesday issue.

---

## 5. Bonus — Console.dev (high quality, low volume)

| Field | Value |
|---|---|
| **Newsletter** | <https://console.dev/> |
| **Submit URL** | <https://console.dev/submit/> |
| **Audience** | Curated developer-tool aficionados |
| **Realistic outcome** | Editorial review → if accepted, deep mention (full paragraph) → 100–300 stars |

### What to write (outline)

Console.dev is selective and writes editorial-style. Your submission needs to make the case in their form:

- **Why is your tool interesting?** Three differentiators in plain words (you already have them: real JSON Pointer paths, state-management primitives, AI-agent ready).
- **Who is it for?** Developers building state-sync, undo/redo, collab editing, audit logs.
- **What's the maintainer story?** Solo / small team, MIT license, actively shipped. Mention v1.2.0 with 500+ downloads as social proof of "not vanity."

### Submit when

Anytime — they review on a slow editorial cadence (every 2-4 weeks).

---

## Sequencing — the order I'd send

| Week | Action | Expected outcome |
|---|---|---|
| 1 | JS Weekly + Node Weekly (one email, both newsletters) | 1st mention 1-3 weeks out |
| 1 | This Week in Rust PR | mention next Wed |
| 1 | Bytes.dev form | mention 2-4 weeks out |
| 2 | Console.dev form | editorial review |
| 4 | Follow up with Cooper if no JS/Node Weekly mention | gentle nudge — one line |
| 6 | Repeat for any newsletter that hasn't mentioned you | new angle (e.g. "v1.3 just landed") |

## What to expect

- **Most pitches get ignored.** Even excellent pitches have ~30% feature rates.
- **Don't take silence personally.** Editors triage hundreds.
- **One yes = compounding.** A single JS Weekly mention can outperform a year of social posts.
- **Don't ask "did you see my pitch?"** more than once. Move on.

## After a mention lands

When a newsletter features diffcore:

1. Note the date + outlet in `competitive-landscape.md` under a "marketing log" section (you can ask me to set this up).
2. Star bump usually peaks on issue-publish day + day 1.
3. Watch download numbers via `https://api.npmjs.org/downloads/range/...` for 14 days after.
4. If the bump is meaningful, send a polite thank-you to the editor (keeps doors open for the next pitch).
