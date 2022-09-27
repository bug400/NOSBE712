/* 
 *  Copyright (c) 2013, Timothe Litt

 *  Permission is hereby granted, free of charge, to any person obtaining a
 *  copy of this software and associated documentation files (the "Software"),
 *  to deal in the Software without restriction, including without limitation
 *  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *  and/or sell copies of the Software, and to permit persons to whom the
 *  Software is furnished to do so, subject to the following conditions:

 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.

 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
 *  THE AUTHOR BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 *  IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 *  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 *  Except as contained in this notice, the name of the author shall not be
 *  used in advertising or otherwise to promote the sale, use or other dealings
 *  in this Software without prior written authorization from the author.
 *
 */

#ifndef LPT2PDF_H_
#define LPT2PDF_H_  0

/* Provides an API for writing lineprinter data to pdf files with simulated paper.
 *
 * The API for the library is fairly straightforward:
 *  PDF_HANDLE handle = pdf_open ("pdf_file.pdf");
 *     "-" will use stdout (which must be seekable - e.g. not a pipe.)
 *     Returns NULL on error; errno may give a clue.
 *
 * int pdf_reopen (handle)
 *     write all pending data to file
 *     start a new session (can have different parameters)
 *     Returns PDF_OK for success
 *
 *  int pdf_set (handle, ITEM, value)
 *     optionally modify the default parameters (setup for standard US greenbar)
 *     Returns PDF_OK for success
 *
 *     Will fail if called after pdf_print; the parameters are locked in by first output.
 *     Numbers are passed as a const double, strings as const char *.
 *     Fonts must be one of the standard 14, they are not embedded.  Non-monospace will produce
 *     unhelpful results.
 *      The standard fonts are:
 *        Times-Roman, Helvetica, Courier, Symbol, Times-Bold, Helvetica-Bold,
 *        Courier-Bold, ZapfDingbats, Times-Italic, HelveticaOblique, Courier-Oblique,
 *        Times-BoldItalic, Helvetica-BoldOblique, Courier-BoldOblique
 *
 *       Item Name             Units  Default     Description
 *       PDF_PAGE_LENGTH       Inches 11.000      Length of page (including all margins)
 *       PDF_TOP_MARGIN        Inches 1.000       White space at top of each page before bar 1
 *       PDF_TOF_OFFSET        Lines  6           Offset on form of line 1.
 *       PDF_LPI               Lines  6           Vertical pitch: lines/inch (6 or 8 useful)
 *       PDF_LPP               Lines  66          Lines/page (calculates length using LPI)
 *       PDF_BOTTOM_MARGIN     Inches 0.500       White space at bottom of each page (after last bar)
 *       PDF_PAGE_WIDTH        Inches 14.875      Width of page (including all margins)
 *       PDF_SIDE_MARGIN       Inches 0.470       Tractor feed hole area (not useful)
 *       PDF_BAR_HEIGHT        Inches 0.500       Bar height (other values: 1 line @ 6LPI 0.167, @8LPI 0.125)
 *       PDF_CPI               Chars  10          Horizontal pitch: chars/inch
 *       PDF_COLS              Chars  132         Output width (used to center in printable area)
 *       PDF_LNO_WIDTH         Inches 0.100       Line number columns' width (not useful)
 *       PDF_TEXT_FONT           *    Courier     Font used to render output
 *       PDF_LNO_FONT            *    Times-Roman Font used to render line number columns
 *       PDF_LABEL_FONT          *    Times-Bold  Font used to render labels
 *       PDF_FILE_REQUIRE      keyword "NEW"      PDF file requirements:
 *                                     "NEW"      File must be new; if exists with content, will not be written.
 *                                     "APPEND"   If file is an existing PDF, append new data.  Otherwise if empty, initialize.
 *                                     "REPLACE"  Replace any existing content (file is truncated and initialized as new.)
 *       PDF_TITLE               *    Lineprinter Data String embedded in the PDF.
 *       PDF_FORM_TYPE         keyword GREENBAR   Form to image on each page
 *                                    "GREENBAR"   - Standard greenbar
 *                                    "BLUEBAR"    - Standard bluebar
 *                                    "YELLOWBAR"  - Standard yellowbar
 *                                    "GRAYBAR"    - Standard graybar
 *                                    "PLAIN"      - Plain white
 *       PDF_FORM_IMAGE     filename              File name for image background (over form)  JPEG or PNG.
 *                                                Image can be used for logos, special forms.  It is 
 *                                                scaled to fit the width of the page, less margins.
 *                                                Aspect ratio is maintained. 
 *
 *    Sanity checks for values are limited; you can produce unreasonable results with unreasonable input.
 *
 * int pdf_print (handle, const char * string, size_t length)
 *     As much or as little output as is ready
 *     The interpreter is oriented for lineprinter data, and so currently does minimal 
 *     interpretation of the data.  ANSI escape sequences are parsed, but not currently acted on.
 *     As some point, a few may be implemented to enable the emulated device to affect rendering;
 *     however device emulation is not the main purpose.  The following controls are implemented:
 *              o <FF>   (^L, \f) Advance to top of next page.
 *              o <LF>   (^J, \n) New line; equivalent to <CR><LF> on a TTY.
 *              o <CR>   (^M, \r) Carriage return (overprint line)
 *
 *     PDF_USE_STRLEN for size will do the obvious.
 *     Returns PDF_OK for success
 *
 * int pdf_where (PDF_HANDLE pdf, size_t *page, size_t *line)
 *     Obtains the page/and or line number where the next pdf_print will write.
 *     Specify NULL if a value is not wanted. 
 *
 *     Both values are 1-based, and refer to the physical file and page.
 *     e.g. if PDF_TOF_OFFSET is 6, following a formfeed, line wil be 7.
 *
 *     The page number is relative to the entire PDF file, including all previous sessions.
 *
 *     Note that the returned page and line may not exist unless pdf_print is called subsequently.
 *
 *     Returns PDF_OK for success
 *
 * int pdf_is_empty (PDF_HANDLE pdf)
 *     Returns true if the file contains any pages (full or partial).
 *
 * const char *const *pdf_get_formlist ( size_t *length )
 *    Returns a NULL-terminated list of the supported form names, and optionally it's length.
 *
 * const char *const *pdf_get_fontlist ( size_t *length )
 *    Returns a NULL-terminated list of the supported font names, and optionally it's length.
 *
 * int pdf_checkpoint (handle)
 *     Checkpoint a file - this means write the metadata to make it readable, but leave it open.
 *     Any partially-written page is NOT flushed.  The next pdf_print will make the file unreadable
 *     again.  This is useful for cases where a file is left open for write for long periods with no
 *     data being added, as in device simulators.  Similar to fflush, but rather more expensive.
 *
 * int pdf_snapshot (PDF_HANDLE, filename)
 *     Checkpoint and atomically copy a file to a new file.  The handle remains open.  The new file
 *     will not contain the last page if that page isn't full.
 *
 * int pdf_close (handle)
 *     Closes file after writing metadata.
 *     handle is invalid thereafter.
 *     Returns PDF_OK for success
 *
 * PDF_HANDLE pdf_newfile (PDF_HANDLE openpdf, const char *filename)
 *    Used when the output file is to be handed to an external process, such
 *    as a printer, and a new file is replace it.
 *
 *    Opens a new pdf file with the same parameters as an open file.
 *    The new file does not inherit any other state from the open file.
 *    Does not close the open file.
 *    Returns the new PDF_HANDLE, or NULL if an error occurs.
 *
 * int pdf_file (filename)
 *    Returns PDF_OK if file has a PDF header.
 *    Not an exhaustive check, but can be used to see if appending should be PDF or text.
 *
 * int pdf_error (PDF_HANDLE pdf)
 *    pdf must be valid.  Specify NULL if pdf_open or pdf_close fails.
 *    Returns the last error on this handle (or from errno if pdf is NULL
 *
 * const char *pdf_strerror (int errnum)
 *    Returns the string corresponding to the specified error (pdf or system)
 *
 * void pdf_perror (PDF_HANDLE pdf, const char *s)
 *    Prints string corresponding to last error on stdout (same as perror())
 *
 * void pdf_clearerr (PDF_HANDLE pdf)
 *    Clears last error.  Really only useful for pdf_set errors.
 * 
 */

