/*
 This program is used as a DtCyber helper process to seperate the
 NOSB/BE 1.5 printer output into separate printer job files in pdf format.
 (c) Joachim Siebold 2022

 The executable of the lpt2pdf program is expected in the lpt2pdf
 subdirectory.

 nosbeformatter must be called with the following parameters:
 -p        DtCyber printer file
 -s        subdirectory for the PDF files

 Optionally optinally options can be passed to the lpt2pdf program:

 -o "lpt2pdf parameters"

 which must be enclosed in "".

 Example:

 node lpt2pdf/nosbeformatter.js -p LP5xx_C12_E5 -s $curdir/spool  -o "-tof 3" &

 The program reads continously the text appended to the printer file. If
 and end of job message " //// END OF LIST //// was printed twice, a
 PDF file for the job is generated with the file name:

 print_YYYY_MM_DD_HH_MM_SS.pdf

 This nosbeformatter.js does not require the installation of additional modules.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation; either version 2
 of the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
*/

const fs= require('fs');
const path= require('path');
const child_process= require("child_process");
const process= require('process');

const BufferSize=64*1024;

var optInd=2;
var printFile="";
var optionString="";
var spoolDir="";

var position=0;
var buffer= Buffer.alloc(BufferSize)
var bytesRead;
var line='';
var eojCount=0;
var child= null;
var start= true;
var options= [];
var pid=process.pid;
var isWin=process.platform=== "win32";



// printFile watch event handler
function handleEvent (curr,prev) {
   if(curr.size > position) {
      bytesRead=fs.readSync(printFileDesc,buffer,0,curr.size-position);
      for(var i=0;i< bytesRead; i++) {
         if (buffer[i]==10) {
            processLine(line);
            line='';
         } else {
           line+=String.fromCharCode(buffer[i]);
         }
      }
   }
   position=curr.size;
   return;
}

// process line function
function processLine(line) {
   if(line.length==0) {
      return;
   }
   // check for end of print job
   if(line.includes(' //// END OF LIST ////  ')) {
      eojCount+=1;
   }
   // start PDF converter, if not already running
   if (child== null) {
      // assemble time stamped file name
      let date_ob = new Date();
      let date = ("0" + date_ob.getDate()).slice(-2);
      let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
      let year = date_ob.getFullYear();
      let hours = ("0" +date_ob.getHours()).slice(-2);
      let minutes = ("0"+date_ob.getMinutes()).slice(-2);
      let seconds = ("0"+date_ob.getSeconds()).slice(-2);
      let pdfFileName=path.join(spoolDir,"print_"+year+"_"+month+"_"+date+"_"+hours+"_"+minutes+"_"+seconds+".pdf");
      // spawn pdf print file generator lpt2pdf
      let exeFile=path.join(__dirname,"lpt2pdf");
      if(isWin) {
         exeFile+=".exe";
      }
      let opts=options.concat('--',pdfFileName);
      child=child_process.spawn(exeFile,opts,{detached: true} );
      child.stdout.pipe(process.stdout);
      child.stderr.pipe(process.stderr);
      child.stdin.setEncoding('utf8');
      start= true;
      console.log("spawned .....");
      child.on('close',(code,signal) => {
         console.log(`child process terminated ${code} ${signal}`);
      });
      child.on('spawn',function()  {
         console.log(`spawned ${exeFile} ${opts}`);
      });
   }
   // do form feed, but only if we are not at the beginning of a print job
   if (line[0]=='1') {
      if(start) {
         start=false
      } else {
         child.stdin.write('\f');
      }
   }
   // double line feed
   if (line[0]=='0') {
      child.stdin.write('\n');
   }
   // overprint not supported by lpt2pdf
   if(line[0]=='+') {
      child.stdin.write(' ');
   }
   // print line
   if(line.length > 1) {
      child.stdin.write(line.substring(1));
   }
   child.stdin.write('\n');
   
   // end of print job, terminate lpt2pdf
   if(eojCount==2) {
      eojCount=0;
      child.stdin.end();
      child=null;
      console.log("end .......");
   }
   return;
}

// print script usage and exit
function printUsage() {
   console.log('Usage: pdfwatcher -p <printer file> -s <spool dir> [-o "lpt2pdf options"]');
   console.log('       lpt2pdfoptions must be encosed in "');
   console.log('');
   console.log('Example: node nosbeformatter.js -p LP5xx_C12_E5 -s printfiles -o "-tof 3"');
   console.log('');
   process.exit(1);
}

// exit handler
function exitNormal() {
   fs.closeSync(printFileDesc);
   console.log("SIGTERM received, terminating...");
   process.exit(0);
}

// main program, parse command line
while (optInd < process.argv.length) {
   if(process.argv[optInd] === "-p") {
      printFile= process.argv[optInd+1];
      optInd+=2;
   } else if (process.argv[optInd] === "-s") {
      spoolDir=process.argv[optInd+1];
      optInd+=2;
   } else if (process.argv[optInd] === "-o") {
      optionString= process.argv[optInd+1];
      options=optionString.split(' ');
      optInd+=2;
   } else {
      printUsage();
   }
}
if ( printFile ==="" ) printUsage();
if ( spoolDir ==="" ) printUsage();
if(optionString !== "") console.log("lpt2pdf options:",optionString);

// activate sigterm handler
process.once('SIGTERM', exitNormal);

// create empty printer file
fs.closeSync(fs.openSync(printFile, 'w'))

// open printer file for read
printFileDesc=fs.openSync(printFile);

// watch printer file
fs.watchFile(printFile,{persistent:true, interval:250}, handleEvent);
console.log("start watching printer file:",printFile);

// write pid file
pidFile = fs.createWriteStream('pdf.pid');
pidFile.write(pid.toString());
pidFile.end();
