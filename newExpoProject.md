# Prompt Template: Creating New Expo (React Native) App

This prompt scaffolds a complete offline-capable Expo app with the same strict linting,
testing, and security discipline as `newProject.md`, plus the Expo/React-Native specifics.

It **builds on `newProject.md`** — apply that template's TypeScript/pnpm/biome/vitest/gitleaks
foundation first, then layer the Expo-specific additions below. Where the two conflict, the
Expo notes win (e.g. dependency freshness: Expo pins native packages, so you do NOT chase
`react-native`/`expo-*` to npm latest).

---

PROMPT FOR LLM (replace placeholders before use):

I need a new Expo app, project root should be in {{PROJECT_ROOT}}

The app is about {{APP_DESCRIPTION}}

Author is Damir Manapov, license is MIT

My stack is Expo (latest SDK) + React Native + TypeScript, pnpm, vitest, biome, gitleaks,
EAS Build. It must work fully offline (no backend, no accounts) with local storage.

Decide up front and apply throughout: {{LANGUAGES: single-language or multi-language}}. If
single-language, do NOT add any i18n/localize/Language machinery — UI strings and content
are plain `string`.

## 0. Read the exact SDK docs first (non-negotiable)

Expo APIs change significantly between major SDK versions (file system, sqlite, sharing,
splash, config plugins). Before writing ANY Expo-specific code, read the versioned docs for
the SDK actually installed (`https://docs.expo.dev/versions/vXX.0.0/`) or the installed
package's own `node_modules/<pkg>/build/**/*.d.ts`. Add an `AGENTS.md` at the root capturing
this reminder (and a `CLAUDE.md` that just contains `@AGENTS.md`).

## 1. Scaffolding & dependencies

* Entry point: `index.ts` with `registerRootComponent(App)`; set `"main": "index.ts"` in
  `package.json`. Keep the root component in `src/app.tsx`.
* Install Expo-managed packages with `pnpm exec expo install <pkg>` (NOT `pnpm add`) so you
  get SDK-compatible versions. Typical set: `expo-sqlite`, `expo-file-system`,
  `expo-sharing`, `expo-status-bar`, `expo-splash-screen`, `react-native-safe-area-context`.
* Add `@types/node` as a dev dep if you run any Node scripts (codegen); Node 22+ runs `.ts`
  scripts directly via type-stripping (avoid `enum`/`namespace`/decorators in those scripts).
* `tsconfig.json` extends `expo/tsconfig.base` and additionally sets `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
  `forceConsistentCasingInFileNames`, and `resolveJsonModule` (for bundled JSON content).

## 2. Architecture (keep layers thin, push logic down)

```
src/
  app.tsx                 thin composition root: wires hooks + components, no logic
  strings.ts              UI strings (flat object; single-language => no localize())
  styles.ts               one shared StyleSheet.create() for all components
  logger.ts               logError(context, error): funnels caught errors, doesn't rethrow
  components/             presentational only, no data/business logic
  hooks/                  all state + side effects, one hook per concern (useX)
  data/
    questions.ts / content loader + domain types
    <domain>Logic.ts      ALL pure logic (session building, ordering, stats, checking);
                          zero React/DB/FS imports; fully unit-tested
    database.ts           SQLite init/migrations/CRUD (native; not unit-tested)
    databaseMappers.ts    pure row <-> domain mapping (separate so it IS unit-testable)
    backupFormat.ts       pure serialize/validate (dependency-free from rest of data/)
    backup.ts             file I/O over backupFormat + database
  tests/                  Vitest, one file per pure-logic module
scripts/
  generate-*.ts           one-off ETL/codegen (see §5)
```

Guiding rule: anything that can be pure logic IS pure logic, in its own file with its own
test. Thread `random: () => number = Math.random` through every shuffle/sample function so
logic is deterministically testable with a seeded fake.

## 3. Quality gates (three scripts + pre-commit, per `newProject.md`)

Use `#!/usr/bin/env bash` + `set -euo pipefail`; simple, informative, fail-fast.

