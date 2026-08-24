[CmdletBinding()]
param(
  [ValidateSet('install', 'format', 'format:check', 'lint', 'typecheck', 'verify:evidence', 'gate:product-design', 'test', 'test:unit', 'test:contract', 'check')]
  [string]$Task = 'check'
)

$ErrorActionPreference = 'Stop'

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue

if (-not $nodeCommand -or -not $pnpmCommand) {
  $runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
  $nodeDirectory = Join-Path $runtimeRoot 'node\bin'
  $bundledNode = Join-Path $nodeDirectory 'node.exe'
  $bundledPnpm = Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'

  if (-not (Test-Path -LiteralPath $bundledNode) -or -not (Test-Path -LiteralPath $bundledPnpm)) {
    throw 'Node.js 24 and pnpm 11 are required. Neither system commands nor the Codex bundled runtime were found.'
  }

  $env:PATH = "$nodeDirectory;$env:PATH"
  $pnpmExecutable = $bundledPnpm
}
else {
  $pnpmExecutable = $pnpmCommand.Source
}

if ($Task -eq 'install') {
  & $pnpmExecutable install --frozen-lockfile
}
else {
  & $pnpmExecutable $Task
}

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
