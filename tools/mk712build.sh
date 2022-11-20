#!/bin/bash
# create zip file for a ready to run NOS/BE L712 build system
PWD=`pwd`
if [ `basename ${PWD}` != "NOSBE712" ] ; then
   echo "Script must be called in the NOSBE712 directory"
   exit 1
fi
rm -f ../nosbe712build.zip
zip -r ../nosbe712build.zip DeadstartTapes/DSTAPE_BUILDSYS.tap disks/build/DQ* persistence/build/*Sto*
