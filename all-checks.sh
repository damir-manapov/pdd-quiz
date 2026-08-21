#!/usr/bin/env bash
set -euo pipefail

bash check.sh
bash health.sh

echo "=== all-checks.sh OK ==="
