$ErrorActionPreference = "Continue"
$results = @()

Write-Host "=== backend tsc ==="
npx --yes tsc -p backend/tsconfig.json --noEmit
$results += "backend_tsc=$LASTEXITCODE"

Write-Host "=== root tsc (noEmit) ==="
npx --yes tsc --noEmit
$results += "root_tsc=$LASTEXITCODE"

Write-Host "=== next lint ==="
npx --yes next lint
$results += "next_lint=$LASTEXITCODE"

Write-Host "=== next build ==="
# Avoid SSG hitting Neon: empty DATABASE_URL for build process only
$prior = $env:DATABASE_URL
$env:DATABASE_URL = ""
try {
  npm run build
  $results += "next_build=$LASTEXITCODE"
} finally {
  if ($null -ne $prior) { $env:DATABASE_URL = $prior } else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
}

Write-Host "=== flutter analyze ==="
Push-Location apps/mobile
flutter analyze
$results += "flutter_analyze=$LASTEXITCODE"
Write-Host "=== flutter test ==="
flutter test
$results += "flutter_test=$LASTEXITCODE"
Write-Host "=== flutter apk ==="
flutter build apk --release
$results += "flutter_apk=$LASTEXITCODE"
Pop-Location

Write-Host "RESULTS:"
$results | ForEach-Object { Write-Host $_ }
$results | Set-Content -Path (Join-Path (Get-Location) ".data\phase4-build-results.txt")
