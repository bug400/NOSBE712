#!/bin/bash
# create zip file for a ready to run NOS/BE 712 production system without
# extended memory
PWD=`pwd`
if [ `basename ${PWD}` != "NOSBE712" ] ; then
   echo "Script must be called in the NOSBE712 directory"
   exit 1
fi
rm -f ../nosbe712nosbe.zip
zip -r ../nosbe712nosbe.zip DeadstartTapes/DSTAPE.tap disks/nosbe/DQ* persistence/nosbe/*Sto*
