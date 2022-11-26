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

/*
 * command line parameter data
 */
var optInd=2;
var printFile="";
var optionString="";
var spoolDir="";

/*
 * subprocess status enums
 */
const Stat = {
   Stopped: 0,
   Starting: 1,
   Running: 2,
   Stopping: 3,
}


/*
 * global variables
 */
var intervalObject;                   // timer interval object
var position=0;                       // current position in printer file
var buffer= Buffer.alloc(BufferSize); // printer file read buffer
var bytesRead;                        // number of bytes in read buffer
var line='';                          // assembled line from read buffer
var eojCount=0;                       // no occurrences of the end of job mark
var child= null;                      // child variable
var beginOfJob= true;                 // true, if at beginning of a print job
var options= [];                      // lpt2pdf options
var pid=process.pid;                  // pid of our process
var isWin=process.platform=== "win32";// true, if we run under Windows
var status=Stat.Stopped;              // subprocess status


/*
 * The print file watch event handler is called every 250ms
 * If the file size changed the new contend is read into "buffer"
 * The buffer content is processed line by line and each line is
 * sent to the processLine subroutine.
 * If the line could not be processed by the processLine subroutine
 * because a previous lpt2pdf subprocess did not start or terminate in time,
 * then the function exits and the remaining data must be processed
 * during the next scheduled event
 */

function watchPrintFile() {

   var requiredBufferSize;

   fs.stat(printFile, (err,curr)=> {

      if(err) {
         console.log('cannot access printer file');
      } else {
         // file size did change
         if(curr.size > position) {

            // no running subprocess, issue starting it
            if(status==Stat.Stopped) {
               startSubProcess();
               return;
            }

            // the subprocess is up and running, process data
            if(status==Stat.Running) {

               // prevent overflow of  buffer, if there are more bytes to read
               // then they must be processed in the next schedule of this
               // function
               requiredBufferSize=curr.size-position;
               if(requiredBufferSize>BufferSize) requiredBufferSize= BufferSize;
               bytesRead=fs.readSync(printFileDesc,buffer,0,requiredBufferSize,position);
               for(var i=0;i< bytesRead; i++) {
                  // build line from buffer data
                  if (buffer[i]==10) {
                     if(processLine(line)) {
                        position+=1;
                        line='';
                     } else {
                        // we could not process the line, redo it in the
                        // next schedule
                        position-=line.length;
                        line='';
                        break;
                     }
                  } else {
                    line+=String.fromCharCode(buffer[i]);
                    position+=1;
                  }
               }
            }
         }
      }
   });
   return;
}

// start PDF converter subprocess
function startSubProcess() {

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
   console.log("spawned .....");
   status=Stat.starting;

   // the subprocess is completely shut down if this event was fired
   // and status was set to Stat.Stopped
   child.on('close',(code,signal) => {
      status=Stat.Stopped;
      console.log(`child process terminated ${code} ${signal}`);
   });

   // the subprocess is up and running, if this event was fired and status
   // was set to Stat.Running.
   child.on('spawn',function()  {
      status=Stat.Running;
      console.log(`spawned ${exeFile} ${opts}`);
   });
}

// process line function
function processLine(line) {
var outLine="";

   if(line.length==0) {
      return(true);
   }
   // check for end of print job
   if(line.includes(' //// END OF LIST ////  ')) {
      eojCount+=1;
   }
   // do form feed, but only if we are not at the beginning of a print job
   if (line[0]=='1') {
      if(beginOfJob) {
         beginOfJob=false
      } else {
         outLine+='\f';
      }
   }
   // double line feed
   if (line[0]=='0') {
      outLine+='\n';
   }
   // overprint not supported by lpt2pdf
   if(line[0]=='+') {
      outLine+=' ';
   }
   // print line
   if(line.length > 1) {
      outLine+=line.substring(1);
   }
   outLine+='\n';
   if(status== Stat.Running) {
      child.stdin.write(outLine);
   } else {
      // we probably got a status change
      return(false);
   }
   // end of print job, terminate lpt2pdf
   if(eojCount==2) {
      eojCount=0;
      child.stdin.end();
      beginOfJob=true;
      status=Stat.stopping;
      console.log("end .......");
   }
   return(true);
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
   clearInterval(intervalObject);
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

// start interval timer
intervalObject=setInterval(() => {
   watchPrintFile();
},250);
console.log("start watching printer file:",printFile);

// write pid file
pidFile = fs.createWriteStream('pdf.pid');
pidFile.write(pid.toString());
pidFile.end();
