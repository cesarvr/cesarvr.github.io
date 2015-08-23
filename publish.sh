#!/bin/bash
date=`date +"%F %T"`

git add .
git commit -m "$date"
git push origin master
