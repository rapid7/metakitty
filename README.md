metakitty
=========

Metakitty -- The Metasploit Stats Portal. This is a staging area to
actually get this stuff up and running without accidentally stomping all
over metasploit-framework.

Previously the meatkitty repository was used to generate Metasploit resources  links ([final commit](https://github.com/rapid7/metakitty/tree/a42d767ec24aa688737617bfaea00577b16bb4d4)), but this functionality is now removed and deprecated in favor of the Metasploit Wiki. Now only the stats extraction mechanism exists, and is published to:

https://docs.metasploit.com/stats

## Managing Git and Updates

Install Ruby dependencies:

```
bundle install
```

Build the stats, further details can be found in the [README.md](./stats/README.md):

```
export GITHUB_OAUTH_TOKEN=your_token_here
bundle exec ruby stats/generate_pages
bundle exec ruby stats/download_acceptance_test_results.rb
```

If you want to see the stats locally, run:

```
bundle exec ruby -run -e httpd . -p8000
```

And visit http://localhost:8000/stats/build/

Ta-da!
