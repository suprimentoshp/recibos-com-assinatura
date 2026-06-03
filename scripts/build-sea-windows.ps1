$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$release = Join-Path $root "release"
$seaDir = Join-Path $release "sea"
$exe = Join-Path $release "recibos-planalto.exe"
$blob = Join-Path $seaDir "recibos-planalto.blob"
$nodeExe = Join-Path (Split-Path -Parent (Get-Command node.exe).Source) "node.exe"
$postject = Join-Path $root "node_modules\.bin\postject.cmd"

New-Item -ItemType Directory -Force -Path $release | Out-Null
New-Item -ItemType Directory -Force -Path $seaDir | Out-Null

& node.exe --experimental-sea-config (Join-Path $root "sea-config.json")
Copy-Item -LiteralPath $nodeExe -Destination $exe -Force

& $postject $exe NODE_SEA_BLOB $blob `
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

Copy-Item -LiteralPath (Join-Path $root "app-sem-npm.html") -Destination (Join-Path $release "app-sem-npm.html") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $release "dist") | Out-Null
Copy-Item -Path (Join-Path $root "dist\*") -Destination (Join-Path $release "dist") -Recurse -Force

Write-Host "Executavel gerado: $exe"
