@echo off
setlocal

set "ROOT=%~dp0"

echo Iniciando backend na porta 1332...
start "backend" cmd /k "cd /d %ROOT%backend && set PORT=1332 && npm run start"

echo Iniciando frontend na porta 1330...
start "frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

exit /b
