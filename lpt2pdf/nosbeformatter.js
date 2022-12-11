/*
 This program is used as a DtCyber helper process to seperate the
 NOSB/BE 1.5 printer output into separate printer job files in pdf format.
 (c) Joachim Siebold 2022

 The executable of the lpt2pdf program is expected in the lpt2pdf
 subdirectory.

 nosbeformatter must be called with the following required parameters:
 -p        DtCyber printer file
 -s        subdirectory for the PDF files

Optional parameters: 

 -o        lpt2pdf parameters (which must be enclosed in "")
 -l        lines per page (default: 60)

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
const TimerValue=500;

/*
 * command line parameter data
 */
var optInd=2;
var printFile="";
var optionString="";
var spoolDir="";
var linesPerPage=60;

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
 * ANSI function codes (3256 controller)
 */
const PrintDefault  = ' ';
const PrintSingle   = '0';
const PrintDouble   = '-';
const PrintLastLine = 'C';
const PrintEject    = '1';
const PrintAutoEject= 'R';
const PrintNoSpace  = '+';


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
var lineCount;                        // line counter on page
var pageCount;                        // page count
var eventRunning=false;


/*
 * The print file watch event handler is called every 500ms
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

   
   if(eventRunning)return;
   eventRunning=true;
   // take the next bus, if subprocess is starting or terminating
   if((status != Stat.Stopped) && (status != Stat.Running)) return;

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

            // prevent overflow of  buffer, if there are more bytes to read
            // then they must be processed in the next schedule of this function
            requiredBufferSize=curr.size-position;
            if(requiredBufferSize>BufferSize) requiredBufferSize= BufferSize;
            bytesRead=fs.readSync(printFileDesc,buffer,0,requiredBufferSize,position);
            for(var i=0;i< bytesRead; i++) {
               // build line from buffer data
               if (buffer[i]==10) {
                  if(processLine(line)) {
                     position+=1;
                     line='';
                     // processLine terminated the subprocess, bail out
                     if(status== Stat.Stopping) {
                        eventRunning=false;
                        return;
                     }
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
   });
   eventRunning=false;
   return;
}

// start PDF converter subprocess
function startSubProcess() {

   // init job vars
   pageCount=0;
   lineCount=0;
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
   status=Stat.Starting;

   // the subprocess is completely shut down if this event was fired
   // and status was set to Stat.Stopped
   child.on('close',(code,signal) => {
      status=Stat.Stopped;
      console.log(`child process terminated with exit code ${code} and signal ${signal}`);
      if( code !=0) {
         process.exit(code);
      }
   });

   // the subprocess is up and running, if this event was fired and status
   // was set to Stat.Running.
   child.on('spawn',function()  {
      status=Stat.Running;
      console.log(`spawned ${exeFile} ${opts}`);
   });

   child.on('error',(err) => {
      console.log(`subprocess error ${err}`);
      process.exit(1);
   });
}

/*
 * process line function, parse and execute the ANSI function codes
 */
function processLine(line) {
var outLine;

   if(line.length==0) {
      return(true);
   }
   // check for end of print job
   if(line.includes(' //// END OF LIST ////  ')) {
      eojCount+=1;
   }
   switch(line[0]) {

       case PrintDefault:
        // "normal" line
        outLine='\n';
        lineCount+=1;
        break;

      case PrintEject:
         // do form feed, but only if we are not at the beginning 
         // of a print job
         pageCount+=1;
         lineCount=1;
         if(beginOfJob) {
            beginOfJob=false
            outLine='';
         } else {
            outLine='\f';
         }
         break;

      case PrintSingle:
        // space two lines
        outLine='\n\n';
        lineCount+=2;
        break;

      case PrintDouble:
        // space three lines
        outLine='\n\n';
        // this is a very dirty hack because JANUS outputs the banner page with
        // 8lpi even if NOS/BE is configured to 6lpi. Thus we steal a blank line
        // if we are on the first two pages of the print job
        lineCount+=2;
        if(pageCount>2) {
           outLine+='\n';
           lineCount+=1;
        }
        break;

      case PrintLastLine:
        // advance to last line of the page
        outLine='';
        for(var i=0;i<(linesPerPage-lineCount);i++) {
           outLine+='\n';
        }
        break;

      case PrintNoSpace:
        // overprinting: no lf, send only a cr
        outLine='\r';
        break;

      default:
        // all other: do not output anything
        return(true);
   }
   // append line data, if any
   if(line.length > 1) {
      outLine+=line.substring(1);
   }
   // append final "\n", if end of job
   if(eojCount==2) {
      outLine+='\n';
   }
   // output line to pdf converter child process
   child.stdin.write(outLine);
   // end of print job, terminate lpt2pdf
   if(eojCount==2) {
      eojCount=0;
      child.stdin.end();
      beginOfJob=true;
      status=Stat.Stopping;
      console.log("end .......");
   }
   return(true);
}

// print script usage and exit
function printUsage() {
   console.log('Usage: pdfwatcher -p <printer file> -s <spool dir> [-o "lpt2pdf options"] -l [lines per page (default:60)');
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
   } else if (process.argv[optInd] === "-l") {
      linesPerPage= Number(process.argv[optInd+1]);
      if (isNaN(linesPerPage)) {
         printUsage();
      }
      optInd+=2;
   } else {
      printUsage();
   }
}

// check parameters
if ( printFile ==="" ) printUsage();
if ( spoolDir ==="" ) printUsage();
if ( ! fs.existsSync(spoolDir)) {
   console.log(`spool directory ${spoolDir} does not exist`);
   process.exit(1);
}
if (linesPerPage < 40 || linesPerPage> 80) {
   console.log(`invalid value ${linesPerPage} for lines per page`);
   process.exit(1);
}
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
},TimerValue);
console.log("start watching printer file:",printFile);

// write pid file
pidFile = fs.createWriteStream('pdf.pid');
pidFile.write(pid.toString());
pidFile.end();
