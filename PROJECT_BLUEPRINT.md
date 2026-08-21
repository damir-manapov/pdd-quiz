# Blueprint: Offline Expo Quiz App (from "G-Code Quiz", for adaptation to "Traffic Laws Quiz")

This document describes the architecture, technical decisions, and lessons learned while
building **gcodes-quiz** — an offline, bilingual (EN/RU), local-SQLite quiz app built with
Expo SDK 57 + TypeScript. It's written so another project ("Traffic Laws Quiz" or similar)
can reuse the same architecture with a different question domain.

**IMPORTANT for whoever builds the new app:** Expo SDK versions change their APIs
significantly between major versions. Before writing any Expo-specific code (file system,
sqlite, sharing, etc.), read the exact versioned docs for whatever SDK version is actually
installed (e.g. `https://docs.expo.dev/versions/vXX.0.0/`), or read the installed package's
own TypeScript declarations in `node_modules/<package>/build/**/*.d.ts` if no browsing tool
is available — APIs described below (current as of Expo SDK 57) may already be outdated.

**Decided requirements for the Traffic Laws app (not open questions — apply throughout):**
1. **Russian only, no other language.** Drop every bit of bilingual/multi-language
   machinery this project has (`LocalizedText`, `localize()`, the `Language` type, the
   language toggle UI, `useLanguage.ts`, the `preferences.language` DB row). UI strings and
   question content are both plain `string`, not `{ en, ru }` objects. See the callouts in
   §3/§4/§6.1/§10 below for exactly what that removes.
2. **Questions come from an official source, not hand-authored.** The question bank must be
   built from the actual official traffic-rules exam question set (verbatim wording,
   images, and — importantly — official answer options), not invented/paraphrased content.
   This changes the authoring workflow from "write questions like code" to "faithfully
   import/transcribe official material," and it changes how "multiple ways to ask the same
   thing" (§4.2) should be achieved: **don't fabricate alternate phrasings of an official
   question** — get variety from quiz-mode structure and from the official bank's own
   naturally-occurring multiple questions about the same rule instead. See §4 for details.

## 1. What this app is, conceptually

A single-user, fully offline multiple-choice quiz app for studying toward a real-world
exam (CNC G/M-code programming, in this case). Core ideas that should carry over directly
to a "Traffic Laws" app:

- **No backend, no accounts.** Everything lives in local SQLite on-device. Works with no
  network connection at all.
- **A question bank as a TypeScript array literal** (not a database seed file or CMS), so
  content is data, reviewed and edited like code, with unit tests that assert invariants
  about it (see §7). For this project the bank is **imported/transcribed from an official
  source** rather than freely written — see §4 for how that changes the authoring workflow
  and the "multiple phrasings" pattern below.
- **Single-language (Russian) content** — no `{ en, ru }`-style localized-text objects
  anywhere, in UI strings or question data. This is simpler than gcodes-quiz, not more
  complex; just don't carry over its bilingual types.
- **Multiple quiz "modes"** that reuse the same question data but test it differently
  (see §4) — this is one of the most valuable patterns to copy: don't hardcode "one
  question = one way to ask it."
- **Adaptive practice**: wrong answers the user tends to pick are weighted to reappear
  more often (§5), and question ordering can prioritize weak/stale/rarely-seen questions.
- **Local backup/restore** of answer history to a file, since there's no cloud sync.
- **A stats view** showing accuracy overall, per-topic, and per-question weak spots.

## 2. Tech stack (versions as of this writing — verify current versions before starting)

