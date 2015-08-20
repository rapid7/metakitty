#!/bin/bash

# Build and Deploy to GitHub. Warning, this force pushes!
LAST_COMMIT=$(git log -1 --format="%h")
TOPLEVEL=$(git rev-parse --show-toplevel)
GITHUBIO=$TOPLEVEL/../metasploit.github.io/
echo [*] Ensuring we have the current gems...
cd $TOPLEVEL
bundle install
cd $TOPLEVEL/metasploit-resource-portal
bundle install
cd $TOPLEVEL
git submodule init
git submodule update --remote

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
  middleman build
echo [*] --------------------------

echo [*] --------------------------
echo [*] Generating community stats:
cd $TOPLEVEL/stats && ./generate_pages
cp -a $TOPLEVEL/stats/*.html $TOPLEVEL/stats/assets $TOPLEVEL/metasploit-resource-portal/build
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
rm -rf assets/ stylesheets/ images/ fonts/ javascripts/ &&
  # Individual pages
  rm *.html

# Get the fresh stuff.
cp -a $TOPLEVEL/metasploit-resource-portal/build/stylesheets . &&
  cp -a $TOPLEVEL/metasploit-resource-portal/build/assets . &&
  cp -a $TOPLEVEL/metasploit-resource-portal/build/images . &&
  cp -a $TOPLEVEL/metasploit-resource-portal/build/fonts . &&
  cp -a $TOPLEVEL/metasploit-resource-portal/build/javascripts . &&
  cp -a $TOPLEVEL/metasploit-resource-portal/build/*.html . &&
  git add *.html assets stylesheets javascripts images fonts &&
  git status &&
  echo [*] Here we go...
  git commit -m "Update to $LAST_COMMIT from source" &&
  git push origin master

# Go back to the master branch and remind the user to update
# if there's any changes.

cd $TOPLEVEL &&
  git checkout master
  echo [*] If you have any changes to resource-portal-data, be a doll
  echo [*] and commit the updated Submodule pointer.
  echo [*] Let\'s check:
  git status

