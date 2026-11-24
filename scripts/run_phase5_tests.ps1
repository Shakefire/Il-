$ErrorActionPreference = "Stop"
# Phase 5 acceptance tests — FORCED onto local PGlite only (never Neon).
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$env:DATABASE_URL = ""
$env:ILE_PGLITE_DIR = ".data/phase5-test-db"
$env:NODE_ENV = "test"
$env:PAYSTACK_MOCK_TRANSFERS = "true"
$env:PAYSTACK_REFUND_MOCK_RESULT = "success"
Write-Host "Running tests/phase5-production-acceptance.test.ts on local PGlite"
Write-Host "DATABASE_URL empty: $([string]::IsNullOrEmpty($env:DATABASE_URL))"
Write-Host "ILE_PGLITE_DIR=$env:ILE_PGLITE_DIR"
npx --yes tsx --import ./tests/force-phase5-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase5-production-acceptance.test.ts
exit $LASTEXITCODE