| Concern | Choice |
|---|---|
| Framework | Expo SDK 57 (`expo ~57.0.9`), React Native `0.86.2`, React `19.2.3` |
| Language | TypeScript, `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (see §8 for what these actually force you to do) |
| Local DB | `expo-sqlite` (`~57.0.1`) |
| File export/import | `expo-file-system` (`~57.0.1`) — new sandboxed `File`/`Directory`/`Paths` API by default; legacy `expo-file-system/legacy` API (`StorageAccessFramework`) needed for Android direct-to-public-folder writes (see §6) |
| Share sheet fallback | `expo-sharing` (`~57.0.8`) |
| Safe areas | `react-native-safe-area-context` |
| Package manager | pnpm (with `pnpm-workspace.yaml`, `packageManager` pin) |
| Lint + format | Biome (single tool for both; `biome.json` config, `organizeImports` assist on) |
| Tests | Vitest, **only for pure logic**, not for UI or native modules (see §7) |
| Git hooks | `simple-git-hooks`, pre-commit runs the full check+health pipeline (see §9) |
| Build/deploy | EAS Build (`eas.json`): `preview` profile → Android `.apk` for sideload testing, `production` profile → `.aab` for store, `development` → dev client |

## 3. Project structure

```
src/
  app.tsx                 — thin composition root: wires hooks + presentational components together, no logic of its own
  strings.ts              — one dictionary of Russian UI strings (this project's i18n.ts, minus Language/localize() — single language, so it's just a flat object of strings/string-functions)
  logger.ts               — logError(context, error): one place that funnels caught errors to console.error, doesn't rethrow
  styles.ts               — one shared StyleSheet.create() used by every component (no per-component style files)
  components/             — presentational only, no data fetching or business logic
    QuizCard.tsx           — renders the current question + options/text-input + feedback, per quiz mode
    SettingsControls.tsx   — mode/order toggles, stats/backup/restore buttons (no language toggle — single language)
    StatsView.tsx           — overall/topic/per-question stats display
  hooks/                  — all state + side effects live here, one hook per app concern
    useQuiz.ts              — owns the quiz session: builds it, tracks progress, records answers
    useStats.ts             — loads answer history and computes display stats on demand
    useBackup.ts            — wraps backup.ts export/import with busy-state + Alert feedback
  data/
    questions.ts            — the question bank (data + its TS types), imported/transcribed from the official source, not freely written
    quizLogic.ts             — ALL pure logic: session building, adaptive weighting, ordering, stats math, answer-checking. Fully unit tested, zero React/DB/FS imports.
    database.ts              — SQLite init, migrations, CRUD for answers/preferences
    databaseMappers.ts        — pure row <-> domain-object mapping (kept separate specifically so it's unit-testable, since database.ts itself touches a native module and can't be)
    backupFormat.ts            — pure backup file serialize/validate/deserialize logic, deliberately dependency-free from the rest of data/ (see §6)
    backup.ts                  — the actual file I/O (FileSystem/Sharing/SAF), thin orchestration over backupFormat.ts + database.ts
  tests/                    — Vitest tests, one file per pure-logic module above
```

This drops gcodes-quiz's `useLanguage.ts` hook and `i18n.ts`'s `Language`/`localize()`
machinery entirely (single-language, so there's nothing to switch or look up per-render),
and there's no `preferences.language` DB row or language migration step either.

The guiding rule: **anything that can be pure logic, is pure logic, in its own file, with
its own test file.** React components and hooks are kept as thin as possible; they call
into `data/quizLogic.ts` / `data/database.ts` rather than owning algorithms themselves.
This is what makes ~80 unit tests possible with zero UI test harness.

## 4. Question bank data model (the part most worth rethinking, not just copying)

gcodes-quiz's bank stores every phrasing of a hand-invented question/answer together so a
session can pick one at random and avoid rote memorization of exact wording:

```ts
type LocalizedText = Record<Language, string>; // { en: string, ru: string }

