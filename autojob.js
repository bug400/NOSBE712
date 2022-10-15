#!/usr/bin/env node
/*
 * This script runs batch processes for DtCyber running NOS/BE.
 * (c) 2022 Joachim Siebold
 *
 * It relies on the DtCyber class which is provided with the DtCyber 
 * distribution (see https://github.com/kej715/DtCyber)
 *
 * If this program does not reside in a subdirectory of the DtCyber
 * distribution, the environment variable DTCYBER must be specified to
 * point to the distribution main directory.
 *
 * This script runs a series of batch processes which are specified in a
 * configuration file, which normally resides in the node_modules
 * subdirectory. See the file run_tests.js for details.
 *
 * The script runs the jobs defined in the configuration file one after
 * another. It first unloads all tapes, and mounts the tapes required
 * for the job. For unlabeled tapes a DSD VSNxx,vsn is issued. If
 * the job has a correspondig VSN card, then unlabled tapes can be
 * assigned automatically to the job without further operator intervention.
 *
 * 
 * There are some parameters in this software for the card reader
 * and the tape drives which must match the running NOS/BE
 * system. You can change them in the configurable section below.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 *
 */

/*
 * B E G I N of configurable section ------------------------------------------
 *
 * The definitions below must match the EST configuration of the running 
 * NOS/BE system
 *
 * EQ,UN of card reader
 */
const CardReader=[12,3];
/*
 * EST,EQ,CH,UN of magnetic tapes, at least three 9 Track 1600 cpi (PE) required
 * to run the NOS/BE build scripts
 */
const TapeUnits= [
 [20,13,0,0],
 [21,13,0,1],
 [22,13,0,2]
]
/*
 * File name of line printer
 */
const LinePrinterFile="LP5xx_C12_E5";

/*
 * E N D of configurable section ----------------------------------------------
 */

const fs            = require("fs");
var DtCyber;
if (process.env.DTCYBER) {
   DtCyber = require(process.env.DTCYBER.concat("/automation/DtCyber"));
} else {
   DtCyber = require("../automation/DtCyber");
}

const dtc = new DtCyber();

var configObject;

let fromId= 1;
let toId= 999;

/*
 * error function, prompt error and exit
 */
function error(err) {
  console.log(err);
  process.stdout.write("Press ENTER to terminate...");
  process.stdin.on("data", data => {
    process.exit(1);
  });
  process.stdin.on("close", () => {
    process.exit(1);
  });
}

/*
 * Send a command to dsd if command string not empty
 * cmd: dsd command string, may be empty
 *
 * returns a promise
 */
function sendDsd(cmd) {

  return new Promise((resolve, reject) => {
     if (cmd=="") {
        resolve();
     } else {
        dtc.dsd(cmd)
        .then(() => {
           resolve();
        })
        .catch(err =>  {
           reject(err);
        });
     }
  });
}

/*
 * Mount a tape
 *
 * tapeData   : The elements of tapeData are:
 *         [0]: tape file
 *         [1]: volume serial number, may be empty. Must match the VSN card
 *              in the job deck
 *         [2]: "w": write mode, mount with ring
 *              "r": read mode, mount without ring
 * mtUnit     :  Tape unit data
 * 
 *         In write mode, an already existing destination file is deleted
 *         If a VSN is specified, a VSN command is issued at the DSD
 *
 * returns a promise
 */
function mountTape(tapeData,mtUnit) {

  return new Promise((resolve, reject) => {
     var vsncmd;
     var ring;

     let est=mtUnit[0];
     let tapeFile=tapeData[0];
     let vsn=tapeData[1];
     let mode=tapeData[2];
     if (vsn=="") {
        vsncmd="";
     } else {
        vsncmd="[VSN"+est.toString()+vsn;
        if(vsn.length<6) {
           vsncmd=vsncmd+".";
        }
     }
     if(mode=="w") {
        if (fs.existsSync(tapeFile)) {
           fs.unlinkSync(tapeFile);
        }
        ring=true;
     } else {
        ring=false;
     }
     dtc.say(`mount tape ${tapeFile}`)
     .then(() => dtc.mount(mtUnit[1],mtUnit[2],mtUnit[3], tapeFile,ring))
     .then(() => dtc.sleep(15000))
     .then(() => sendDsd(vsncmd))
     .then(() => {
        resolve();
     })
     .catch(err =>  {
        reject(err);
     });
   });
}

/*
 * launches a job and waits for completion
 *
 * deckFile: job card deck file
 *
 * returns a promise
 *
 * NOTE: if configObject.stopOnJobError is False then always a resolved promise
 *       is returned
 * 
 */
function launchJob(deckFile) {

  return new Promise((resolve, reject) => {
     dtc.say(`run job ${deckFile}`)
     .then(() => dtc.runJob(CardReader[0],CardReader[1],deckFile))
     .then(() => dtc.say("job completed"))
     .then(() => {
       resolve();
     })
    .catch(err =>  {
       if (configObject.stopOnJobError) {
          reject(err);
       } else {
          dtc.say(err)
          .then(() => {
             resolve();
          });
       }
     });
  });
}

/*
 * Runs a job
 * - unmounts all tape drives 
 * - mount tapes requested by the job
 * - submit job card deck
 * 
 * jobData :  array with job specification
 *     [0] :  unique index
 *     [1] :  job description
 *     [2] :  path of the job deck
 *     [3] :  array with definition of up to three tapes
 *            see function mountTape
 *
 * returns a promise
 *
 */
