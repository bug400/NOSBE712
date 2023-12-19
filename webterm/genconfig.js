#!/usr/bin/env node
/*
 * Generate json config file for webterm
 * (c) 2023 Joachim Siebold
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
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 *
 */
var replacement;
if (process.env.DTCYBER) {
   replacement=process.env.DTCYBER.replaceAll('\\','/');
} else {
   replacement='../..'
}

var fs = require('fs')
fs.readFile(process.argv[2], 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/REPLACEME/g, replacement);

  fs.writeFile(process.argv[3], result, 'utf8', function (err) {
     if (err) return console.log(err);
  });
});