type QuizQuestion = {
  id: number;
  category: string;
  topic: string;
  code?: string;
  prompts: LocalizedText[];       // every hand-written phrasing of the question
  distractors: LocalizedText[];   // hand-authored wrong answers
  correctAnswers: LocalizedText[]; // every hand-written phrasing of the correct answer
  explanation: LocalizedText;
  lineExamples?: LineExample[];
};
```

**This doesn't map onto the Traffic Laws project as-is, for two reasons:**
1. Content is single-language (Russian only), so drop `LocalizedText` entirely — every
   text field is a plain `string`.
2. Content is **official, not hand-authored** — an official exam question bank (e.g. the
   real driving-test ticket set) has one canonical wording and, critically, usually already
   ships its own fixed, complete set of answer options (often already only 2–4 choices) per
   question, not a variable pool you build up from hand-written distractors. **Don't invent
   alternate phrasings of an official question or its official answer** — that risks
   introducing wording that isn't actually correct/official. The `prompts`/`correctAnswers`
   *array-of-phrasings* pattern should only be used where the official source itself
   genuinely provides more than one official variant of equivalent wording; otherwise use a
   single canonical string.

A more appropriate shape for official, single-language content — this matches an actual
real-world example (a scraped Russian ПДД/driving-exam ticket record):

```json
{
  "id": "10",
  "source": "pdd",
  "category": "ПДД",
  "topic": "Скорость движения",
  "code": "Б1.В10",
  "text": "С какой скоростью Вы можете продолжить движение...",
  "explanation": "Знак 4.6 «Ограничение минимальной скорости»...",
  "explanationHtml": "<p>...official explanation with inline links/images...</p>",
  "imageUrl": "https://static.dscontrol.ru/ticket/7Y9f00BPVUCDG7y3ymQv1w.jpg",
  "imagePath": "images/10_7Y9f00BPVUCDG7y3ymQv1w.jpg",
  "options": [
    { "id": "10:0", "text": "Не более 50 км/ч." },
    { "id": "10:1", "text": "Не менее 50 км/ч и не более 70 км/ч." },
    { "id": "10:2", "text": "Не менее 50 км/ч и не более 90 км/ч." }
  ],
  "correctOptionId": "10:2"
}
```

The corresponding TypeScript shape, kept close to this real source instead of invented:

```ts
type QuizOption = {
  id: string;               // stable per-option id (e.g. "10:2"), NOT a positional index
  text: string;              // official option text, verbatim
};