* `check.sh`: biome format (`--write`) -> biome lint (`--error-on-warnings`) -> `tsc --noEmit`
  -> `vitest run`.
* `health.sh` (Expo variant — this differs from `newProject.md`):
  * `gitleaks git . -v` and `gitleaks dir . -v` (history + working tree).
  * `pnpm exec expo install --check` for Expo-managed dependency drift (this is the
    freshness check for `expo-*`/`react-native`/`react` — do NOT `pnpm outdated` those; they
    are SDK-pinned and would always look "outdated").
  * `pnpm outdated <dev-tooling-only>` (e.g. `vitest @types/react @types/node @biomejs/biome
    simple-git-hooks`) — dev deps you actually control.
  * `pnpm audit` (plain — do NOT use `--ignore-unfixable`, which churns `auditConfig` every
    run; pin genuinely-unfixable advisories in `auditConfig.ignoreGhsas` instead, see lesson).
  * `pnpm dlx expo-doctor@latest` — MUST pass (see §4).
* `all-checks.sh` = both; wired as the `simple-git-hooks` pre-commit hook.

Wire `simple-git-hooks` exactly as `newProject.md` describes. On pnpm 10 the `pnpm` field
(`onlyBuiltDependencies`, `overrides`) lives in `package.json`. On pnpm 11 that field is
ignored — move config to `pnpm-workspace.yaml`, where `onlyBuiltDependencies` is **replaced**
by an `allowBuilds` approval map (`allowBuilds: { simple-git-hooks: true }`) and freshly-
published packages blocked by pnpm's default supply-chain policy go in
`minimumReleaseAgeExclude` (see the migration lesson below).

## 4. app.json — validate with `expo-doctor`, mind the schema

Run `pnpm dlx expo-doctor@latest` and make it part of `health.sh`. Common SDK-57-era schema
traps (properties that were REMOVED and now fail validation — do not set them):
* `newArchEnabled` — new architecture is the default; the flag is gone.
* top-level `splash` — configure the splash via the **`expo-splash-screen` config plugin**
  instead (`["expo-splash-screen", { "image": "...", "resizeMode": "contain",
  "backgroundColor": "#..." }]`).
* `android.edgeToEdgeEnabled` — edge-to-edge is the default; the flag is gone.

Only list packages in `plugins` that actually need config-time native changes (e.g.
`expo-splash-screen`). Autolinked native modules like `expo-sqlite`, `expo-sharing`, and
`expo-status-bar` link automatically and must NOT be added — listing them adds fragile
config-plugin resolution that fails (`Failed to resolve plugin for module ...`) when
`node_modules` is absent or under pnpm's symlinked layout on Windows. Do NOT copy another
project's `extra.eas.projectId` or `owner` — those are created per-account on first EAS build.

Icon/splash assets to provide (Expo generates the per-platform sizes from these):
* `icon` — 1024×1024 opaque PNG (Expo rounds it per platform).
* `android.adaptiveIcon` — `foregroundImage` + `backgroundImage` (1024×1024) and
  `monochromeImage` (Android 13+ themed icons); keep the mark inside the center ~66%
  safe zone or it gets cropped by the launcher mask.
* splash image (via the `expo-splash-screen` plugin) and `web.favicon` (48×48).
* No design assets? Generate clean placeholders programmatically (e.g. a short Python +
  Pillow script producing a colored plate + centered text), then install the tool outside
  the project root and delete it afterward. Replace with real artwork before a store release.

## 5. Bundled content & assets (Metro needs static requires)

If the app ships a content bank (questions, signs, etc.), treat importing it as a one-time
ETL/codegen step (`scripts/generate-*.ts`), not hand-authoring:
* Emit the bank as a bundled JSON asset the app loads, plus a **generated static image
  asset map** — `Record<relPath, require('...')>` — because Metro can only resolve static
  string-literal `require()` paths (no dynamic require at runtime).
* Give the codegen its own fidelity checks (unique ids, valid answer refs, every referenced
  image exists on disk) so import/transcription mistakes fail loudly.
