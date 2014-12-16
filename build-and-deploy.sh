#!/bin/bash

# Build and Deploy to GitHub. Warning, this force pushes!
LAST_COMMIT=$(git log -1 --format="%h")
TOPLEVEL=$(git rev-parse --show-toplevel)
FRAMEWORK=$TOPLEVEL/../metasploit-framework/

echo [*] About to build and force push whatever is in $LAST_COMMIT to gh-pages.

echo [*] --------------------------
echo [*] Git Status:
git status
echo [*] Git Log:
git log $LAST_COMMIT --oneline -1
echo [*]

echo [*] --------------------------
echo -n [*] Destination: &&
  cd $FRAMEWORK
echo $PWD

echo [*] --------------------------
cd $TOPLEVEL/metasploit-resource-portal
middleman build
echo [*] --------------------------

echo [*] Does this all look right?
echo [*] Hit [Y] to continue, anything else to quit.

read input
if [[ $input == "Y" || $input == "y" ]]; then
  echo '[*] Okay!'
else
  echo '[!] Phew, that was close!'
  exit 1
fi

# Wipe local gh-pages, get the latest.
cd $FRAMEWORK
git checkout master &&
  git branch -D gh-pages &&
  git checkout -b gh-pages --track upstream/gh-pages

# Delete Middleman build artifacts
rm -rf stylesheets/ images/ fonts/ javascripts/
rm index.html

# Get the fresh stuff.
cp -r $TOPLEVEL/metasploit-resource-portal/build/stylesheets/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/images/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/fonts/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/javascripts/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/*.html . &&
  git add *.html stylesheets/ javascripts/ images/ fonts/ &&
  git status &&
  echo [*] Here we go...
  git commit -m "Update to $LAST_COMMIT" &&
  git push upstream gh-pages --force

echo [*] Finished!
exit 0
