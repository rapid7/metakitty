require 'octokit'
require 'zip'

if !ENV.has_key?('GITHUB_OAUTH_TOKEN')
  puts "An authentication method environment variable must be set"
  puts "Please set GITHUB_OAUTH_TOKEN"
  exit 1
end

token = ENV['GITHUB_OAUTH_TOKEN']

# Attempts to download the latest successful run of the Metasploit acceptance tests
class AcceptanceTestReport
  def initialize(access_token:, repository_name: 'rapid7/metasploit-framework')
    @access_token = access_token
    @repository_name = repository_name
  end

  def download
    client = Octokit::Client.new(access_token: @access_token)
    # Don't auto_paginate, as there might be hundreds of workflow runs - and we only want the first page
    client.auto_paginate = false

    all_workflow_runs = client.repository_workflow_runs(@repository_name, { branch: 'master' }).workflow_runs
    latest_successful_acceptance_test = all_workflow_runs.find { |workflow_run| workflow_run.name == 'Acceptance' && workflow_run.conclusion == 'success' }
    if !latest_successful_acceptance_test
      warn "No acceptance tests found - ignoring download"
      return
    end

    latest_artifacts = client.workflow_run_artifacts(@repository_name, latest_successful_acceptance_test.id).artifacts
    final_report_artifact = latest_artifacts.find { |artifact| artifact.name.start_with?('final-report') }

    # Currently the artifact URL redirects to an unauthed azure endpoint that raises an error if an auth header is present
    final_report_zip_bin_url = client.client_without_redirects.head(final_report_artifact.archive_download_url)['Location']
    final_report_zip_bin = Octokit::Client.new(access_token: nil).get(final_report_zip_bin_url)

    final_report_io = StringIO.new
    final_report_io.puts final_report_zip_bin
    final_report_io.rewind
    extract_zip(final_report_io, target_directory)
  end

  private

  def current_directory
    File.dirname(__FILE__)
  end

  def target_directory
    File.join(current_directory, 'build', 'acceptance-tests')
  end

  def extract_zip(zip_io, target_path)
    FileUtils.remove_entry(target_path, true)
    FileUtils.mkdir_p(target_path)

    Zip::File.open_buffer(zip_io) do |zip_file|
      zip_file.each do |f|
        fpath = File.join(target_path, f.name)
        FileUtils.mkdir_p(File.dirname(fpath))
        zip_file.extract(f, fpath)
      end
    end
  end
end

acceptance_test_report = AcceptanceTestReport.new(
  access_token: ENV['GITHUB_OAUTH_TOKEN'],
)

acceptance_test_report.download
