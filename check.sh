#!/usr/bin/env bash
set -euo pipefail

echo "=== Format (biome --write) ==="
pnpm exec biome check --write .

echo "=== Lint (biome --error-on-warnings) ==="
pnpm exec biome check --error-on-warnings .

echo "=== Typecheck (tsc --noEmit) ==="
pnpm exec tsc --noEmit

echo "=== Tests (vitest run) ==="
pnpm exec vitest run

echo "=== check.sh OK ==="
