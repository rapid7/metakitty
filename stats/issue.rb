
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
    }.to_json(*a)
  end

  private

  def self.time_to_datetime(t)
    return nil if t.nil?
    seconds = t.sec + Rational(t.usec, 10**6)
    offset = Rational(t.utc_offset, 60 * 60 * 24)
    DateTime.new(t.year, t.month, t.day, t.hour, t.min, seconds, offset)
  end

  def self.str_to_datetime(str)
    return nil if str.nil?
    t = Time.parse(str)
    seconds = t.sec + Rational(t.usec, 10**6)
    offset = Rational(t.utc_offset, 60 * 60 * 24)
    DateTime.new(t.year, t.month, t.day, t.hour, t.min, seconds, offset)
  end

end

