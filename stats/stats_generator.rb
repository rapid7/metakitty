require 'octokit'
require 'date'
require 'json'

# For testing purposes, pry is included
require 'pry'

def retrieve_stats
  last_month = DateTime.now - 30
  last_month = last_month.strftime('%F')

  # Check authentication credentials
  if !ENV.has_key?('GITHUB_USERNAME')
    puts "A GITHUB_USERNAME environment variable must be set to get stats."
    exit 1
  end

  do_pw = ENV.has_key?('GITHUB_PASSWORD')
  do_oauth = ENV.has_key?('GITHUB_OAUTH_TOKEN')

  # Provide authentication credentials
  if do_pw
    client = Octokit::Client.new \
      :login => ENV['GITHUB_USERNAME'],
      :password => ENV['GITHUB_PASSWORD']
  elsif do_oauth
    client = Octokit::Client.new \
      :access_token => ENV['GITHUB_OAUTH_TOKEN']
  else
    puts "An authentication method environment variable must be set"
    puts "Please set GITHUB_OAUTH_TOKEN or GITHUB_PASSWORD"
    exit 1
  end

  # Fetch the current user
  client.user
  puts "Authenticated as #{ENV['GITHUB_USERNAME']}"
  client.auto_paginate = true

  commits = client.commits_since('rapid7/metasploit-framework', last_month)
  @commits = commits

  issues = client.issues 'rapid7/metasploit-framework'
  @issues = issues

  closed_bugs = client.list_issues("rapid7/metasploit-framework", {
    :labels => 'bug',
    :state  => 'closed'
  })
  @closed_bugs = closed_bugs

  puts 'Getting open pull requests...'
  pulls = client.pull_requests('rapid7/metasploit-framework',
    { :state => 'open' })
  open_pulls = pulls.length.to_i
  num_issues = issues.length.to_i
  @pulls = pulls

  puts 'Getting open bugs...'
  bugs = client.list_issues('rapid7/metasploit-framework', {
    :labels => 'bug',
    :state  => 'open'
  })

  num_bugs = bugs.length.to_i
  @bugs = bugs

  puts 'Getting open enhancement tickets...'
  enhancements = client.list_issues('rapid7/metasploit-framework', {
    :labels => 'enhancement',
    :state  => 'closed'
  })
  num_enhancements = enhancements.length.to_i
  @enhancements = enhancements

  puts 'Getting open feature requests...'
  features = client.list_issues('rapid7/metasploit-framework', {
    :labels => 'feature',
    :state  => 'closed'
  })
  @features = features

  num_features = features.length.to_i
  open_issues = num_issues - open_pulls

  puts 'Making a nice hash...'

  stats =
  {
    'pull_requests' => open_pulls,
    'enhancements'  => num_enhancements,
    'open_issues'   => open_issues,
    'features'      => num_features,
    'bugs'          => num_bugs,
  }
  @stats = stats
  puts '***********************'
  stats.each do |x, y|
    puts "#{x}: #{y}"
  end
  puts '***********************'
  stats
end

# ON THE FLY
def weekly_stats
  last_week = Time.now - 604800

  weekly_bugs = []
  @bugs.each do |bug|
    date = bug[:created_at]
    if date > last_week
      weekly_bugs << [
        "Ticket \##{bug[:number]}", bug[:html_url],
        "Opened on #{date}",
        "Reported by #{bug[:user][:login]}", bug[:title]
      ]
    end
  end
  total_bugs = weekly_bugs.length

  weekly_features = []
  @features.each do |feature|
    date = feature[:created_at]
    if date > last_week
      weekly_features << [
        "Ticket \##{feature[:number]}", feature[:html_url],
        "Opened on #{date}",
        "Requested by #{feature[:user][:login]}", feature[:title]
      ]
    end
  end
  total_features = weekly_features.length

  weekly_enhancements = []
  @enhancements.each do |enhancement|
    date = enhancement[:created_at]
    if date > last_week
      weekly_enhancements << [
        "Ticket \##{enhancement[:number]}", enhancement[:html_url],
        "Opened on #{date}",
        "Requested by #{enhancement[:user][:login]}", enhancement[:title]
      ]
    end
  end

  weekly_issues = []
  @issues.each do |issue|
    date = issue[:created_at]
    if date > last_week
      weekly_issues << [
        "Issue \##{issue[:number]}", issue[:html_url],
        "Opened on #{date}",
        "Created by #{issue[:user][:login]}", issue[:title]
      ]
    end
  end

  weekly_pulls = []
  @pulls.each do |pull|
    date = pull[:created_at]
    if date > last_week
      weekly_pulls << [
        "PR \##{pull[:number]}", pull[:html_url],
        "Opened on #{date}",
        "Created by #{pull[:user][:login]}", pull[:title]
      ]
    end
  end

  weekly_values ={
    'NewPullRequests' => weekly_pulls.length,
    'NewEnhancements' => weekly_enhancements.length,
    'NewIssues'       => weekly_issues.length,
    'NewFeatures'     => weekly_features.length,
    'NewBugs'         => weekly_bugs.length
  }

  weekly_stats = {
    'NewPullRequests' => weekly_pulls,
    'NewEnhancements' => weekly_enhancements,
    'NewIssues'       => weekly_issues,
    'NewFeatures'     => weekly_features,
    'NewBugs'         => weekly_bugs
  }

  weekly_stats.each do |name, stat|
    puts "#{name}: #{stat.length}"
  end

  @weekly_stats = weekly_stats
  @weekly_values = weekly_values
end

## ON THE FLY
def top_committers
  monthly_commits = []
  @commits.each do |commit|
    username = commit[:commit][:author][:name]
    monthly_commits << "#{username}"
  end
  freq = monthly_commits.inject(Hash.new(0)) { |h, v| h[v] += 1; h }
  committers_list = freq.sort_by { |_k, v| v }.reverse.to_h
  committers_list.each do |name, value|
    puts "#{name}: #{value} commits"
  end
  @committers_list = committers_list
end

def merge_stats(stats)
  rdate = Time.new.to_i * 1000
  new_stat = [rdate, stats]
  if File.exist?('stats.json')
    puts 'Reading the stats file...'
    stats = JSON.parse(File.read('stats.json'))
  else
    puts 'Creating a new stat file...'
    stats = []
  end
  puts 'Writing new stats to file...'
  stats << new_stat
  File.write('stats.json', JSON.generate(stats))
  puts "Stats added: #{new_stat}"
end

stats = retrieve_stats
merge_stats(stats)
weekly_stats
top_committers
