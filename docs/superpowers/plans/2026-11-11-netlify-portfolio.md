# Weekend Merge Netlify and Portfolio Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Weekend Merge as an independent Netlify application and add verified Demo and GitHub links to both project surfaces of the bilingual portfolio.

**Architecture:** The Weekend Merge repository owns its Vite build, Netlify Functions, site configuration, and server-only Gemini variables. The portfolio remains a separate deployment and consumes only the final public URL as content. Portfolio edits are made from a fresh worktree based on current `origin/main` because the existing checkout contains unrelated local commits and untracked work.

**Tech Stack:** Netlify, GitHub, Vite, React, TypeScript, Vitest, Playwright/browser verification.

**Spec:** `docs/PRD.md` sections 10.3 and 14.5.

## Global Constraints

- Weekend Merge deploys from its own public GitHub repository.
- The production site name target is `weekend-merge-wml516518`.
- `GEMINI_API_KEY` is stored only as a secret Netlify Functions variable.
- The first production deploy must work without Gemini by using explicit rule/demo degradation.
- The portfolio receives `https://weekend-merge-wml516518.netlify.app` only after that URL is verified.
- Portfolio English and Chinese project lists and resume project sections must all include Weekend Merge.
- Existing user changes in `/Users/wangmenglong/Desktop/PrivateChat` are never reset, rebased, or overwritten.

---

### Task 1: Prepare Continuous Deployment Configuration

**Files:**
- Modify: `netlify.toml`
- Modify: `README.md`
- Test: `netlify.toml` through the production build and Netlify configuration inspection.

**Interfaces:**
- Consumes: the completed Agent runtime and existing Vite build.
- Produces: reproducible Netlify build, SPA fallback, and Functions packaging.

- [ ] **Step 1: Add a configuration assertion**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('netlify.toml','utf8');for(const v of ['command = \"npm run build\"','publish = \"dist\"','functions = \"netlify/functions\"','NODE_VERSION = \"20\"'])if(!s.includes(v))throw new Error('missing '+v)"
```

Expected: PASS for existing keys.

- [ ] **Step 2: Harden response headers**

Add headers for all routes while preserving the SPA redirect:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

Do not add a Content Security Policy in this iteration because the frontend collaborator may add map tiles and the final source list is not yet stable.

- [ ] **Step 3: Document deployment variables and repository import**

Add a README deployment section that specifies production branch `main`, build command `npm run build`, publish directory `dist`, Functions directory `netlify/functions`, and Functions-scoped variables `GEMINI_API_KEY` and `GEMINI_MODEL`.

- [ ] **Step 4: Verify and commit configuration**

Run: `npm test -- --run && npm run build && git diff --check`

Expected: PASS.

```bash
git add netlify.toml README.md
git commit -m "chore: prepare Netlify production deployment"
```

### Task 2: Push and Publish Weekend Merge

**Files:**
- External state: GitHub repository `wml516518/weekend-merge`.
- External state: Netlify site `weekend-merge-wml516518`.
- Generated and ignored: `.netlify/state.json`.

**Interfaces:**
- Consumes: a clean, verified Weekend Merge branch.
- Produces: `https://weekend-merge-wml516518.netlify.app` and continuous deployment from `main`.

- [ ] **Step 1: Verify repository state before publishing**

Run: `git status --short --branch && git log --oneline origin/main..HEAD && npm test -- --run && npm run build`

Expected: only intentional commits are ahead of `origin/main`; tests and build pass.

- [ ] **Step 2: Push the Agent commits**

Run: `git push origin main`

Expected: GitHub accepts the push and the repository default branch contains the Agent implementation and deployment documentation.

- [ ] **Step 3: Authenticate Netlify without persisting credentials in the repository**

Run: `npx netlify-cli login`

Expected: browser authorization completes and `npx netlify-cli status` shows the intended Netlify account. If an existing authenticated browser session is available, use Netlify's “Import an existing project” flow instead and select `wml516518/weekend-merge`.

- [ ] **Step 4: Create or link the production site**

Run: `npx netlify-cli sites:create --name weekend-merge-wml516518`

Expected: Netlify returns `https://weekend-merge-wml516518.netlify.app` and writes the ignored local site ID. If the site already exists in the account, run `npx netlify-cli link --name weekend-merge-wml516518` instead.

- [ ] **Step 5: Configure the model name without exposing a key**

Run: `npx netlify-cli env:set GEMINI_MODEL gemini-2.5-flash-lite --scope functions --context production`

Expected: Netlify records the model ID for production Functions. Set `GEMINI_API_KEY` through the Netlify secret-variable prompt or UI only when the user supplies a key; the deployment remains valid without it.

- [ ] **Step 6: Connect GitHub continuous deployment or deploy production manually**

Preferred: import `wml516518/weekend-merge` in Netlify with branch `main`; the committed `netlify.toml` supplies build settings.

Fallback command: `npx netlify-cli deploy --prod --build`

Expected: the production deploy is published at the target URL.

- [ ] **Step 7: Verify the deployed app and Functions**

Run:

```bash
curl -fsS https://weekend-merge-wml516518.netlify.app/ >/dev/null
curl -fsS -X POST https://weekend-merge-wml516518.netlify.app/.netlify/functions/plan -H 'content-type: application/json' --data-binary @tests/fixtures/plan-request.demo.json
```

