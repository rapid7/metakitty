require 'octokit'
require 'date'
require 'json'

require_relative 'issue.rb'

class IssueStats
  MAX_RETRIES = 5
  INITIAL_BACKOFF = 2
  MAX_BACKOFF = 300

  def initialize(auth_options, projects)
    @projects = projects
    @client = Octokit::Client.new(auth_options) if auth_options
    @client.auto_paginate = true
    @issues = []

    file_name = "cache.json"

    @aliases = {
      'jlee-r7' => 'egypt',
      'limhoff-r7' => 'KronicDeth',
      'bcook-r7' => 'busterb',
      'oj' => 'OJ'
    }

    if File.exist?(file_name) && ((Time.now - File.stat(file_name).mtime).to_i < 86400)
      $stderr.puts("Using cached issues in #{file_name}")
      JSON.parse(File.read(file_name)).each do |i|
        @issues << Issue.from_json_hash(i)
      end
    else
      @projects.each do |project|
        $stderr.puts project
        (
          with_retry { @client.issues(project, state: 'open') } +
          with_retry { @client.issues(project, state: 'closed') }
        ).each do |i|
          issue = Issue.from_ghissue(i, project)

          # For OPEN pull requests only, fetch timing data for review detection
          if issue.pull_request && !issue.closed_at && @client
            begin
              # Get the actual last commit time for this PR
              commits = with_retry { @client.pull_request_commits(project, i.number) }
              if commits && commits.any?
                last_commit = commits.last
                issue.last_commit_at = Issue.time_to_datetime(last_commit.commit.author.date)
              else
                # Fallback to updated_at if no commits found
                issue.last_commit_at = issue.updated_at
              end

              # Fetch comments (both issue comments and review comments) and get count + timing
              all_comment_times = []

              begin
                issue_comments = with_retry { @client.issue_comments(project, i.number, per_page: 100) }
                all_comment_times.concat(issue_comments.map(&:created_at))
              rescue => e
                $stderr.puts "  Warning: Could not fetch issue comments for #{project}##{i.number}: #{e.message}"
              end

              begin
                review_comments = with_retry { @client.pull_request_comments(project, i.number, per_page: 100) }
                all_comment_times.concat(review_comments.map(&:created_at))
              rescue => e
                $stderr.puts "  Warning: Could not fetch review comments for #{project}##{i.number}: #{e.message}"
              end

              # Update the actual comment count (gh.comments doesn't include review comments)
              issue.comment_count = all_comment_times.length

              if all_comment_times.any?
                issue.last_comment_at = Issue.time_to_datetime(all_comment_times.max)
              end
            rescue => e
              $stderr.puts "  Warning: Could not fetch PR details for #{project}##{i.number}: #{e.message}"
            end
          end

          @issues << issue
        end
      end
      File.write(file_name, @issues.to_json)
    end
    nil
  end

  # Retry with exponential backoff for rate limit errors
  def with_retry(max_retries = MAX_RETRIES, &block)
    retries = 0
    backoff = INITIAL_BACKOFF

    begin
      yield
    rescue Octokit::TooManyRequests => e
      if retries < max_retries
        retries += 1

        # Check if GitHub provided a reset time
        reset_time = @client.rate_limit.resets_at
        if reset_time
          wait_time = [(reset_time - Time.now).to_i, MAX_BACKOFF].min
          if wait_time > 0
            $stderr.puts "  Rate limit exceeded. Waiting #{wait_time} seconds until reset at #{reset_time}..."
            sleep(wait_time)
          end
        else
          # Use exponential backoff
          $stderr.puts "  Rate limit exceeded. Retry #{retries}/#{max_retries} after #{backoff} seconds..."
          sleep(backoff)
          backoff = [backoff * 2, MAX_BACKOFF].min
        end

        retry
      else
        $stderr.puts "  Rate limit exceeded. Max retries (#{max_retries}) reached. Giving up."
        raise
      end
    end
  end

  # Pre-filter issues for a specific chart to improve performance
  def filter_issues_for_chart(pull_request, labels)
    @issues.select do |issue|
      (labels.length == 0 || (labels - issue.labels).length < labels.length) &&
      issue.pull_request == pull_request
    end
  end

  # Optimized method to count open issues on a specific date
  def count_open_on_date(filtered_issues, date, r7_filter = false)
    filtered_issues.count do |issue|
      is_open = (issue.closed_at.nil? && issue.created_at <= date) ||
                (issue.created_at <= date && !issue.closed_at.nil? && issue.closed_at >= date)

      if r7_filter
        is_open && (issue.reporter =~ /-r7/)
      else
        is_open
      end
    end
  end

  # Batch process quarterly data for better performance
  def get_quarterly_data(filtered_issues, start_date, end_date)
    new_issues = []
    new_r7_issues = []
    closed_issues = []
    closed_r7_issues = []

    filtered_issues.each do |issue|
      # New issues in quarter
      if issue.created_at >= start_date && issue.created_at <= end_date
        new_issues << issue
        new_r7_issues << issue if issue.reporter =~ /-r7/
      end

      # Closed issues in quarter
      if !issue.closed_at.nil? && issue.closed_at >= start_date && issue.closed_at <= end_date
        closed_issues << issue
        closed_r7_issues << issue if issue.reporter =~ /-r7/
      end
    end

    {
      new_count: new_issues.length,
      new_r7_count: new_r7_issues.length,
      closed_count: closed_issues.length,
      closed_r7_count: closed_r7_issues.length
    }
  end

  def to_s
    @projects
  end

  def pull_requests
    @issues.select do |issue|
      issue.pull_request == true
    end
  end

  def issues
    @issues
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
      commits.concat with_retry { @client.commits_since(project, date) }
    end
    committers = {}
    committers.default = 0
    commits.each do |commit|
      author = commit[:commit][:author][:name]
      committers[commit[:commit][:author][:name]] += 1 \
        unless author == "Metasploit Jenkins Bot (msjenkins-r7)"
    end
    committers.sort_by { |k, v| v }.reverse.to_h
  end

  # Memoized methods for expensive operations
  def commits_modules_json
    @commits_modules_json ||= with_retry {
      @client.commits_since('rapid7/metasploit-framework', DateTime.now - 30, {path: 'modules'})
    }.select{|pr|pr[:commit][:message].include?('Land #')}.
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
    @commits_merged_json ||= begin
      commits_merged = closed_prs_between(DateTime.now - 30, DateTime.now).first(6)
      # Batch API calls for HTML URLs to reduce API calls
      commits_merged.each_slice(6) do |slice|
        slice.each do |pr|
          pr.labels = pr.labels.map{|l|{name: l}}
          # Cache HTML URL lookup to avoid repeated API calls
          pr.html_url = "https://github.com/#{pr.project}/pull/#{pr.number}"
        end
      end
      commits_merged
    end
  end

  def contributor_id(contributor)
    id = contributor[:login] || contributor[:name] || contributor[:email]
    @aliases.key?(id) ? @aliases[id] : id
  end

  def contributors_date_json(date)
    commits = []
    @projects.each do |project|
      commits.concat with_retry { @client.commits_since(project, date) }
    end
    committers = {}
    committers.default = 0
    commits.each do |commit|
      if !commit.author.nil? && commit.author.login != 'msjenkins-r7'
        committers[commit.author.login] += 1
      end
    end
    puts committers
    top_contributor_infos(committers)
  end

  def contributors_month_json
    contributors_date_json(DateTime.now - 30)
  end

  def contributors_year_json
    contributors_date_json(DateTime.now - 365)
  end

  def contributors_all_json
    contributors = []
    @projects.each do |project|
      contributors.concat with_retry { @client.contribs(project, true) }
    end
    contributor_counts = {}
    contributor_counts.default = 0
    contributors.each do |contributor|
      id = contributor_id(contributor)
      contributor_counts[id] += contributor[:contributions] \
        unless id == "msjenkins-r7"
    end
    puts contributor_counts
    top_contributor_infos(contributor_counts)
  end

  def top_contributor_infos(contributor_counts)
    @user_cache ||= {}
    top_contributors = contributor_counts.sort_by { |k, v| v }.reverse.to_h
    top_contributor_infos = []
    num_found = 0

    top_contributors.each do |contributor|
      login = contributor[0]
      contributions = contributor[1]

      begin
        # Use cached user data if available
        user = @user_cache[login]
        unless user
          user = with_retry { @client.user(login) }
          @user_cache[login] = user
        end

        user_data = user.to_h
        user_data[:contributions] = contributions
        top_contributor_infos << user_data
        num_found += 1
        break if num_found >= 30
      rescue => e
        $stderr.puts "Failed to fetch user #{login}: #{e.message}"
      end
    end
    top_contributor_infos
  end

  def issues_newbie_json
    @issues_newbie_json ||= begin
      newb_issues = open_issues_on(DateTime.now, ['newbie-friendly']).first(10)
      newb_issues.each do |issue|
        issue.labels = issue.labels.map{|l|{name: l}}
        # Avoid API call by constructing URL directly
        issue.html_url = "https://github.com/#{issue.project}/issues/#{issue.number}"
      end
      newb_issues
    end
  end

  # Determine if a PR has been reviewed
  def has_review?(pr)
    comment_count = pr.comment_count || 0

    # No comments at all = definitely needs review
    if comment_count == 0
      return false
    end

    # If we have detailed timing data, use it to check if last commit is after last comment
    if pr.last_commit_at && pr.last_comment_at
      # If the last commit is AFTER the last comment, there are unreviewed changes (return false)
      # If the last commit is BEFORE or EQUAL to the last comment, it's been reviewed (return true)
      has_review = pr.last_commit_at <= pr.last_comment_at

      return has_review
    end

    true
  end

  def metasploit_repos_json
    @metasploit_repos_json ||= begin
      repo_data = {}

      # Group pull requests by repository
      pull_requests.each do |pr|
        repo_name = pr.project
        repo_data[repo_name] ||= {
          name: repo_name,
          open_prs: [],
          closed_prs: [],
          total_count: 0
        }

        # Calculate PR age
        age_days = (Date.today - Date.parse(pr.created_at.to_s)).to_i
        age_text = case age_days
                   when 0 then "today"
                   when 1 then "1 day ago"
                   when 2..6 then "#{age_days} days ago"
                   when 7..13 then "1 week ago"
                   when 14..29 then "#{age_days / 7} weeks ago"
                   when 30..59 then "1 month ago"
                   when 60..364 then "#{age_days / 30} months ago"
                   else "#{age_days / 365} year#{age_days > 730 ? 's' : ''} ago"
                   end

        # Calculate last updated time
        updated_days = (Date.today - Date.parse(pr.updated_at.to_s)).to_i
        updated_text = case updated_days
                       when 0 then "today"
                       when 1 then "1 day ago"
                       when 2..6 then "#{updated_days} days ago"
                       when 7..13 then "1 week ago"
                       when 14..29 then "#{updated_days / 7} weeks ago"
                       when 30..59 then "1 month ago"
                       when 60..364 then "#{updated_days / 30} months ago"
                       else "#{updated_days / 365} year#{updated_days > 730 ? 's' : ''} ago"
                       end

        pr_info = {
          number: pr.number,
          title: pr.title.to_s.force_encoding('UTF-8'),
          author: pr.reporter.to_s.force_encoding('UTF-8'),
          assignees: (pr.assignees || []).map { |a| a.to_s.force_encoding('UTF-8') },
          comment_count: pr.comment_count || 0,
          has_review: has_review?(pr),
          labels: (pr.labels || []).map { |label| label.to_s.force_encoding('UTF-8') },
          age: age_text,
          updated: updated_text,
          url: pr.html_url || "https://github.com/#{pr.project}/pull/#{pr.number}",
          created_at: pr.created_at
        }

        if pr.closed_at.nil?
          repo_data[repo_name][:open_prs] << pr_info
        else
          repo_data[repo_name][:closed_prs] << pr_info
        end
        repo_data[repo_name][:total_count] += 1
      end

      # Sort PRs within each repo by creation date (newest first)
      repo_data.each do |_, repo|
        repo[:open_prs].sort_by! { |pr| -Time.parse(pr[:created_at].to_s).to_i }
        repo[:closed_prs].sort_by! { |pr| -Time.parse(pr[:created_at].to_s).to_i }
      end

      # Convert to array and sort by total PRs descending
      repo_data.values.sort_by { |repo| -repo[:total_count] }
    end
  end
end
