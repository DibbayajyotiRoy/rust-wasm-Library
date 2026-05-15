# GitHub Repo About-Panel + Topics — Paste-Ready

> **Internal scratch file.** Not shipped to npm (not in `package.json` `files`). Apply the changes below in the GitHub UI in ~60 seconds; delete the file afterwards or keep for reference.

Open <https://github.com/DibbayajyotiRoy/rust-wasm-Library> → click the **⚙️ gear icon** next to the "About" panel on the right side of the page.

## Three fields to fill in

### 1. Description (short — under 150 chars for full visibility)

Paste this into the **"Description"** field:

```
Fast WebAssembly JSON diff for JS/TS. Real JSON Pointer paths, applyPatch, revertPatch, RFC 6902 output, undo/redo, 3-way merge, React hook, CLI.
```

(149 chars — fits cleanly in GitHub search results, npm cross-references, and social previews.)

### 2. Website

Paste this into the **"Website"** field:

```
https://rust-wasm-library.vercel.app
```

### 3. Topics (max 20)

Paste this comma-separated list into the **"Topics"** field:

```
json-diff, json-patch, rfc-6902, json-pointer, webassembly, rust, wasm, typescript, three-way-merge, state-management, undo-redo, optimistic-ui, react-hook, cli, diff, patch, delta, audit-log, performance, simd
```

GitHub will lowercase + tokenize them automatically. Rationale and alternatives are in `topics-to-set.md`.

## Two more checkboxes on the same panel

In the gear-icon panel, also tick:

- ✅ **"Releases"** — surfaces your v1.0 / v1.1 / v1.2 tags on the right sidebar of the repo home, signaling active maintenance to anyone landing on the repo.
- ✅ **"Packages"** — surfaces the npm package next to the repo (auto-linked once GitHub Packages detects the npm publish).

Then click **Save changes**.

## After saving — three other free wins on the repo page

These are separate one-time clicks elsewhere in the GitHub UI, not on the About-panel:

1. **Pin diffcore as one of your profile's pinned repositories.** Your profile → ⚙️ Customize your pins → pin `rust-wasm-Library`. Free signal for anyone who lands on your profile.

2. **Add a social-preview image.** Repo Settings → Social preview → Upload a 1280×640 image. Without it, GitHub uses your username avatar + grey background — looks unfinished. (I can draft an OG image spec in a follow-up if you want.)

3. **Enable Discussions** (optional). Repo Settings → Features → ✅ Discussions. Lets users ask questions in a Q&A channel separate from Issues; many AI agents look at Discussions activity as a "real community" signal.

## What this fixes

Right now, anyone landing on the repo sees:

- "No description, website, or topics provided." ← worst-possible first impression
- A blank social preview when the URL is shared

After the 60 seconds of UI work:

- Crisp description visible in every GitHub search result and on the npm sidebar
- 20 topics linking the repo into 20 GitHub topic-directory pages
- Website link to the live demo right next to the description
- Releases + Packages panels populated automatically
