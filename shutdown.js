#!/usr/bin/env node
/*
 * This script shuts down a DtCyber instance running NOS/BE.
 * (c) 2022 Joachim Siebold
 *
 * It is a little modification of the original shutdown script for NOS2.8.7
 * and relies on the DtCyber class which is provided with the DtCyber
 * distribution (see https://github.com/kej715/DtCyber)
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

dtc.connect()
.then(() => dtc.expect([ {re:/Operator> $/} ]))
.then(() => dtc.say("Connected to DtCyber"))
.then(() => dtc.dsd("[INTERCOM,DR"))
.then(() => dtc.dsd("[1.DR"))
.then(() => dtc.dsd("[UNLOCK."))
.then(() => dtc.dsd("CHECK#2000#"))
.then(() => dtc.sleep(4000))
.then(() => dtc.dsd("STEP."))
.then(() => dtc.sleep(2000))
.then(() => dtc.send("shutdown"))
.then(() => dtc.expect([{ re: /Goodbye for now/ }]))
.then(() => dtc.say("Shutdown complete"))
.then(() => {
  process.exit(0);
})
.catch(err => {
  console.log(err);
  process.exit(1);
});
