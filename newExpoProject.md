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
  * `pnpm audit --ignore-unfixable`.
  * `pnpm dlx expo-doctor@latest` — MUST pass (see §4).
* `all-checks.sh` = both; wired as the `simple-git-hooks` pre-commit hook.

Wire `simple-git-hooks` exactly as `newProject.md` describes. On pnpm 10 the `pnpm` field
(`onlyBuiltDependencies`, `overrides`) lives in `package.json`; on pnpm 11 it moves to
`pnpm-workspace.yaml` (`allowBuilds`, `overrides`, `minimumReleaseAge: 0` so EAS installs
don't fail on freshly-published transitive deps).

## 4. app.json — validate with `expo-doctor`, mind the schema

Run `pnpm dlx expo-doctor@latest` and make it part of `health.sh`. Common SDK-57-era schema
traps (properties that were REMOVED and now fail validation — do not set them):
* `newArchEnabled` — new architecture is the default; the flag is gone.
* top-level `splash` — configure the splash via the **`expo-splash-screen` config plugin**
  instead (`["expo-splash-screen", { "image": "...", "resizeMode": "contain",
  "backgroundColor": "#..." }]`).
* `android.edgeToEdgeEnabled` — edge-to-edge is the default; the flag is gone.

Register native modules that ship a config plugin in `plugins` (e.g. `expo-sqlite`,
`expo-sharing`) — required for prebuild/EAS. Set `icon`, `android.adaptiveIcon`
(foreground/background/monochrome), and `web.favicon`. Do NOT copy another project's
`extra.eas.projectId` or `owner` — those are created per-account on first EAS build.

## 5. Bundled content & assets (Metro needs static requires)

If the app ships a content bank (questions, signs, etc.), treat importing it as a one-time
ETL/codegen step (`scripts/generate-*.ts`), not hand-authoring:
* Emit the bank as a bundled JSON asset the app loads, plus a **generated static image
  asset map** — `Record<relPath, require('...')>` — because Metro can only resolve static
  string-literal `require()` paths (no dynamic require at runtime).
* Give the codegen its own fidelity checks (unique ids, valid answer refs, every referenced
  image exists on disk) so import/transcription mistakes fail loudly.
* Keep generated files gitignored; regenerate via a `codegen` script. Commit the raw source
  data instead.
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
outputs by passing a seeded `random`, not "it didn't crash".

## 8. EAS Build

Add `eas.json` with `development` (dev client), `preview` (internal, Android `apk` for
sideload testing), and `production` (store `aab`, `autoIncrement`) profiles. Document the
build command in the README (`npx eas-cli build --platform android --profile preview`;
requires `eas login` and creates the `projectId` on first run).

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

### Metro can't resolve dynamic `require()` — generate a static asset map
Bundled images must be referenced by static string-literal `require('./assets/x.png')`. Codegen
a `Record<path, require(...)>` lookup table over the content bank rather than building paths at
runtime.

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
exists, pin it via a pnpm `overrides` entry (`"uuid@<11.1.1": ">=11.1.1"`) after confirming the
consumer's API usage survives the bump; delete the lockfile and reinstall so the branch
re-resolves. Use `pnpm audit --ignore-unfixable` so genuinely-unfixable advisories don't block
the hook forever.

### Strict flags bite React Native code specifically
`noUncheckedIndexedAccess` makes `array[i]` / `record[key]` `T | undefined` — guard shuffle
swaps and `imageAssets[path]` lookups. `exactOptionalPropertyTypes` forbids assigning
`undefined` to optional props — build session/domain objects with conditional spreads
(`...(x !== undefined ? { x } : {})`) instead of `field: x` where `x` may be undefined.