#include <stdarg.h>
#include <stdlib.h>

#define PDF_OK (0)

typedef void *PDF_HANDLE;

int pdf_file ( const char *name );

PDF_HANDLE pdf_open (const char *filename);

PDF_HANDLE pdf_newfile (PDF_HANDLE pdf, const char *filename);

FILE *pdf_open_exclusive (const char *filename, const char *mode);

int pdf_reopen (PDF_HANDLE);

int pdf_set (PDF_HANDLE pdf, int arg,...);
#define PDF_NO_LZW        (-1)
#define PDF_TOP_MARGIN    (1)
#define PDF_BOTTOM_MARGIN (2)
#define PDF_SIDE_MARGIN   (3)
#define PDF_LNO_WIDTH     (4)
#define PDF_CPI           (5)
#define PDF_LPI           (6)
#define PDF_PAGE_WIDTH    (7)
#define PDF_PAGE_LENGTH   (8)
#define PDF_COLS          (9)
#define PDF_TEXT_FONT     (10)
#define PDF_LNO_FONT      (11)
#define PDF_LABEL_FONT    (12)
#define PDF_FILE_REQUIRE  (13)
#define PDF_TITLE         (14)
#define PDF_TOF_OFFSET    (15)
#define PDF_FORM_TYPE     (16)
#define PDF_FORM_IMAGE    (17)
#define PDF_BAR_HEIGHT    (18)
#define PDF_LPP           (19)

