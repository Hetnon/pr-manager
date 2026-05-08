# pr-matrix/start.ps1
# Launches the PR matrix server. Run from anywhere; CWD-aware.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverFile = Join-Path $scriptDir "server.js"

if (-not (Test-Path $serverFile)) {
    Write-Error "server.js not found at $serverFile"
    exit 1
}

# Verify Node and gh are available
foreach ($cmd in @('node', 'gh')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "$cmd is not installed or not in PATH"
        exit 1
    }
}

# Verify we're in a git repo (one level up from this folder)
$repoRoot = Split-Path -Parent $scriptDir
Push-Location $repoRoot
try {
    git rev-parse --is-inside-work-tree 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Parent directory ($repoRoot) is not a git repository."
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "Starting PR Matrix..." -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

node $serverFile