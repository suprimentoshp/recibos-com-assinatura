@echo off
title Liberar porta 3333 - Recibos Planalto
echo.
echo Este arquivo precisa ser executado COMO ADMINISTRADOR no computador servidor.
echo.
netsh advfirewall firewall add rule name="Recibos Planalto porta 3333" dir=in action=allow protocol=TCP localport=3333
echo.
echo Regra criada. Agora deixe o INICIAR-APP-NO-SERVIDOR.bat aberto e teste:
echo http://srv-100:3333
echo.
pause
