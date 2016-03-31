require 'octokit'
require 'date'
require 'json'

class IssueStats
  def initialize(token, projects)
    @projects = projects
    @client = Octokit::Client.new access_token: token
    @client.auto_paginate = true
    @issues = []

    file_name = "cache.json"

    if File.exist?(file_name) && ((Time.now - File.stat(file_name).mtime).to_i < 21500)
      JSON.parse(File.read(file_name)).each do |i|
        @issues << {
          number: i['number'],
          url: i['url'],
          state: i['state'],
          title: i['title'],
          labels: i['labels'],
          reporter: i['reporter'],
          project: i['project'],
          pull_request: i['pull_request'],
          created_at: str_to_datetime(i['created_at']),
          closed_at: str_to_datetime(i['closed_at']),
          updated_at: str_to_datetime(i['updated_at'])
        }
      end
    else
      @projects.each do |project|
        (@client.issues(project, state: 'open') +
         @client.issues(project, state: 'closed')).each do |i|
          @issues << {
            number: i.number,
            url: i.url,
            state: i.state,
            title: i.title,
            project: project,
            reporter: i.user.login,
            labels: i.labels.map {|label| label.name},
            pull_request: !i.pull_request.nil?,
            created_at: time_to_datetime(i.created_at),
            closed_at: time_to_datetime(i.closed_at),
            updated_at: time_to_datetime(i.updated_at)
          }
        end
      end
      ji = @issues.to_json
      File.write(file_name, @issues.to_json)
    end
  end

  def time_to_datetime(t)
    return nil if t.nil?
    seconds = t.sec + Rational(t.usec, 10**6)
    offset = Rational(t.utc_offset, 60 * 60 * 24)
    DateTime.new(t.year, t.month, t.day, t.hour, t.min, seconds, offset)
  end

  def str_to_datetime(str)
    return nil if str.nil?
    t = Time.parse(str)
    seconds = t.sec + Rational(t.usec, 10**6)
    offset = Rational(t.utc_offset, 60 * 60 * 24)
    DateTime.new(t.year, t.month, t.day, t.hour, t.min, seconds, offset)
  end

  def open_things_on(date, pull_request = false, labels=[])
    @issues.select do |i|
      (labels.length == 0 || (labels - i[:labels]).length < labels.length) &&
      i[:pull_request] == pull_request &&
        ((i[:closed_at].nil? && i[:created_at] <= date) ||
         (i[:created_at] <= date && i[:closed_at] >= date))
    end
  end

  def open_issues_on(date, labels=[])
    open_things_on(date, false, labels)
  end

  def open_prs_on(date, labels=[])
    open_things_on(date, true, labels)
  end

  def new_things_between(start_date, end_date, pull_request = false, labels=[], reporter=nil)
    @issues.select do |i|
      (labels.length == 0 || (labels - i[:labels]).length < labels.length) &&
      i[:pull_request] == pull_request &&
         (i[:created_at] >= start_date && i[:created_at] <= end_date) &&
         (reporter.nil? || i[:reporter] =~ /#{reporter}/)
    end
  end

  def new_issues_between(start_date, end_date, labels=[], reporter=nil)
    new_things_between(start_date, end_date, false, labels, reporter)
  end

  def new_prs_between(start_date, end_date, labels=[], reporter=nil)
    new_things_between(start_date, end_date, true, labels, reporter)
  end

  def closed_things_between(start_date, end_date, pull_request = false, labels=[], reporter=nil)
    @issues.select do |i|
      (labels.length == 0 || (labels - i[:labels]).length < labels.length) &&
      i[:pull_request] == pull_request &&
         (!i[:closed_at].nil? && i[:closed_at] >= start_date && i[:closed_at] <= end_date) &&
         (reporter.nil? || i[:reporter] =~ /#{reporter}/)
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
end
