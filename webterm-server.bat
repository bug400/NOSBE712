@echo off
::
:: start and stop the web terminal server
::

if /I "%1"=="start" (
   setlocal
   cd webterm
   node genconfig
   if defined DTCYBER (
      start "WebTerm-Server" cmd /c node %DTCYBER%\webterm\webterm-server -p webterm.pid config.json
   ) else (
      start "WebTerm-Server" cmd /c node ..\..\webterm\webterm-server -p webterm.pid config.json
   )
)
if /I "%1"=="stop"  (
	for /F %%p in (webterm\webterm.pid) do taskkill /pid %%p /F /T
)