Expected: homepage returns HTTP 200; the Function returns NDJSON ending in `run.completed` and contains `run.degraded` when no Gemini key is configured.

### Task 3: Add Portfolio Content from a Clean Worktree

**Files:**
- Modify in isolated portfolio worktree: `src/content.ts`
- Modify in isolated portfolio worktree: `src/App.test.tsx`

**Interfaces:**
- Consumes: verified production URL and GitHub URL.
- Produces: bilingual project-list entry and bilingual resume-project entry.

- [ ] **Step 1: Fetch the latest portfolio branch without modifying the current checkout**

Run from `/Users/wangmenglong/Desktop/PrivateChat`: `git fetch origin main`

Expected: `origin/main` updates; the existing `codex/chinese-ai-demos` checkout and untracked directories remain unchanged.

- [ ] **Step 2: Create an isolated portfolio worktree**

Use the `superpowers:using-git-worktrees` skill to create a worktree from `origin/main` on branch `codex/weekend-merge-portfolio`.

Expected: the new worktree is clean and contains the latest remote portfolio code.

- [ ] **Step 3: Write failing bilingual rendering tests**

Add English assertions:

```ts
expect(screen.getAllByText('Weekend Merge').length).toBeGreaterThanOrEqual(2);
expect(screen.getByRole('link', { name: 'Live', href: 'https://weekend-merge-wml516518.netlify.app' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'GitHub', href: 'https://github.com/wml516518/weekend-merge' })).toBeInTheDocument();
```

After switching to Chinese, assert the summary `双人周末决策 Agent，通过可观察工具调用生成三套折中方案，并在否决后只重排受影响区段。` and the resume project description are visible.

- [ ] **Step 4: Run the portfolio test and confirm failure**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because Weekend Merge is absent.

- [ ] **Step 5: Add English and Chinese project-list records**

Use these values:

```ts
{
  title: 'Weekend Merge',
  status: 'Live',
  summary: 'An observable two-person weekend planning Agent that generates three compromises and replans only affected stops after feedback.',
  stack: ['React', 'TypeScript', 'Gemini Function Calling', 'Netlify Functions', 'Open-Meteo'],
  githubUrl: 'https://github.com/wml516518/weekend-merge',
  liveUrl: 'https://weekend-merge-wml516518.netlify.app'
}
```

```ts
{
  title: 'Weekend Merge / 周末共识局',
  status: '已上线',
  summary: '双人周末决策 Agent，通过可观察工具调用生成三套折中方案，并在否决后只重排受影响区段。',
  stack: ['React', 'TypeScript', 'Gemini Function Calling', 'Netlify Functions', 'Open-Meteo'],
  githubUrl: 'https://github.com/wml516518/weekend-merge',
  liveUrl: 'https://weekend-merge-wml516518.netlify.app'
}
```

- [ ] **Step 6: Add English and Chinese resume-project records**

Use period `2026.11` and include three highlights: controlled state machine with five tools; schema validation and deterministic budget/route/constraint checks; local replan plus no-key/model-failure degradation. Stack is `['React', 'TypeScript', 'Gemini', 'Netlify Functions', 'Zod', 'Vitest']`.

- [ ] **Step 7: Run tests and production build**

Run: `npm test -- --run && npm run build && git diff --check`

Expected: PASS.

- [ ] **Step 8: Commit the portfolio integration**

```bash
git add src/content.ts src/App.test.tsx
git commit -m "feat: feature Weekend Merge in portfolio"
```

### Task 4: Publish and Verify the Portfolio

**Files:**
- External state: GitHub repository `wml516518/menglong-build-log`.
- External state: Netlify site `menglong-build-log.netlify.app`.

**Interfaces:**
- Consumes: the isolated `codex/weekend-merge-portfolio` commit.
- Produces: updated public portfolio with working Weekend Merge links in four localized surfaces.

- [ ] **Step 1: Push the isolated portfolio branch**

Run: `git push -u origin codex/weekend-merge-portfolio`

Expected: GitHub receives only the Weekend Merge portfolio changes based on current `origin/main`.

- [ ] **Step 2: Merge through the repository's normal review path**

Create a pull request to `main`, verify CI, and merge only after the diff contains `src/content.ts` and `src/App.test.tsx` changes for Weekend Merge. If direct push to `main` is the established workflow and branch protection is absent, fast-forward only after comparing `git diff origin/main...HEAD`.

- [ ] **Step 3: Wait for the existing Netlify continuous deployment**

Expected: `https://menglong-build-log.netlify.app` publishes the merged portfolio commit.

- [ ] **Step 4: Verify desktop and mobile behavior**

Check the portfolio at 1440x900 and 390x844. In English and Chinese, verify one project-list record and one resume-project record. Open the Live and GitHub links and confirm they reach the Weekend Merge production site and public repository. Confirm no horizontal overflow and no browser console errors.

- [ ] **Step 5: Record final URLs in Weekend Merge README**

Add the production Demo URL and portfolio URL to Weekend Merge README, run `npm run build`, commit with `docs: add production demo links`, and push `main` so the repository front page points to both live surfaces.

