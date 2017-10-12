require 'octokit'
require 'date'
require 'json'

load 'issue.rb'

class IssueStats
  def initialize(token, projects)
    @projects = projects
    @client = Octokit::Client.new(access_token: token) if token
    @client.auto_paginate = true
    @issues = []

    file_name = "cache.json"

    if File.exist?(file_name) && ((Time.now - File.stat(file_name).mtime).to_i < 21500)
      $stderr.puts("Using cached issues in #{file_name}")
      JSON.parse(File.read(file_name)).each do |i|
        @issues << Issue.from_json_hash(i)
      end
    else
      @projects.each do |project|
        $stderr.puts project
        (
          @client.issues(project, state: 'open') + @client.issues(project, state: 'closed')
        ).each do |i|
          @issues << Issue.from_ghissue(i, project)
        end
      end
      File.write(file_name, @issues.to_json)
    end
    nil
  end

  def to_s
    @projects
  end

  def open_things_on(date, pull_request = false, labels=[], reporter=nil)
    @issues.select do |issue|
      (labels.length == 0 || (labels - issue.labels).length < labels.length) &&
      issue.pull_request == pull_request &&
        ((issue.closed_at.nil? && issue.created_at <= date) ||
         (issue.created_at <= date && issue.closed_at >= date)) &&
         (reporter.nil? || issue.reporter =~ /#{reporter}/)
    end
  end

  def open_issues_on(date, labels=[])
    open_things_on(date, false, labels)
  end

  def open_prs_on(date, labels=[])
    open_things_on(date, true, labels)
  end

  def new_things_between(start_date, end_date, pull_request = false, labels=[], reporter=nil)
    @issues.select do |issue|
      (labels.length == 0 || (labels - issue.labels).length < labels.length) &&
      issue.pull_request == pull_request &&
         (issue.created_at >= start_date && issue.created_at <= end_date) &&
         (reporter.nil? || issue.reporter =~ /#{reporter}/)
    end
  end

  def new_issues_between(start_date, end_date, labels=[], reporter=nil)
    new_things_between(start_date, end_date, false, labels, reporter)
  end

  def new_prs_between(start_date, end_date, labels=[], reporter=nil)
    new_things_between(start_date, end_date, true, labels, reporter)
  end

  def closed_things_between(start_date, end_date, pull_request = false, labels=[], reporter=nil)
    @issues.select do |issue|
      (labels.length == 0 || (labels - issue.labels).length < labels.length) &&
      issue.pull_request == pull_request &&
         (!issue.closed_at.nil? && issue.closed_at >= start_date && issue.closed_at <= end_date) &&
         (reporter.nil? || issue.reporter =~ /#{reporter}/)
    end
  end

  def closed_issues_between(start_date, end_date, labels=[])
    closed_things_between(start_date, end_date, false, labels)
  end

  def closed_prs_between(start_date, end_date, labels=[])
    closed_things_between(start_date, end_date, true, labels)
  end

  def top_committers(date)
    commits = []
    @projects.each do |project|
      commits.concat @client.commits_since(project, date)
    end
    committers = {}
    committers.default = 0
    commits.each do |commit|
      committers[commit[:commit][:author][:name]] += 1
    end
    committers.sort_by { |k, v| v }.reverse.to_h
  end

  def commits_modules_json
    @client.commits_since('rapid7/metasploit-framework', DateTime.now - 30, {path: 'modules'}).
      select{|pr|pr[:commit][:message].include?('Land #')}.
        map{|pr|
          {
            message: pr[:commit][:message],
            author: pr[:author].to_h,
            html_url: pr.html_url,
            date: pr[:commit][:author][:date].strftime("%b %d, %Y")
          }
        }.first(6)
  end

  def commits_merged_json
    commits_merged = closed_prs_between(DateTime.now - 30, DateTime.now).first(6).each do |pr|
      pr.labels = pr.labels.map{|l|{name: l}}
      pr.html_url = @client.issue(pr.project, pr.number).html_url
    end
    commits_merged
  end

  def contributor_id(contributor)
    contributor[:login] || contributor[:name] || contributor[:email]
  end

  def contributors_month_json
    commits = []
    @projects.each do |project|
      commits.concat @client.commits_since(project, DateTime.now - 30)
    end
    committers = {}
    committers.default = 0
    commits.each do |commit|
      if !commit.author.nil?
        committers[commit.author.login] += 1
      else
        puts commit
      end
    end
    puts committers
    top_20_contributor_infos(committers)
  end

  def contributors_all_json
    contributors = []
    @projects.each do |project|
      contributors.concat @client.contribs(project, true)
    end
    contributor_counts = {}
    contributor_counts.default = 0
    contributors.each do |contributor|
      id = contributor_id(contributor)
      contributor_counts[id] += contributor[:contributions]
    end
    top_20_contributor_infos(contributor_counts)
  end

  def top_20_contributor_infos(contributor_counts)
    top_20_contributors = contributor_counts.sort_by { |k, v| v }.reverse.to_h
    top_20_contributor_infos = []
    num_found = 0
    top_20_contributors.each do |contributor|
      login = contributor[0]
      contributions = contributor[1]
      begin
        user = @client.user(login)
        user[:contributions] = contributions
        top_20_contributor_infos << user.to_h
        num_found += 1
        break if num_found >= 20
      rescue
      end
    end
    top_20_contributor_infos
  end

  def issues_newbie_json
    newb_issues = open_issues_on(DateTime.now, ['newbie-friendly']).first(10).each do |issue|
      issue.labels = issue.labels.map{|l|{name: l}}
      issue.html_url = @client.issue(issue.project, issue.number).html_url
    end
    newb_issues
  end
end