int pdf_print (PDF_HANDLE pdf, const char *string, size_t length);
#define PDF_USE_STRLEN ((size_t)(~0u))

int pdf_where (PDF_HANDLE pdf, size_t *page, size_t *line);

int pdf_is_empty (PDF_HANDLE pdf);

const char *const* pdf_get_formlist ( size_t *length );

const char *const* pdf_get_fontlist ( size_t *length );

int pdf_checkpoint (PDF_HANDLE pdf);

int pdf_snapshot (PDF_HANDLE, const char *filename);

int pdf_close (PDF_HANDLE pdf);

int pdf_error (PDF_HANDLE pdf);

const char *pdf_strerror (int errnum);

void pdf_perror (PDF_HANDLE pdf, const char *s);

void pdf_clearerr (PDF_HANDLE pdf);

#ifdef PDF_BUILD_
static const char *const errortext[] = {
#define E__(s) "PDF: " #s,
#else
#define E__(s)
#endif
#define PDF_E_BASE             (10000)

#define PDF_E_BAD_ERRNO        (PDF_E_BASE +   0)
    E__(Invalid error number)
#define PDF_E_BAD_HANDLE       (PDF_E_BASE +   1)
    E__(Invalid handle)

#define PDF_E_NOT_PDF          (PDF_E_BASE +   2)
    E__(Not a PDF file)

#define PDF_E_ACTIVE           (PDF_E_BASE +   3)
    E__(pdf_set called after first output)

#define PDF_E_NEGVAL           (PDF_E_BASE +   4)
    E__(Argument value may not be negative)

#define PDF_E_INVAL            (PDF_E_BASE +   5)
    E__(Argument value out of range)

#define PDF_E_BAD_SET          (PDF_E_BASE +   6)
    E__(Unknown argument to pdf_set)

#define PDF_E_UNKNOWN_FONT     (PDF_E_BASE +   7)
    E__(Not a standard PDF font)

#define PDF_E_INCON_GEO        (PDF_E_BASE +   8)
    E__(Inconsistent geometry specified)

#define PDF_E_BUGCHECK         (PDF_E_BASE +   9)
    E__(Coding error: consistency check failed)

#define PDF_E_NO_APPEND        (PDF_E_BASE +  10)
    E__(Unable to append to this PDF file - file structure not recognized)

#define PDF_E_NOT_PRODUCED     (PDF_E_BASE +  11)
    E__(Unable to append to this PDF file - not produced by lpt2pdf)

#define PDF_E_BAD_JPEG         (PDF_E_BASE +  12)
    E__(Image file is not JPEG)

#define PDF_E_NOT_OPEN         (PDF_E_BASE +  13)
    E__(Output file not open)

#define PDF_E_NOT_EMPTY        (PDF_E_BASE +  14)
    E__(Output file not empty and append not enabled)

#define PDF_E_IO_ERROR         (PDF_E_BASE +  15)
    E__(I/O error on PDF file)

#define PDF_E_OTHER_IO_ERROR   (PDF_E_BASE +  16)
    E__(I/O error not on PDF file)

#define PDF_E_UNKNOWN_FORM     (PDF_E_BASE +  17)
    E__(Form name not recognized)

#define PDF_E_BAD_FILENAME     (PDF_E_BASE +  18)
E__(Bad filename - null or not .pdf)

#define PDF_E_UNKNOWN_IMAGE    (PDF_E_BASE +  19)
    E__(Unrecognized image file format)

#define PDF_E_BAD_PNG          (PDF_E_BASE +  20)
    E__(Image file is not PNG)

#define PDF_E_UNSUP_PNG        (PDF_E_BASE +  21)
    E__(PNG Image file version not supported)

#undef E__
#ifdef PDF_BUILD_
};
#endif

#endif