function runJob(jobData) {

  idx=jobData[0];
  jobDescription=jobData[1];
  deckFile=jobData[2];
  tapeArray=jobData[3];
  return new Promise((resolve, reject) => {
     if(idx < fromId || idx > toId) { 
       resolve()
     } else {
        dtc.say(`${idx} job ${jobDescription} deck ${deckFile}`)
        .then(() => dtc.say("unmounting tapes"))
        .then(() => unmountTapes())
        .then(() => dtc.sleep(15000))
        .then(() => mountTapes(jobData))
        .then(() => launchJob(deckFile))
        .then(() => {
         resolve();
        })
       .catch(err =>  {
          reject(err);
        });
     }
  });
};
  
/*
 * Run the jobs one after another, which are defined in the job 
 * configuration array.
 *
 * configArray  : array of job configurations
 *
 * returns a promise
 */
function runJobs(configArray) {
   return new Promise((resolve,reject) => {
      var run = function(index) {
         if (index > configArray.length-1) {
            resolve();
         } else {
            runJob(configArray[index]).then(function() {
              run(index+1);
            }).catch(reject);
         }
      };
      run(0); 
   });
};
  
/*
 * Mount the tapes one after another, which are defined in the tapesArray
 * of the job data
 *
 * jobData  : job configuration 
 *
 * returns a promise
 */
function mountTapes(jobData) {
   tapeArray=jobData[3];
   return new Promise((resolve,reject) => {
      var mount = function(index) {
         if (index > tapeArray.length-1) {
            resolve();
         } else {
            mountTape(tapeArray[index],TapeUnits[index]).then(function() {
              mount(index+1);
            }).catch(reject);
         }
      };
      mount(0); 
   });
};

/*
 * Unmount all tapes which exist in the TapeUnits array
 *
 * returns a promise
 */
function unmountTapes() {
   return new Promise((resolve,reject) => {
      var unmount = function(index) {
         if (index > TapeUnits.length-1) {
            resolve();
         } else {
            dtc.unmount(TapeUnits[index][1],TapeUnits[index][2],TapeUnits[index][3]).then(function() {
              unmount(index+1);
            }).catch(reject);
         }
      };
      unmount(0); 
   });
};

/*
 * Check the configuration
 * configArray : configuration array of build jobs
 *
 * returns nothing, terminates if any error was encountered
 */
function check(configArray) {

   let error=false;
   for(let i=0;i<configArray.length;i++) {
      let jobData=configArray[i];
      let jobDescription=jobData[1];
      let deckFile=jobData[2];
      if (! fs.existsSync(deckFile)) {
         console.log(`job ${jobDescription}: deck ${deckFile} does not exist`);
         error=true;
      }
      tapeArray=jobData[3];
      for(let j=0;j<tapeArray.length;j++) {
         let tapeData=tapeArray[j];
         let tapeFile=tapeData[0];
         let vsn=tapeData[1];
         let mode=tapeData[2];
         if(!(mode=="w" || mode=="r")) {
            console.log(`job ${jobDescription}: mode ${mode} not allowed`);
            error=true;
         }
         if(mode=="r") {
            if (! fs.existsSync(tapeFile)) {
               console.log(`job ${jobDescription}: tape image ${tapeFile} does not exist`);
               error=true;
            }
         } else {
            try {
                if (! fs.existsSync(tapeFile)) {
                    fs.writeFileSync(tapeFile,'Test');
                    fs.unlinkSync(tapeFile);
                }
            } catch(err) {
                console.log(`job ${jobDescription}: cannot write to tape image ${tapeFile}`);
                error=true;
            }
         }
      }
   }
   if(error) {
      process.exit(1);
   }
}

function usage() {
   console.log("");
   console.log("Usage: node autojob.js configFile.js [from id] [to id]");
   console.log("       configFile must reside in the node_modules subdirectory");
   console.log("       or you must specify an absolute or relative path for that file");
   console.log("       [from id] and [to id] specify an optional index range of jobs,");
   console.log("       that shall be executed.");

   process.exit(1);
}
/*
 * main program, get and check positional program parameters
 */

for(let i=2;i<= process.argv.length-1;i++) {
   switch(i) {
   case 2:
      configObject=require(process.argv[2])
      break;
   case 3:
      fromId=parseInt(process.argv[3]);
      toId=fromId;
      break;
   case 4:
      toId=parseInt(process.argv[4]);
      break;
   default:
      console.log("Illegal number of parameters");
      usage();
   }
}
if(isNaN(fromId) || isNaN(toId)) {
      console.log("Illegal number(s) in id parameter(s)");
      usage();
}

if (toId < fromId) {
   console.log("Illegal id interval");
   usage();
}

/*
 * verify configuration data
 */
check(configObject.config);

let promise=Promise.resolve();
promise = promise 
 .then(() => dtc.connect())
 .then(() => dtc.expect([ {re:/Operator> $/} ]))
 .then(() => dtc.say("Connected to DtCyber"))
 .then(() => dtc.attachPrinter(LinePrinterFile))
 .then(() => runJobs(configObject.config))
 .then(() => {
    process.exit(0)
  })
 .catch(err => { error(err)
  } );

