@echo off
if defined DTCYBER (
%DTCYBER%\bin\dtcyber
)else (
..\bin\dtcyber
)
