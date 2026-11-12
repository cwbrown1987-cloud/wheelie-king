# Wheelie King v2.0 QA on My-PC GPU against the live beta. Writes only inside this folder.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$env:WK_GPU = '1'
if (-not $env:WK_TEST_URL) { $env:WK_TEST_URL = 'https://wheelie-king-beta.pages.dev/' }
$env:WK_QA_OUT = Join-Path $PSScriptRoot 'qa-out'
node qa-main.mjs *> qa-run.log
