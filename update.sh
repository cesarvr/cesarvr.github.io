#!/bin/bash

if [ -z "$1" ] ; then
  echo "Need a branch"
else 
  git add ./static
  git commit -m 'updating the blog entry'
  git push origin $1
fi
