# pdd-quiz

Offline, Russian-language Expo app for preparing for the traffic-laws (ПДД) exam.
Multiple-choice quizzes are built from an officially-sourced question bank and stored
locally in SQLite, so the app works with no network connection and no accounts.

See [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) for the full architecture and design
decisions.

## Features

- Multiple-choice quizzes over the official ПДД ticket bank (question text, image, and
  official answer options), with the correct answer keyed by a stable option id so option
  order can be shuffled freely.
- Question ordering: sequential, random, or **weakest-first** (adaptive — recently missed
  and never-seen questions surface first, per quiz mode).
- Answer history persisted locally in SQLite; per-topic and overall accuracy stats.
- Local backup/restore of answer history to a JSON file (share sheet on iOS, file picker
  on import) — no backend, no accounts, fully offline.

## Stack

- Expo SDK 57 + React Native, TypeScript (strict)
- pnpm package manager
- Biome (lint + format)
- Vitest (pure-logic unit tests)
- gitleaks (secret scanning)

## Getting started

```bash
pnpm install
pnpm start        # Expo dev server
pnpm android      # run on Android
pnpm ios          # run on iOS
pnpm web          # run in the browser
```

## Quality gates

```bash
pnpm run check        # format, lint, typecheck, tests
pnpm run health       # secret scan, dependency drift, vulnerabilities
pnpm run all-checks   # both of the above (also runs as the pre-commit hook)
```

`all-checks.sh` runs automatically on every commit via `simple-git-hooks`. Install the
hook once with `pnpm install` (the `prepare` script wires it up). `health.sh` requires
[gitleaks](https://github.com/gitleaks/gitleaks) on your `PATH`.

## Content generation

The bundled question bank and image asset map are generated from the raw data in `data/`:

```bash
pnpm run codegen
```

## Project structure

```
src/
  app.tsx              composition root (wires hooks + components)
  strings.ts           Russian UI strings
  styles.ts            shared StyleSheet
  logger.ts            error funnel
  components/          presentational only (QuizCard, SettingsControls, StatsView)
  hooks/               state + side effects (useQuiz, useStats, useBackup)
  data/
    questions.ts       bank loader + types
    quizLogic.ts       pure session/order/stats logic (fully unit-tested)
    database.ts        SQLite init/migrations/CRUD
    databaseMappers.ts pure row <-> domain mapping
    backupFormat.ts    pure backup serialize/validate
    backup.ts          file I/O over backupFormat + database
  tests/               Vitest, one file per pure-logic module
scripts/
  generate-questions.ts  ETL/codegen from data/ into bundled assets
```

Anything that can be pure logic lives in its own file under `data/` with a matching test in
`tests/`; components and hooks stay thin wrappers over it.
