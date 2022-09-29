###### NOS/BE printer formatter

This directory contains the software that separates the print jobs in the
LP5xx_C12_E5 file into PDF files and stores them in the printfiles subdirectory.

The Python script nosbeformatter.py is started from DtCyber with the pdf
helper script in the main directory. It watches the output to the
LP5xx_C12_E5 file, separates the jobs and runs the executable program
lpt2pdf which creates nice high fidelity fan fold paper print files for each
print job.

You must build the lpt2pdf executable with:

      gcc -o lpt2pdf lpt2pdf.c

There are no dependencies.

The program lpt2pdf was taken from https://github.com/tlhackque/simh, Author Tim Litt.
