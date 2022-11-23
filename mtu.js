#!/usr/bin/env node
/*
 * Unmount tape
 * (c) 2022 Joachim Siebold
 *
 * Usage:
 * mtu.js EST-Ordinal
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

var DtTools=require("DtTools");
const dt = new DtTools.myDtCyber();

if (process.argv.length !=3) {
   console.log('Usage: node mtu.js EST-Ordinal');
   console.log('Unload tape on drive "EST-Ordinal"');
   process.exit(1);
}
dt.connect()
.then(() => dt.expect([ {re:/Operator> $/} ]))
.then(() => dt.say("Connected to DtCyber"))
.then(() => dt.unMountTape(process.argv[2]))
.then(() => { process.exit(0); })
.catch(err => { dt.error(err) });

