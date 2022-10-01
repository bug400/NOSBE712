@echo off
::
:: start and stop the NOS/BE print postprocessor
::
if /I "%1"=="start" start "nosbeformatter" /B python lpt2pdf\nosbeformatter.py --prtfile LP5xx_C12_E5 --pdfdir printfiles
if /I "%1"=="stop"  (
	for /F %%p in (pdf.pid) do taskkill /pid %%p /F /T
)
