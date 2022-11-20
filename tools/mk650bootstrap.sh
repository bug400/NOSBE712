#!/bin/bash
# create zip file for a ready to run NOS/BE L650 bootstrap system
PWD=`pwd`
if [ `basename ${PWD}` != "NOSBE712" ] ; then
   echo "Script must be called in the NOSBE712 directory"
   exit 1
fi
rm -f ../bootstrap650bootstrap.zip
zip -r ../bootstrap650bootstrap.zip DeadstartTapes/DSTAPE.tap disks/bootstrap/DQ* persistence/bootstrap/*Sto*
