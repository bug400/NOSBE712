#!/bin/bash
# create zip file for ready to run NOS/BE 712 production system with
# extended memory
PWD=`pwd`
if [ `basename ${PWD}` != "NOSBE712" ] ; then
   echo "Script must be called in the NOSBE712 directory"
   exit 1
fi
rm -f ../nosbe712prod_em.zip
zip -r ../nosbe712prod_em.zip DeadstartTapes/DSTAPE_EM.tap disks/nosbe_em/DQ* persistence/nosbe_em/*Sto* scratch/DUMPF_EM.tap