* Keep generated files gitignored; regenerate via a `codegen` script. Commit the raw source
  data instead. Because EAS bundles from committed files only, wire the same script into an
  `eas-build-post-install` npm hook so the build server regenerates them before Metro runs
  (see §8) — otherwise the bundle fails with `Unable to resolve module .../generated/...`.
* For official/legal content: record exactly which source/version/date was imported, verify
  licensing before bundling, and add content-invariant tests over the bank.

## 6. Local storage & backup

* SQLite (`database.ts`): append-only migrations tracked by `PRAGMA user_version` — never
  edit a past migration, only append. The DB holds history/preferences and referential
  integrity only; the real content bank always comes from code, never round-tripped from the
  DB. Extract pure row<->domain mapping into `databaseMappers.ts` so it's testable (the
  native module itself can't be unit-tested).
* Backup format (`backupFormat.ts`): dependency-free from the rest of `data/`; new fields are
  optional so old exports still validate; run a hand-rolled runtime type guard on
  `JSON.parse()` output before trusting it.
* Backup I/O (`backup.ts`): iOS/web write to the app cache dir (new `File`/`Paths` API) then
  hand off via `expo-sharing`; Android can do dialog-free backups via the legacy
  `expo-file-system/legacy` `StorageAccessFramework` after a one-time folder grant (persist
  the `directoryUri`). Import with expo-file-system's own `File.pickFileAsync` (not
  expo-document-picker — its files lack read permission). Model picker cancellation as a
  return value, never a thrown error; only alert on genuine failures.

## 7. Testing

Vitest tests pure logic ONLY (`<domain>Logic.ts`, `databaseMappers.ts`, `backupFormat.ts`,
content invariants) — never React components, native modules, or timers.
`vitest.config.ts`: `include: ['src/tests/**/*.test.ts']`, `environment: 'node'`. Assert exact
outputs by passing a seeded `random`, not "it didn't crash". Vitest 4 may warn that
`vitest.config.ts` uses ESM syntax while loaded as CommonJS — harmless; leave it, since adding
`"type": "module"` to silence it risks Metro/Expo's CommonJS assumptions.

## 8. EAS Build

Add `eas.json` with `development` (dev client), `preview` (internal, Android `apk` for
sideload testing), and `production` (store `aab`, `autoIncrement`) profiles. Document the
build command in the README (`npx eas-cli build --platform android --profile preview`;
requires `eas login` and creates the `projectId` on first run). EAS evaluates the app config
(plugins) **locally** before upload, so `pnpm install` and any `codegen` must have run in the
checkout first — a fresh clone that skips them fails with `Failed to resolve plugin ... Do you
have node modules installed?`. But the **Metro bundle runs on the EAS server from committed
files only**, so gitignored generated assets (§5) are absent there. Regenerate them on the
server with an `eas-build-post-install` npm script (`"eas-build-post-install": "node
scripts/generate-*.ts"`), which EAS runs after `pnpm install` and before bundling.

For store submission, keep a `store-listing.md` with the marketing copy (Google Play limits:
short description ≤ 80 chars, full description ≤ 4000 chars) in the app's language(s), plus
category, keywords, and a note that the placeholder icons must be replaced first.

## 9. .gitignore additions (beyond node/dist)

`/.expo`, `expo-env.d.ts`, `.metro-health-check*`, generated native folders `/ios` `/android`,
signing secrets (`*.jks`, `*.p8`, `*.p12`, `*.key`, `*.keystore`, `*.mobileprovision`),
`*.tsbuildinfo`, and the generated content/asset files from §5.

---

## Lessons Learned (Expo-specific)

### `expo install --check` prompts interactively — don't discover it inside a git hook
When Expo-managed packages drift, `expo install --check` asks "Fix dependencies? (Y/n)".
Inside a pre-commit hook that reads no stdin, this silently aborts the commit. Run
`pnpm exec expo install <pkg>` / `--check` yourself and accept fixes before committing.

### Use `expo install`, not `pnpm add`, for Expo packages
`expo install` resolves the version compatible with the installed SDK. `pnpm add expo-foo`
grabs npm-latest, which may be built for a newer SDK and break the native build.

