$ErrorActionPreference = "Stop"

$env:NODE_OPTIONS = "--use-system-ca"

& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run build:exe

Write-Host ""
Write-Host "Executavel gerado em release\recibos-planalto.exe"
Write-Host "Dados da versao local: C:\ProgramData\RecibosPlanalto\data"
