@echo off
::
:: start and stop the console server
::

if /I "%1"=="start" (
   setlocal
   cd webterm
   node genconfig console.template console.json
   if defined DTCYBER (
      start "Console-Server" cmd /c node %DTCYBER%\webterm\webterm-server -t console-server -p console.pid console.json
   ) else (
      start "Console-Server" cmd /c node ..\..\webterm\webterm-server -t console-server -p console.pid console.json
   )
)
if /I "%1"=="stop"  (
	for /F %%p in (webterm\console.pid) do taskkill /pid %%p /F /T
)
