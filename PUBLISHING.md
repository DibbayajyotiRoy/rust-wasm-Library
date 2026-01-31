# Publishing DiffCore to NPM

## Prerequisites

1. **NPM Account**: Create one at [npmjs.com](https://www.npmjs.com/signup)
2. **NPM CLI**: Verify with `npm --version`
3. **Package Name**: Ensure `diffcore` is available (or use scoped: `@yourusername/diffcore`)

---

## Step 1: Login to NPM

```bash
npm login
```

Enter your username, password, and email. If you have 2FA enabled, you'll need your authenticator code.

Verify login:
```bash
npm whoami
```

---

## Step 2: Verify Package Contents

```bash
cd /home/roy/private/wasm
npm pack --dry-run
```

Expected output:
```
📦 diffcore@1.0.0
├── dist/index.js
├── dist/index.d.ts
├── dist/wasm-embedded.js
├── dist/diffcore.wasm
├── README.md
├── LICENSE
└── package.json
```

---

## Step 3: Build Fresh

```bash
npm run build
```

This runs:
1. `cargo build --release` (WASM)
2. `tsc` (TypeScript)
3. `embed-wasm.mjs` (Bundle WASM as Base64)

---

## Step 4: Publish

### First Time (New Package)
```bash
npm publish --access public
```

### Update Existing Package
```bash
# Bump version first
npm version patch  # 1.0.0 → 1.0.1
# or
npm version minor  # 1.0.0 → 1.1.0
# or
npm version major  # 1.0.0 → 2.0.0

# Then publish
npm publish
```

---

## Step 5: Verify on NPM

After publishing, check your package at:
```
https://www.npmjs.com/package/diffcore
```

Test installation in a new project:
```bash
mkdir test-diffcore && cd test-diffcore
npm init -y
npm install diffcore
node -e "import('diffcore').then(m => console.log(Object.keys(m)))"
```

---

## Automated Publishing (CI/CD)

Your GitHub Actions workflow (`.github/workflows/release.yml`) already handles this:

1. Push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions will:
   - Build WASM from Rust source
   - Compile TypeScript
   - Embed WASM as Base64
   - Publish to NPM with provenance

### Setup NPM Token in GitHub

1. Generate token: npmjs.com → Access Tokens → Generate New Token (Automation)
2. Add to GitHub: Settings → Secrets → Actions → `NPM_TOKEN`

---

## Checklist Before Publishing

- [ ] `npm run build` succeeds
- [ ] `npm test` passes (if you have tests)
- [ ] Version bumped in `package.json`
- [ ] README.md is up to date
- [ ] LICENSE file exists
- [ ] `npm pack --dry-run` shows correct files
