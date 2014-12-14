# Dashboard Stats Generator

<img src="http://www.quickmeme.com/img/1d/1d96fce4df6e1166499194ed199d00030cc0dfa1e79014a5310cc2ef7d71cbaa.jpg" />


## Basic Requirements
### Required Gems:
<br>
To install the required gems, run this on the command line
```sh
$ bundle install
```
### Optional
<b>Pry</b>
<br>
Pry can be used to test some of the objects the API returned. It can be installed by running this command:

```sh
$ gem install pry
```
and can be inserted in your code after the line of code you'd like to further inspect like so:

```ruby
def PrintStats(stats)
  # Time with respect to the epoch
  rdate = Time.new().to_i * 1000
  binding.pry
```

## Running the Generator
You can run generate_pages to run both the stats generator and generate the templates. This is done using using 'load':

```ruby
load 'stats_generator.rb'
```

This is necessary as the instance variables instantiated in stats_generator.rb are required for portions of generate_pages
### Authentication

Note that GitHub does have an API limit for requests. You should always set environment variables for your credentials rather than hardcoding them into the file. That way you don't end up like that silly intern who committed and pushed their Github username and password to the repo!

```ruby
# Provide authentication credentials
Octokit.configure do |c|
  c.login = 'defunkt'
  c.password = 'c0d3b4ssssss!'
end

# Fetch the current user
Octokit.user

```

### Generating Statistics

```sh
ruby stats_generator.rb
```

Running the stats_generator.rb file will output the number of:
-Pull Requests
-Open Issues
-Feature Requests
-Bugs
-Enhancements

It will also generate JSON files for each of the stats generated.

### Generating Webpages from a Template

From here, the web pages can be created using generate_pages as follows:
````sh
ruby generate_pages
```

This will create an HTML page for each of the statistics gathered in the stats generator. You can change the default template by using editing the template.erb file.

You can use ruby tags throughout the page to insert values from generate_pages as follows:

generate_pages
```ruby
  #badge is initialized here
  badge = ""

  #a lot of code inbetween ...

    # A loop that iterates through each stat, generating a list item for each stat and then appending it to the badge string
    weekly_stats.each do |stat, value|
      badge <<  "<li role=\"presentation\"><a href=\"#\">#{stat}<span class=\"badge\">#{value}</span></a></li>"
    end
```

template.erb
```html
<!-- Badge is then referenced here in the .erb file, placing the list items generated in the rb file as html code. MAGIC!-->
    <ul class="nav nav-pills" role="tablist">
      <%= badge %>
    </ul>
```


## Modifying the Stats Generator

Please refer to the [Octokit documentation](https://github.com/octokit/octokit.rb) for the specifics on using the API. Additionally, pry can be used to gain a better understanding of the available information the API provides.

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

Make sure that your new stats is then inserted into the stats data structure in ``` def GetStats ```:

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

## Coming soon...
