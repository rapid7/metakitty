
class Issue

  attr_accessor :closed_at
  attr_accessor :created_at
  attr_accessor :labels
  attr_accessor :number
  attr_accessor :project
  attr_accessor :pull_request
  attr_accessor :reporter
  attr_accessor :state
  attr_accessor :title
  attr_accessor :updated_at
  attr_accessor :url
  attr_accessor :html_url
  attr_accessor :comment_count
  attr_accessor :last_commit_at
  attr_accessor :last_comment_at
  attr_accessor :assignees

  def self.from_json_hash(json)
    issue = new

    issue.number = json['number']
    issue.url = json['url']
    issue.state = json['state']
    issue.title = json['title']
    issue.labels = json['labels']
    issue.reporter = json['reporter']
    issue.project = json['project']
    issue.pull_request = json['pull_request']
    issue.created_at = str_to_datetime(json['created_at'])
    issue.closed_at = str_to_datetime(json['closed_at'])
    issue.updated_at = str_to_datetime(json['updated_at'])
    issue.comment_count = json['comment_count'] || 0
    issue.last_commit_at = str_to_datetime(json['last_commit_at'])
    issue.last_comment_at = str_to_datetime(json['last_comment_at'])
    issue.assignees = json['assignees'] || []

    issue
  end

  def self.from_ghissue(gh, project)
    issue = new

    issue.closed_at = time_to_datetime(gh.closed_at)
    issue.created_at = time_to_datetime(gh.created_at)
    issue.labels = gh.labels.map {|label| label.name}
    issue.number = gh.number
    issue.project = project
    issue.pull_request = !gh.pull_request.nil?
    issue.reporter = gh.user.login
    issue.state = gh.state
    issue.title = gh.title
    issue.updated_at = time_to_datetime(gh.updated_at)
    issue.url = gh.url
    issue.comment_count = gh.comments || 0
    issue.assignees = gh.assignees.map { |a| a.login }

    issue
  end

  def to_json(*a)
    {
      closed_at: closed_at,
      created_at: created_at,
      labels: labels,
      number: number,
      project: project,
      pull_request: pull_request,
      reporter: reporter,
      state: state,
      title: title,
      updated_at: updated_at,
      url: url,
      comment_count: comment_count,
      last_commit_at: last_commit_at,
      last_comment_at: last_comment_at,
      assignees: assignees,
      user: {
        login: reporter,
        html_url: 'https://github.com/' + reporter
      },
      html_url: html_url
    }.to_json(*a)
  end

  def self.time_to_datetime(t)
    return nil if t.nil?
    seconds = t.sec + Rational(t.usec, 10**6)
    offset = Rational(t.utc_offset, 60 * 60 * 24)
    DateTime.new(t.year, t.month, t.day, t.hour, t.min, seconds, offset)
  end

  private

  def self.str_to_datetime(str)
    return nil if str.nil?
    t = Time.parse(str)
    seconds = t.sec + Rational(t.usec, 10**6)
    offset = Rational(t.utc_offset, 60 * 60 * 24)
    DateTime.new(t.year, t.month, t.day, t.hour, t.min, seconds, offset)
  end

end

