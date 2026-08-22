#!/usr/bin/env bash
set -euo pipefail

echo "=== Secret scan (gitleaks) ==="
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "ERROR: gitleaks is not installed or not on PATH"
  echo "Install it from https://github.com/gitleaks/gitleaks (do not install into the project root)"
  exit 1
fi
gitleaks git . -v
gitleaks dir . -v

echo "=== Expo dependency drift (expo install --check) ==="
pnpm exec expo install --check

echo "=== Dependency freshness (dev tooling) ==="
if pnpm outdated vitest @types/react @types/node @biomejs/biome simple-git-hooks; then
  echo "Dev dependencies are up to date"
else
  echo "Outdated dev dependencies found"
  exit 1
fi

echo "=== Vulnerabilities (pnpm audit) ==="
# --ignore-unfixable: don't block the hook on advisories with no published fix yet;
# still fails on anything we can actually resolve (e.g. via a pnpm override).
pnpm audit --ignore-unfixable

echo "=== health.sh OK ==="
