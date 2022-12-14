@echo off
if defined DTCYBER (
%DTCYBER%\dtcyber %1
)else (
..\dtcyber %1
)
