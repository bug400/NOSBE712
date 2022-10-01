#!/usr/bin/python3
# -*- coding: utf-8 -*-
# 
# This program is used as a DtCyber helper process to seperate the
# NOSB/BE 1.5 printer output into separate printer job files in pdf format.
# (c) Joachim Siebold 2022
#
# The executable of the lpt2pdf program is expected in the lpt2pdf
# subdirectory.
#
# nosbeformatter must be called with the following parameters:
# --prt      DtCyber printer file
# --pdfdir   subdirectory for the PDF files
#
# The program reads continously the text appended to the printer file. If
# and end of job message " //// END OF LIST //// was printed twice, a
# PDF file for the job is generated with the file name:
#
# print_YYYY_MM_DD_HH_MM_SS.pdf
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
#
import time
import datetime
import subprocess
import signal
import sys
import argparse
import os.path
import platform
import logging

#
# init variables
#
f=None
proc=None
shutdown=False
start=True

#
# SIGTERM handler, sets the shutdown flag
#
def finish(signal,frame):
   global shutdown
   shutdown=True
      
#
# This proc implements good old ANSI printer control
#
# Printer control character is the first character of a line
#
# Character      Action
# blank          space vertically one line, then print
# 0              space vertically two lines, then print
# 1              eject to the first line of the next page and print
# +              no advance (not supported)
# other

def outputAnsi(line):
   global start

#
#  do not print, if line is empty
#
   if len(line)==0:
      return
#
#  do formfeed, but only if we are not at the beginning of a new print job
#
   if line[0]=="1":
      if start:
         start=False
      else:
         proc.stdin.write(b'\f');
#
#  double line feed
#
   if line[0]=="0":
      proc.stdin.write(b'\n');
#
#  overprint, not supported
#
   if line[0]=="+":
      proc.stdin.write(b'\r');
#
#  print line including the "\n"
#
   for i in range(1,len(line)):
      b=bytes(line[i],'utf-8');
      proc.stdin.write(b);
   proc.stdin.write(b'\n');


#
# write pid to file
#
def writePidToFile(pidfilePath):
    openFlags = (os.O_CREAT | os.O_WRONLY)
    openMode = 0o644
    pidfileFd = os.open(pidfilePath, openFlags, openMode)
    pidfile = os.fdopen(pidfileFd, 'w')
    pid = os.getpid()
    pidfile.write("%s\n" % pid)
    pidfile.close() 

#
# truncate file
#
def truncateFile(filePath):
    openFlags = (os.O_CREAT | os.O_WRONLY)
    openMode = 0o644
    fileFd = os.open(filePath, openFlags, openMode)
    file = os.fdopen(fileFd, 'w')
    file.seek(0)
    file.truncate()
    file.close() 

def main():
   global f,proc,start

   logging.basicConfig(filename="pdf.log",level=logging.INFO,filemode="w") 

   parser=argparse.ArgumentParser()

   parser.add_argument("--prtfile",help="printer file", required=True)
   parser.add_argument("--pdfdir",help="pdf output directory",required=True)
   args= parser.parse_args()
#
#  open log file
#


#
#  check parameters
#
   if not os.path.isfile(args.prtfile):
      logging.error("line printer file "+args.prtfile+" does not exist")
      sys.exit(1)
    
   if not os.path.exists(args.pdfdir):
      logging.error("pdf output directory "+args.prtfile+" does not exist")
      sys.exit(1)
    
   exeFile=os.path.join(os.path.dirname(__file__),"lpt2pdf")
   if platform.system() == "Windows":
      exeFile+=".exe"
   if not os.path.isfile(exeFile):
      logging.error("lpt2pdf executable not found")
      sys.exit(1)
#
#  write pid file
#
   writePidToFile("pdf.pid")
#
#  truncate printer file
#
   truncateFile(args.prtfile)
#
#  open printer file for read and activate SIGTERM handler
#
   f=open(args.prtfile,"rb")
   signal.signal(signal.SIGTERM,finish)
   proc= None
   eojCount=0;
   line=""
   logging.info("NOS/BE print postprocessor started")
   while True:
#
#     if shutdown flag was set from the SIGTERM handler, close input and exit
#
      if shutdown:
         logging.info("NOS/BE print postprocessor finished")
         logging.shutdown()
         f.close()
         break

#
#     read from file, if eof the sleep 2 secs
#
      c=f.read(1);
      if c== b'':
         time.sleep(2);
         continue;
#
#     accumulate line string and continue if not end of line
#
      if c!= b'\n':
         line=line+c.decode('utf-8')
         continue
#
#     line completed, check for end of printjob
#
      if line.find(" //// END OF LIST ////  ")!=-1 :
         eojCount+=1;

#
#     start pdf converter if not already running
#
      if proc==None:
         filename=args.pdfdir+"/print-"+datetime.datetime.now().strftime("%Y_%m_%d_%H_%M_%S")+".pdf"
         proc=subprocess.Popen([exeFile,"-tof","3","--",filename],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
         start=True
         logging.info("File "+filename+" opened")
#
#     output line with ANSI printer control
#
      outputAnsi(line)
      line=""

#
#     we encountered the end of job mark twice and are really at the last
#     line of the printjob, close connection and terminate the pdf converter
#
      if eojCount==2:
         eojCount=0
         proc.communicate()
         proc.stdin.close()
         proc=None
         logging.info("File "+filename+" closed")
         time.sleep(1)
#
#  shutdown the script
#
   if proc is not None:
      print(proc.communicate()[0])
      proc.stdin.close()
      proc=None
   time.sleep(1)
   
if __name__ == "__main__":
   main()