type QuizQuestion = {
  id: string;                // official source's own question id (e.g. "10") — string, not number; makes fidelity checks (§7) possible
  source?: string;            // which official dataset this came from, if importing/merging more than one (e.g. "pdd")
  code?: string;               // official ticket/question code if the source has one (e.g. "Б1.В10" = Билет 1, Вопрос 10) — good for display/citation, not for grouping
  category: string;            // NOTE: in real data this can be a near-constant label (e.g. always "ПДД") — don't rely on it for grouping
  topic: string;                // the actually-useful grouping for per-topic stats (e.g. "Скорость движения") — prefer this over `category`
  text: string;                  // the official question text, verbatim
  explanation?: string;           // official plain-text explanation/rule citation, if the source provides one
  explanationHtml?: string;        // official rich-HTML explanation (may embed links/inline images) — see §10 for how to handle this in RN
  imageUrl?: string;                // original remote URL for the question's image, if any (reference only — don't fetch this at runtime)
  imagePath?: string;                // local relative path to the already-downloaded/bundled image — this is what the app should actually load, via a bundled asset map (see §10)
  options: QuizOption[];               // official options, each with its OWN stable id — never rebuilt/regenerated
  correctOptionId: string;              // references one of `options[].id` — NOT an index, so correctness survives shuffling with no recomputation needed
};
```

Keeping `options[].id` and `correctOptionId` exactly as the source provides them (rather
than flattening to `string[]` + a positional index) is a meaningful simplification over
gcodes-quiz's model: shuffling `options` for display never invalidates "which one is
correct," and — as noted in §5 — it also removes the need for gcodes-quiz's answer-text
hashing scheme entirely, since there's already a stable id to key history/weighting by.

Where does "different ways to question them" (the user's explicit requirement) come from,
if not from fabricated phrasing variety? From **structural quiz modes** (§4.2) built over
the same official fact, and from the official bank's own natural redundancy:
- Real official exam banks (e.g. driving-test ticket sets) very often already contain
  *multiple distinct official questions* that test the same underlying rule or the same
  sign from different angles (different scenarios, different images, sign vs. rule text).
  **Model each as its own `QuizQuestion` entry** (they already have their own official id),
  rather than trying to synthesize that variety yourself.
- Different **quiz modes** (§4.2) test the same official fact through a structurally
  different lens (e.g. "what does this sign mean" vs. "which of these signs matches this
  rule") without altering the official wording of either the prompt or its options.
- The **adaptive weighting / shuffled option order** machinery (§5) still applies directly
  even with a fixed official option set: shuffle `options`' displayed order each session,
  and weight-resurface options the user has mistakenly picked before — no need to
  synthesize extra distractors by pooling from other questions (gcodes-quiz needed that
  because its hand-authored questions didn't ship enough wrong answers on their own;
  official exam tickets usually already do).
- If, after checking the actual official source you're importing from, it *doesn't* ship a
  complete official option set per question (some rule-book-derived banks are just
  question+answer pairs, no throwaway options), then you *will* need a distractor-pooling
  strategy similar to gcodes-quiz's `buildForwardDistractorPool` — but build it from other
  *official* correct answers in the bank (still real, true facts about other rules/signs),
  never from invented wrong statements.

**Regression test worth copying (adapted to single-language/official content):** verify no
`options` entry across the bank is literally reused as a bare sign/rule identifier if a
"reverse" mode exists that shows that identifier as the answer — same "identity leaking
into the wrong direction's answer" bug class as gcodes-quiz's G/M-code check, just checked
against whatever the official identifiers are here (sign ids, article numbers, etc.).

### 4.1 SessionQuestion — the per-session resolved shape

```ts
type SessionQuestion = {
  id: string; topic: string; imagePath?: string;
  text: string;
  options: QuizOption[];      // shuffled this session — ids travel with each option, no reshuffled index bookkeeping
  correctOptionId: string;    // unchanged from the bank question — still valid after shuffling, since it's id-based
  explanation?: string;
};
```

`buildSessionQuestion(question, allQuestions, mode, hashCounts, random)` is the single
function that turns a bank question into a session question, branching on quiz mode.
`random: () => number = Math.random` is threaded through everywhere (not called directly),
which is what makes shuffling/weighting **deterministically unit-testable** by passing a
seeded fake — do this from the start, don't hardcode `Math.random()` calls deep in logic
functions.

### 4.2 Quiz modes — design these around the actual official content, not ported 1:1

gcodes-quiz's four modes (forward/reverse/typed/line) are shaped around G-code specifics
(short alphanumeric identifiers, exact multi-parameter command lines) and mostly don't
translate directly. For an official, single-language traffic-law bank, plausible modes
built on the same underlying data include:

1. **Standard multiple choice** ("as the official ticket presents it"): prompt = the
   official question text (plus its image, if any), options = the official option set,
   shuffled. This is the baseline mode and probably where most study time is spent.
2. **Sign → meaning**: show a sign's image, ask what it means, options = candidate meanings
   (its own official meaning + other real signs' official meanings as distractors,
   deduplicated) — structurally identical to gcodes-quiz's "forward" mode, just image-led.
3. **Meaning/description → sign**: the reverse direction — prompt = a rule/meaning
   description, options = candidate sign images — mirrors "reverse" mode; "close" signs
   (same category, e.g. warning triangles vs. other warning triangles) are natural
   candidates for the "plausible distractor" weight bonus (§5), replacing gcodes-quiz's
   numeric-closeness heuristic.
4. **Scenario/right-of-way judgment**: a described (or illustrated) traffic situation,
   asking who has priority / what the driver should do — this has no gcodes-quiz analogue
   at all; it's a new mode shape, so design its `SessionQuestion` fields (does it need an
   ordered list of vehicles/an image with numbered vehicles, etc.) from the actual official
   question format you're importing, not by analogy to any existing field here.

Only add modes that a real chunk of the official content actually supports — check
eligibility per mode (§4.3) exactly as gcodes-quiz does, don't assume every question fits
every mode.

Adding a mode later (documented precedent in this repo) touches exactly: the mode union
type + its "all modes" array, `buildSessionQuestion`'s branch, UI label/hint strings, the
UI's per-mode label record (TypeScript will force exhaustiveness if it's a `Record<Mode,
string>`), and the rendering branch in the question card component. Ordering/DB/backup
layers are written to generalize over "any mode string" and need zero changes when a mode
is added — worth deliberately architecting for this from the start.

### 4.3 Eligibility filtering

Not every question supports every mode (e.g. a text-only rule question has no image to
show in "sign → meaning" mode; a scenario question may not have a clean "reverse"
direction). A small `isEligibleForMode(question, mode)` predicate filters the bank before
building sessions, and there's a safe non-throwing fallback session-question builder for
the (should-never-happen-in-practice) case that filtering was missed somewhere. Keep this
belt-and-suspenders pattern: filtering + a safe fallback, not just one or the other.

### 4.4 Free-text answer checking

gcodes-quiz needed free-text parsing (§4.4 in that project) because G-code identifiers and
command lines are short, structured strings worth typing from memory. Official traffic-law
questions are much more naturally multiple-choice (there's rarely a short canonical string
to type), so this whole category of complexity likely **doesn't apply** — don't build a
free-text mode unless the actual official content has something short and canonical enough
to justify it (e.g. typing a specific speed limit number or article number).

## 5. Adaptive practice logic (`quizLogic.ts`)

- **Identity for adaptive weighting: prefer the source's own stable option id over
  hashing text.** gcodes-quiz has to hash each answer's *text* (`hashAnswerText`: FNV-1a
  32-bit, non-cryptographic, just for stable dedup/keys) to identify "which specific wrong
  answer did they pick," because its options are rebuilt from phrasing arrays every
  session and have no natural id. If the official source already gives every option a
  stable id (as the real ПДД dataset in §4 does — `options[].id`), **skip the hashing
  scheme entirely** and key history/weighting directly by `optionId`. Only fall back to
  hashing option text if your actual source doesn't provide stable per-option ids. Never
  key adaptive weighting by option *index* either way — indices aren't stable once
  shuffling/pooling is involved.
- **Weighted random sampling without replacement** (`weightedSample`): every candidate
  starts at weight 1 (so anything can still appear), plus bonus weight = (times this exact
  wrong answer was picked before for this question) plus a flat bonus for "close" (plausibly
  confusable) candidates. This is a good general-purpose adaptive-quiz primitive — copy as-is.
- **Per-quiz-mode stats, not global**: "weakest first" / "not answered in a while" / "least
  answered" ordering is computed *separately per quiz mode* (answers are tagged with which
  mode they were given in), since being weak in "Action → Code" shouldn't affect ordering in
  "Code → Meaning" — these test different recall directions. This is very likely to matter
  for traffic laws too if you have >1 mode (e.g. "read the sign" vs "which sign matches this
  rule").
- **Recency window**: only the most recent N (10 here) answers per question (per mode)
  count toward ordering stats, so an old mistake on now-mastered material doesn't keep a
  question flagged as "weak" forever.
- **Never-answered sorts first** for "stale"/weakest ordering by using an empty string as
  the sentinel "last answered" value (empty string sorts before any ISO timestamp) — a
  small trick worth reusing instead of a nullable-with-special-casing approach.
- Everything above is exercised by real unit tests with a seeded/deterministic `random`
  function passed in, not `Math.random()` — this is the single biggest reason this logic
  could be trusted without manual QA of every shuffle path.

## 6. Local storage & file I/O

### 6.1 SQLite (`database.ts`)

- **Append-only migrations array**, each entry a function that mutates the DB, tracked via
  `PRAGMA user_version`; never edit a past migration, only append new ones. On boot, only
  migrations past the current stored version get run.
- The `questions` SQL table is **seed-only** — it exists purely so `answers.questionId` has
  something to foreign-key against; it does *not* round-trip the full question data (that
  always comes from the static in-code bank, `getQuestionsForQuiz()`).
  **This was an actual bug that shipped once**: a hook mistakenly rebuilt sessions from the
  DB-reconstructed question list instead of the static bank, silently breaking any feature
  the DB schema didn't capture (multi-phrasing variants, worked line examples). Lesson: if
  you have "the real data lives in code, DB is just for referential integrity + history,"
  make sure every code path that builds a quiz session sources from the code bank, and add
  a test/comment flagging this if it's not obvious from the code alone.
- A generic `preferences` key/value table (gcodes-quiz uses it for UI language; this project
  has no language preference to store, being single-language) is still a convenient place to
  stash small one-off settings later (e.g., a persisted SAF backup-folder URI — see §6.3)
  without a schema migration each time.
- When storage's *meaning* changes incompatibly (e.g. answers were keyed by option index,
  which stopped being a stable concept once options became dynamically rebuilt), the
  precedent here was: migrate by `DELETE FROM answers` and start the history over, rather
  than trying to reinterpret old rows. When data instead just gains a new *dimension* old
  rows can't know (e.g. adding a nullable `mode` column), just `ALTER TABLE ADD COLUMN`
  nullable and leave old rows `NULL`, explicitly excluded from features that need it.
- `database.ts` itself can't be unit tested (native module); only pure row↔domain mapping
  functions extracted into `databaseMappers.ts` are tested directly. When adding a field
  that must persist, manually verify it round-trips the *whole* chain: migration → insert →
  select → mapper → backup export/import — don't assume the pure-logic tests catch DB-layer
  gaps.

### 6.2 Backup file format (`backupFormat.ts`)

- Deliberately **dependency-free from the rest of `data/`** (no imports of other data/*
  modules) so the backup file format's shape is self-contained and easy to reason about in
  isolation; new fields are narrow inline literal unions rather than imported types.
- New backup fields should be **optional** in the schema (and in the runtime validator) so
  older exported backup files, produced before the field existed, still validate/import
  successfully. Never make a new field required in the backup format after users may
  already have old exports.
- `isAnswersBackup(value): value is AnswersBackup` is a hand-rolled runtime type guard
  (checking every field's type manually) run on `JSON.parse()` output before trusting it —
  don't skip runtime validation of imported files just because TypeScript types exist; the
  file came from outside the app.

### 6.3 Export/import UX (`backup.ts`) — the trickiest platform-specific part

- iOS/web: no way to silently write to a public/user-visible location — write to the app's
  private cache dir (`Paths.cache` via the new `expo-file-system` `File`/`Paths` API) then
  hand off via `expo-sharing`'s `Sharing.shareAsync()` (a share-sheet/"save as" dialog).
- Android: can do genuinely dialog-free backups **after a one-time setup step**, using the
  *legacy* `expo-file-system/legacy` API's `StorageAccessFramework` namespace (not the new
  default `File`/`Directory`/`Paths` API, which is sandboxed and has no public-folder
  write capability):
  1. `StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri?)` → shows Android's
     native folder picker once → returns `{granted: false}` or `{granted: true, directoryUri}`.
  2. The native layer calls `takePersistableUriPermission` under the hood, so this grant
     **survives app restarts** — persist `directoryUri` (e.g. in the `preferences` table)
     and skip the picker on every later export.
  3. To actually write: `StorageAccessFramework.createFileAsync(directoryUri, fileNameNoExt,
     mimeType)` → returns a file URI, then `StorageAccessFramework.writeAsStringAsync(fileUri,
     content)`.
  4. If a write against the saved directory URI fails (folder deleted/permission revoked
     externally), clear the saved URI and fall back to asking again next time, rather than
     surfacing a hard error immediately.
- Import: use `expo-file-system`'s own file picker (`File.pickFileAsync`), **not**
  `expo-document-picker` — files returned by the former come with read permission already
  granted through its own tracking; files copied in by the latter lack that grant and fail
  to read with a permission error. This is a real, previously-hit gotcha, not a
  hypothetical one.
- Model "the user canceled the file/folder picker" as a distinct return value (e.g.
  `null`/`'canceled'`), never as a thrown error — callers should stay silent (no error
  alert) on cancellation, only alert on genuine failures.

## 7. Testing strategy

- **Vitest only tests pure logic** (`src/data/quizLogic.ts`, `backupFormat.ts`,
  `databaseMappers.ts`, `questions.ts`'s data invariants) — nothing that touches React
  Native components, native modules (SQLite/FileSystem), or timers/animation. This keeps
  the whole suite fast (under ~1.5s for 80 tests) and dependency-free (`vitest.config.ts`
  just points `include` at `src/tests/**/*.test.ts`, `environment: 'node'`).
- **Content-invariant tests over the question bank itself** are cheap and catch real
  authoring/import mistakes: every question has a non-empty `text`, ≥2 `options`, unique
  `options[].id` within the question, a `correctOptionId` that actually matches one of
  `options[].id`, unique question ids across the whole bank, and (domain-specific) no
  option text is literally the bare identifier used elsewhere as a "reverse mode" target.
  For **imported official content specifically**, add fidelity checks too: every official
  id/number from the source is present exactly once (no transcription drops/duplicates),
  every `imagePath` referenced actually exists as a bundled asset, and ideally a spot-check
  count against the source's own published total question count. Write these early — they
  catch typos/omissions or transcription errors the moment new content is added, long
  before manual testing would.
- **Determinism via injected `random`**: every function that shuffles or weights results
  accepts `random: () => number = Math.random` as its last parameter, so tests pass a fixed
  sequence/fake and assert exact outputs instead of "just check it doesn't crash."

## 8. TypeScript strictness choices and what they force

`tsconfig.json` extends `expo/tsconfig.base` and additionally turns on:
- `strict: true`
- `noUncheckedIndexedAccess` — every `array[i]` / `record[key]` access is typed
  `T | undefined`; expect to add non-null assertions or `as T` casts at call sites you've
  already proven are safe (with a comment explaining why), or restructure to avoid the
  access. This repo's convention: prefer a one-line comment justifying an `as T` cast over
  scattering optional-chaining that would silently hide a real bug.
- `exactOptionalPropertyTypes` — you can never explicitly assign `field: undefined` to an
  optional property; either omit the key or use a conditional spread:
  `...(value ? { field: value } : {})`. This bit repeatedly during this project's
  refactors; if starting fresh, decide this convention up front and apply it consistently
  from the first optional field.
- `verbatimModuleSyntax` — type-only imports must use `import type { X }` (or `import {
  type X }`), enforced, not just stylistic.

Biome is configured with `noExplicitAny: error`, `noNonNullAssertion: error` (forces the
`as T`-with-comment convention above instead of `!`), `noDoubleEquals: error`,
`organizeImports` assist on save/check.

## 9. Verification & CI-less quality gates

Three layered shell scripts (no separate CI service used — the pre-commit hook *is* the
gate):
- `check.sh`: format (biome, `--write`) → lint (biome `check --error-on-warnings`) →
  typecheck (`tsc --noEmit`) → tests (`vitest run`). Fast; run this constantly while
  iterating.
- `health.sh`: gitleaks secret scan (both full git history and working tree — needs
  `gitleaks` installed locally/in CI image), `expo install --check` (Expo-managed dependency
  version drift), `pnpm outdated` for the explicitly-pinned dev deps, `pnpm audit
  --ignore-unfixable` (vulnerability scan). Slower; not needed on every keystroke, but must
  pass before pushing.
- `all-checks.sh` = both, and is wired as the `pre-commit` git hook via
  `simple-git-hooks` (`package.json`'s `"simple-git-hooks": { "pre-commit": "bash
  all-checks.sh" }`, installed via the `prepare` npm script running `simple-git-hooks`).
  This means **every commit is already fully gated** — no separate CI pipeline is strictly
  required for a solo/small project of this size, but note `gitleaks` must be on `PATH` for
  the hook to succeed (a plain login shell PATH may not include wherever it's installed).

Recommended workflow for the new project: copy these three scripts near-verbatim, adjust
`pnpm outdated` package list to whatever's actually in the new project's `devDependencies`.

**Gotchas hit in practice with this pipeline, worth avoiding from the start:**
- `expo install --check` prompts interactively ("Fix dependencies? (Y/n)") when Expo-managed
  packages drift from the versions expected for the installed SDK. Running that prompt from
  inside a git hook silently aborts the commit rather than blocking on stdin — it looks like
  the commit "did nothing." Run `pnpm exec expo install --check` yourself (accepting fixes)
  and bump other pinned dev deps *before* committing, rather than discovering this via a
  stuck hook.
- Plain `pnpm audit` fails the hook on *any* advisory, including ones with no patched
  release published yet (a real GHSA advisory can claim a fix version that doesn't actually
  exist on npm). Use `pnpm audit --ignore-unfixable` so the hook only blocks on
  vulnerabilities you can actually do something about.
- When pinning a transitive-dependency fix via `pnpm-workspace.yaml`'s `overrides`, always
  confirm the target version is actually published first (`pnpm view <pkg> versions
  --json`) — pointing an override at a nonexistent version makes `pnpm install` hard-fail
  with `ERR_PNPM_NO_MATCHING_VERSION`.
- After bumping `@biomejs/biome` itself, run `pnpm exec biome migrate --write` so
  `biome.json`'s `$schema` version stays in sync (otherwise lint reports a schema-mismatch
  info message on every run).

## 10. What to actively reconsider for a "Traffic Laws" app (not just copy blindly)

- **Content sourcing/import is the real first task, not "authoring."** Since questions must
  be official, not invented, the actual first engineering task is: pick the exact official
  source (e.g. the official government-published exam ticket set), figure out its format
  (PDF/website/existing dataset), and write a one-time import/transcription step that
  produces `questions.ts` (or a generated JSON the bank loads) — treat this like an ETL job
  with its own correctness checks (§7's fidelity tests), not like writing prose. Double-check
  the source's licensing/usage terms before bundling its text/images into an app, and keep a
  record of exactly which source/version/date was imported, since traffic laws change and
  you'll need to know what to re-sync later.
- **Images are almost certainly required.** Road-sign recognition is a core part of most
  traffic-law exams and this codebase has *no* image-handling precedent at all (every
  question is pure text). Real scraped official datasets (§4) typically give you both an
  `imageUrl` (the original remote source, reference-only) and an `imagePath` (a local
  relative path once downloaded) — download images once at import time, bundle them as
  local assets, and build a `Record<imagePath, ReturnType<typeof require>>` asset map so
  `<Image source={assetMap[question.imagePath]} />` works without dynamic `require()`
  (Metro needs static `require()` paths, so a generated lookup table/switch is the usual
  pattern — a codegen step over the imported bank works well here). Also decide what to do
  with `explanationHtml`: either strip it down to plain text/plain links for display (no
  raw HTML renderer in RN by default), or parse out just the specific pieces you want
  (e.g. the referenced sign images) rather than rendering the HTML as-is.
- **Category/topic taxonomy will differ a lot** (`category: 'G' | 'M'` here is CNC-specific).
  As §4's real example shows, don't assume `category` is the useful grouping — it can be a
  near-constant label (e.g. always `"ПДД"`) while `topic` carries the real per-rule grouping
  (e.g. `"Скорость движения"`, `"Проезд перекрёстков"`). Keep the mechanism (category+topic
  → per-topic stats) but verify which field your actual source uses for real grouping before
  wiring up per-topic stats — check both, don't assume either name means what it did here.
- **Distractor "closeness" heuristic is domain-specific.** `areCodesClose` (same letter,
  numeric value within 2) has no obvious traffic-law equivalent unless signs/rules have a
  similar structured numeric ID scheme; if not, either drop the "close distractor" weight
  bonus feature entirely, or invent a different plausibility heuristic (e.g. signs in the
  same visual category — warning triangles vs. prohibition circles — are more confusable
  than across categories).
- **Legal correctness and staleness matter a lot more here.** CNC G-codes are largely
  machine/controller-standardized; traffic laws are jurisdiction-specific and get amended
  over time. Strongly consider tagging questions with the effective date/version of the
  rule they're based on and building in an explicit content-review/re-sync step, since being
  "a bit imprecise" about a machine code is low-stakes but being wrong about a traffic law
  an exam-taker relies on is not — especially since this app has no way to push content
  updates other than a new app release (no backend).

## 11. Suggested build order for the new project

1. Scaffold Expo + TypeScript with the strict `tsconfig.json` options from §8 and Biome
   config from the start — retrofitting strict flags onto an existing codebase is much
   more painful than starting with them.
2. Identify and secure the official content source (§10) first, and decide the final quiz
   modes (§4.2) based on what that source actually contains — then design
   `QuizQuestion`/`SessionQuestion` types around them before importing any real content.
   No `Language`/`LocalizedText` types anywhere (single-language).
3. Port `quizLogic.ts`'s general-purpose primitives essentially as-is: `shuffle`,
   `weightedSample`, `buildWeightedOptions`, `computeHashCounts` (rekeyed by `optionId`
   instead of a text hash — see §5), `orderQuestions`'s per-mode weakest/stale/least-
   answered logic, `getProgressPercent`/`getNextQuestionIndex`. Skip porting
   `hashAnswerText`/`getAnswerHash` unless your actual source turns out not to provide
   stable per-option ids (§5). Rewrite only the mode-specific branches of
   `buildSessionQuestion` and the eligibility predicate.
4. Stand up `database.ts` with the same append-only-migrations + `preferences` table
   pattern, `databaseMappers.ts` for testable row mapping, and `backupFormat.ts`/`backup.ts`
   split (copy `backup.ts`'s Android-SAF/iOS-share-sheet split verbatim — it required real
   trial-and-error against Expo's docs to get right).
5. Import/transcribe a small pilot batch of questions (~10) from the official source,
   covering every planned mode, and write the content-invariant + fidelity tests (§7)
   against them before scaling up to the full question bank — catching a systemic
   transcription or format mistake early is much cheaper than after hundreds of questions.
6. Build `hooks/` + `components/` last, keeping them as thin wrappers over the already-
   tested `data/` logic, exactly mirroring this project's layering.
7. Wire up `check.sh`/`health.sh`/`all-checks.sh` + the pre-commit hook immediately, not as
   an afterthought.
