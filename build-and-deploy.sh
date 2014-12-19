#!/bin/bash

# Build and Deploy to GitHub. Warning, this force pushes!
LAST_COMMIT=$(git log -1 --format="%h")
TOPLEVEL=$(git rev-parse --show-toplevel)
GITHUBIO=$TOPLEVEL/../metasploit.github.io/

echo [*] About to build and force push whatever is in $LAST_COMMIT to gh-pages.

echo [*] --------------------------
echo [*] Git Status:
git status
echo [*] Git Log:
git log $LAST_COMMIT --oneline -1
echo [*]

echo [*] --------------------------
echo -n [*] Destination: &&
  cd $GITHUBIO
echo $PWD

echo [*] --------------------------
cd $TOPLEVEL/metasploit-resource-portal &&
  git checkout $LAST_COMMIT && # Be serious about committed changes
  git submodule foreach git fetch
  git submodule foreach git rebase --preserve-merges
  middleman build
echo [*] --------------------------

echo [*] Does this all look right?
echo [*] Hit [Y] to continue, anything else to quit.

read input
if [[ $input == "Y" || $input == "y" ]]; then
  echo '[*] Okay!'
else
  echo '[!] Phew, that was close!'
  git checkout master
  exit 1
fi

# Wipe local master branch and get the latest. Slightly less dangerous
# than git force pushing
cd $GITHUBIO
git checkout -b temp # May already exist, that's okay
git checkout temp &&
  git branch -D master &&
  git checkout -b master --track origin/master

# Delete Middleman build artifacts
rm -rf stylesheets/ images/ fonts/ javascripts/ &&
  # Individual pages
  rm *.html

# Get the fresh stuff.
cp -r $TOPLEVEL/metasploit-resource-portal/build/stylesheets/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/images/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/fonts/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/javascripts/ . &&
  cp -r $TOPLEVEL/metasploit-resource-portal/build/*.html . &&
  git add *.html stylesheets/ javascripts/ images/ fonts/ &&
  git status &&
  echo [*] Here we go...
  git commit -m "Update to $LAST_COMMIT from source" &&
  git push origin master

# End up on the master branch.

cd $TOPLEVEL &&
  git checkout master
