$ErrorActionPreference = "Stop"
# Phase 4 integration tests — FORCED onto local PGlite only (never Neon).
# Clears DATABASE_URL and points ILE_PGLITE_DIR at .data/phase4-test-db via
# tests/force-phase4-db.mjs (loaded before dotenv / getDb).
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$env:DATABASE_URL = ""
$env:ILE_PGLITE_DIR = ".data/phase4-test-db"
$env:NODE_ENV = "test"
$env:PAYSTACK_MOCK_TRANSFERS = "true"
$env:PAYSTACK_REFUND_MOCK_RESULT = "success"
Write-Host "Running tests/phase4-remediation.test.ts on local PGlite"
Write-Host "DATABASE_URL empty: $([string]::IsNullOrEmpty($env:DATABASE_URL))"
Write-Host "ILE_PGLITE_DIR=$env:ILE_PGLITE_DIR"
npx --yes tsx --import ./tests/force-phase4-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase4-remediation.test.ts
exit $LASTEXITCODE
