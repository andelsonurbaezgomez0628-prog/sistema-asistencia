@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 goto sin_node

where npm.cmd >nul 2>&1
if errorlevel 1 goto sin_npm

if not exist ".env" goto falta_env

echo Iniciando Asistencia Escolar Inteligente...
start "Asistencia Escolar - Servidor" /D "%~dp0" cmd /k "npm.cmd start"

set intentos=0
:esperar_servidor
curl.exe --silent --fail --max-time 1 http://127.0.0.1:3000/health >nul 2>&1
if not errorlevel 1 goto abrir_navegador

set /a intentos+=1
if %intentos% geq 30 goto fallo_inicio
timeout /t 1 /nobreak >nul
goto esperar_servidor

:abrir_navegador
start "" "http://127.0.0.1:3000"
echo Servidor listo en http://127.0.0.1:3000
exit /b 0

:sin_node
echo Error: instala Node.js 22 o superior y vuelve a ejecutar este archivo.
pause
exit /b 1

:sin_npm
echo Error: no se encontro npm. Reinstala Node.js 22 o superior.
pause
exit /b 1

:falta_env
echo Error: falta el archivo .env. Copia .env.example a .env y configura DATABASE_URL y SESSION_SECRET.
pause
exit /b 1

:fallo_inicio
echo Error: el servidor no respondio en 30 segundos. Revisa la ventana del servidor y tu configuracion .env.
pause
exit /b 1