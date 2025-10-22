class Auth
  def self.octokit_auth_options!
    if ENV['GITHUB_OAUTH_TOKEN']
      { access_token: ENV['GITHUB_OAUTH_TOKEN'] }
    elsif ENV['GITHUB_BASIC_AUTH']
      login, password = ENV['GITHUB_BASIC_AUTH'].split(':')
      { login: login, password: password }
    else
      raise 'Missing Github authentication - set the environment variable GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH'
    end
  end
end
