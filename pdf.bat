@echo off
::
:: start and stop the NOS/BE print postprocessor
::
if /I "%1"=="start" start "nosbeformatter" /B node lpt2pdf\nosbeformatter.js -p LP5xx_C12_E5 -s printfiles -o "-tof 3 -require APPEND" > pdf.log 2>&1
if /I "%1"=="stop"  (
	for /F %%p in (pdf.pid) do taskkill /pid %%p /F /T
)
