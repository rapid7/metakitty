metakitty
=========

Metakitty -- The Metasploit Resource Portal. This is a staging area to
actually get this stuff up and running without accidentally stomping all
over metasploit-framework.

This repo will not disappear as previously threatened. We'll keep the
staging area private for now, and publish to:

http://resources.metasploit.com

## Managing Git and Updates

Metakitty is actually three repos:

- rapid7/metakitty - this repo
- metasploit/metasploit.github.io - where things are published on the Internet as http://resources.metasploit.com
- metasploit/metasploit-resource-data - user submissions and all the data that's relevant to Metakitty

You'll want to check out all three, side by side, if you're going to work on Metakitty at all.

Once that's done, you need to be sure to get the submodule for `metasploit-resource-data` up to date:

  cd metakitty
  git submodule init & git submodule update --remote

When you've landed something new to `metaspoit-resource-data` do this to publish:

  cd metakitty
  ./build-and-deploy.sh

That should be it!

## Adding Content

The public repo for contributor content is over at

https://github.com/metasploit/resource-portal-data

which is submoduled here as `resource-portal-data`.

If you would like to add an entirely new category, that's fine, but be
sure to update `source/index.html.erb` with the name, and note that the
filename must match the symbol in the current regime.