### `expo-doctor` catches app.json schema drift `tsc`/biome never will
Config validation is separate from type/lint checks. A removed property (`newArchEnabled`,
top-level `splash`, `android.edgeToEdgeEnabled`) passes typecheck/lint but fails prebuild/EAS.
Put `expo-doctor` in `health.sh` so it's gated on every commit.

### Configure splash via the plugin, not the top-level key
`expo install expo-splash-screen` and configure it in `plugins`. The old top-level `splash`
object is rejected by the current schema.

### Only config plugins belong in `plugins` — not autolinked modules
Autolinked native modules (`expo-sqlite`, `expo-sharing`, `expo-status-bar`) are linked without
any `app.json` entry. Listing them in `plugins` "to be safe" adds config-plugin resolution that
fails with `Failed to resolve plugin for module <pkg>` whenever `node_modules` isn't installed
(fresh clone, CI) or under pnpm's symlinked layout on Windows. Keep `plugins` to packages that
really modify native build config (e.g. `expo-splash-screen`); `expo-doctor` passes either way,
so this only surfaces at prebuild/EAS time.

### Metro can't resolve dynamic `require()` — generate a static asset map
Bundled images must be referenced by static string-literal `require('./assets/x.png')`. Codegen
a `Record<path, require(...)>` lookup table over the content bank rather than building paths at
runtime.

### Gitignored generated assets need an `eas-build-post-install` codegen hook
EAS Build uploads **only committed files** and runs Metro on its server, so anything the
codegen emits (the `assets/` bundle + the generated `imageAssets.ts` require-map) is missing
there and the bundle dies with `Unable to resolve module ../data/generated/imageAssets`. Local
`expo start` doesn't catch it because the files already exist in your working tree. Don't fix
this by committing the generated output (it duplicates the raw source — e.g. hundreds of
images). Instead add `"eas-build-post-install": "node scripts/generate-*.ts"` to `scripts`;
EAS runs it after `pnpm install`, regenerating everything from the committed raw data before
bundling. Verify by deleting the generated dirs and re-running the hook locally.

### Don't `pnpm outdated` the Expo/RN packages
`react-native`, `react`, and `expo-*` are pinned to the installed SDK; they will always show as
"outdated" vs npm latest and would permanently fail `health.sh`. Check their freshness with
`expo install --check` and limit `pnpm outdated` to dev tooling you control.

### Node running `.ts` codegen scripts
Node 22+ strips types natively (`node scripts/foo.ts`), so codegen can be typechecked by the
main `tsc` run and import app types. Add `@types/node`; avoid TS-only runtime features
(`enum`, `namespace`, parameter properties, decorators) since types are stripped, not compiled.

### Transitive advisory in Expo build tooling
`pnpm audit` can flag a transitive dep deep in Expo's tooling (e.g. `xcode > uuid`). If a fix
exists that the consumer can take, pin it via a pnpm `overrides` entry
(`"uuid@<11.1.1": ">=11.1.1"`) after confirming the consumer's API usage survives the bump;
delete the lockfile and reinstall so the branch re-resolves. When the only "fix" is a MAJOR
bump the consumer can't take (e.g. Metro pins `image-size` 1.x, patched only in 2.x, so the
override breaks `pnpm install`), treat it as unfixable: pin the specific `GHSA-...` ids in
`auditConfig.ignoreGhsas` (see the audit-churn lesson) rather than forcing the bump.

### Back button handling is required for active user flows
React Native's default Android hardware back behavior exits the app when no listener handles
`hardwareBackPress`. For any flow with an in-progress session (quiz, form, stepper, etc.),
register a `BackHandler.addEventListener` and return `true` while the flow is active. Only let
it bubble to the default exit behavior when the app is truly at the ready/idle screen.
This prevents a mid-question "back" press from closing the entire app and is a common
Expo/React Native regression during screen composition changes.

