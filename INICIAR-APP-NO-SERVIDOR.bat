@echo off
title Recibos Planalto - Servidor local
pushd "%~dp0"
echo.
echo Iniciando Recibos Planalto...
echo.
echo IMPORTANTE:
echo Execute este arquivo somente no computador servidor.
echo Os demais usuarios devem acessar pelo navegador.
echo.
echo Endereco neste computador:
echo http://localhost:3333
echo.
echo Para outros computadores, use:
echo http://NOME-OU-IP-DO-SERVIDOR:3333
echo.
"%~dp0recibos-planalto.exe"
popd
pause
