#!/usr/bin/env node
/*
 * Submit one or more card decks to DtCyber
 * (c) 2022 Joachim Siebold
 *
 * Usage:
 * submit.js Deckfile1 [Deckfile2] ..[DeckfileN]
 * 
 * If this program does not reside in a subdirectory of the DtCyber
 * distribution, the environment variable DTCYBER must be specified to
 * point to the distribution main directory.
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

var DtCyber;
if (process.env.DTCYBER) {
   DtCyber = require(process.env.DTCYBER.concat("/automation/DtCyber"));
} else {
   DtCyber = require("../automation/DtCyber");
}


const dtc = new DtCyber();

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
  })
}
if (process.argv.length < 3) {
   console.log("Usage: node submit.js deckFile1 deckFile2 ... deckFileN");
   process.exit(1);
}

/*
 * Submit card deck files one after another
 *
 * returns a promise
 */
function submitFiles() {
   return new Promise((resolve,reject) => {
      var submit = function(index) {
         if (index > process.argv.length-1) {
            resolve();
         } else {
            dtc.loadJob(12,3,process.argv[index]).then(function() {
              submit(index+1);
            }).catch(reject);
         }
      };
      submit(2);
   });
};


dtc.connect()
.then(() => dtc.expect([ {re:/Operator> $/} ]))
.then(() => submitFiles())
.then(() => {
  process.exit(0);
})
.catch(err => {
  console.log(err);
  process.exit(1);
});