### Strict flags bite React Native code specifically
`noUncheckedIndexedAccess` makes `array[i]` / `record[key]` `T | undefined` — guard shuffle
swaps and `imageAssets[path]` lookups. `exactOptionalPropertyTypes` forbids assigning
`undefined` to optional props — build session/domain objects with conditional spreads
(`...(x !== undefined ? { x } : {})`) instead of `field: x` where `x` may be undefined.

### Migrating to pnpm 11: `allowBuilds` replaces `onlyBuiltDependencies`, and the supply-chain policy gates fresh packages
The original `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` an EAS build hit on a teammate's machine
traces back to these two breaking changes — worth doing deliberately, not via a stray
`corepack use`.
* Pin the toolchain with `package.json` `"packageManager": "pnpm@X"`; corepack auto-selects it
  **inside the project**, so you never need `corepack use`. Running `corepack use pnpm@11` in a
  project still pinned to 10 rewrites the pin and trips the checks below mid-install.
* pnpm 11 stops reading the `pnpm` field in `package.json`. Move `overrides` and `auditConfig`
  to the top level of `pnpm-workspace.yaml`.
* `onlyBuiltDependencies` is **not honored** — a dependency's build/postinstall (e.g.
  `simple-git-hooks`) is skipped and pnpm reports `[ERR_PNPM_IGNORED_BUILDS]`. Approve it with an
  `allowBuilds` map (`allowBuilds:` → `  simple-git-hooks: true`). `pnpm install` writes a
  `set this to true or false` placeholder you must resolve, then re-run to confirm a clean pass.
  Drop entries for tools that no longer build natively (e.g. vitest 4 no longer pulls `esbuild`).
* pnpm 11 enforces a default `minimumReleaseAge` supply-chain delay. On a strict machine it hard-
  fails `[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION]`; otherwise pnpm auto-appends the offending
  versions to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (e.g. every `@biomejs/*` platform
  binary). **Commit that list** — it's what lets teammates and EAS install the same fresh versions.
  Prefer per-package excludes over `minimumReleaseAge: 0`, which disables the protection wholesale.
* Migration recipe: bump the `packageManager` pin → `corepack prepare pnpm@X --activate` → delete
  `pnpm-lock.yaml` → `pnpm install` (run directly, not piped — the "remove node_modules? / approve
  builds" prompts hang behind a pipe) → resolve the `allowBuilds` placeholder → `pnpm install`
  again → run all gates.

### `pnpm audit --ignore-unfixable` churns `auditConfig` every run — pin GHSAs instead
`pnpm audit --ignore-unfixable` rewrites `auditConfig` on every invocation when there's nothing
new to record, toggling `auditConfig: {}` ⇄ `auditConfig: { ignoreGhsas: null }`. Inside the
pre-commit hook that leaves `pnpm-workspace.yaml` perpetually dirty (a fresh one-line diff after
every commit), and no committed value is stable. Fix: drop the flag, run **plain `pnpm audit`**,
and record each genuinely-unfixable advisory explicitly:
```yaml
auditConfig:
  ignoreGhsas:
    - 'GHSA-w3rx-r6r6-pgpr'   # image-size DoS, transitive via expo>metro, build-only
```
Plain `pnpm audit` reads that list, exits 0, and never rewrites the file — and each ignore is an
explicit, greppable line you can annotate with *why* it's safe.

### Confirm destructive actions in mobile flows
Actions such as restarting a session, discarding a draft, or replacing imported data should
show a native confirmation dialog before mutating state. Keep the destructive operation in
the confirmation callback, provide an explicit cancel action, and make cancellation the
non-destructive default. This protects progress from accidental taps and hardware gestures.

### Answer feedback should explain the result, not only color it
After an answer is selected, show the result, the user's selected answer, and the correct
answer when they differ. Keep the explanation in the same review area so the user can connect
the mistake to the rule without scanning back through the question. Test the domain result
separately from the native presentation layer.

### Keep adaptive modes semantically distinct
Before adding a new history-based ordering mode, compare its predicate with existing modes.
Two labels can sound different while producing identical results, which makes the selector
confusing and increases maintenance cost. Name the predicate precisely, centralise the shared
recent-history calculation, and add a test for the boundary window plus a later correct answer.
