# Dashboard Stats Generator

<img src="http://www.quickmeme.com/img/1d/1d96fce4df6e1166499194ed199d00030cc0dfa1e79014a5310cc2ef7d71cbaa.jpg" />

## Basic Requirements

### Required Gems:

To install the required gems, run this on the command line

```sh
$ bundle install
```

You can also use the `pry` library to enter an interactive debugging environment after the line of code you'd like to further inspect like so:

```ruby
def PrintStats(stats)
  # Time with respect to the epoch
  rdate = Time.new().to_i * 1000
  require 'pry'; binding.pry
```

### Generating Statistics

The stats generator can be run with:

```sh
./stats_generator
```
This will create an HTML page for each of the statistics gathered in the stats generator. You can change the default template by using editing the `template.erb` file.

Running the `stats_generator` will output the number of:
-Pull Requests
-Open Issues
-Feature Requests
-Bugs
-Enhancements

It will also generate JSON files for each of the stats generated. Results can be found in the `build` directory.

### Updating the template

You can use ruby tags throughout the page to insert values from generate_pages as follows:

`generate_pages`:

```ruby
  #badge is initialized here
  badge = ""

  #a lot of code inbetween ...

    # A loop that iterates through each stat, generating a list item for each stat and then appending it to the badge string
    weekly_stats.each do |stat, value|
      badge <<  "<li role=\"presentation\"><a href=\"#\">#{stat}<span class=\"badge\">#{value}</span></a></li>"
    end
```

`template.erb`:

```html
<!-- Badge is then referenced here in the .erb file, placing the list items generated in the rb file as html code. MAGIC!-->
    <ul class="nav nav-pills" role="tablist">
      <%= badge %>
    </ul>
```

## Modifying the Stats Generator

Please refer to the [Octokit documentation](https://github.com/octokit/octokit.rb) for the specifics on using the API. Additionally, `pry` can be used to gain a better understanding of the available information the API provides.

The basic structure for a query is simple.
```ruby
# "Enhancement" is just a variable name.
#
# "Octokit.list_issues" is an API command that is used to retrive all the issues from the repository.
#
# It takes two arguments, the "owner/repo" as a string, then a hash to filter out any parameters. For
# enhancements, we are looking for a :label and a :state, which tells us of any open issues labeled as
# enhancements

  enhancement = Octokit.list_issues("rapid7/metasploit-framework", {
    :labels => 'enhancement',
    :state  => 'open'
  })
```

Make sure that your new stats is then inserted into the stats data structure in `def GetStats`:

```ruby
# Formatting for each of the strings as an array
  stats = {
    'SOME_STAT'     => some_stats,
    'pull_requests' => open_pulls,
    'enhancements'  => num_enhancements,
    'open_issues'   => open_issues,
    'features'      => num_features,
    'bugs'          => num_bugs,
  }
```

File generation is automatically handled by the rest of the code! :+1:
