@echo off
echo ==========================================
echo       INICIANDO SERVIDOR LOCAL
echo ==========================================
echo.
echo Se abrira el navegador automaticamente cuando este listo...
echo.

:: Start the server
call npm install
start http://localhost:5173
npm run dev
pause
