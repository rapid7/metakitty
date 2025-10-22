#!/usr/bin/env ruby

require 'json'
require 'erb'
require 'octokit'
require_relative 'stats.rb'
require_relative 'auth.rb'

puts "Loading stats..."
auth_options = Auth::octokit_auth_options!

projects = [
  'rapid7/metasploit-framework',
  'rapid7/metasploit-payloads',
  'rapid7/meterpreter',
  'rapid7/metasploit-javapayload',
  'rapid7/metasploit-omnibus',
  'rapid7/metasploit_data_models',
  'rapid7/metasploit-credential',
  'rapid7/metasploit-model',
  'rapid7/metasploit-aggregator',
  'rapid7/metasploit-baseline-builder',
  'rapid7/metasploit-vulnerability-emulator',
  'rapid7/network_interface',
  'rapid7/rex-encoder',
  'rapid7/rex-rop_builder',
  'rapid7/rex-mime',
  'rapid7/rex-nop',
  'rapid7/rex-text',
  'rapid7/rex-powershell',
  'rapid7/rex-sslscan',
  'rapid7/rex-socket',
  'rapid7/rex-core',
  'rapid7/rex-bin_tools',
  'rapid7/rex-ole',
  'rapid7/rex-arch',
  'rapid7/rex-struct2',
  'rapid7/rex-registry',
  'rapid7/rex-java',
  'rapid7/rex-zip',
  'rapid7/rex-random_identifier',
  'rapid7/rex',
  'rapid7/mettle',
  'rapid7/metasploitable3',
  'rapid7/msfrpc-client',
  'rapid7/fastlib',
  'rapid7/ruby_smb',
  'rapid7/vm-automation'
]
stats = IssueStats.new(auth_options, projects)

puts stats.pull_requests.length
puts stats.issues.length

(2014..2018).each do |year|
  beg = DateTime.new(year, 1, 1)
  last = DateTime.new(year + 1, 1, 1)

  puts "#{beg}"

  items = stats.new_issues_between(beg, last, ['bug'])
  puts "#{items.length} new bugs"

  items = stats.closed_issues_between(beg, last, ['bug'])
  puts "#{items.length} closed bugs"

  items = stats.new_issues_between(beg, last, ['feature', 'enhancement'])
  puts "#{items.length} new feature requests"

  items = stats.new_issues_between(beg, last, ['feature', 'enhancement'])
  puts "#{items.length} closed feature requests"
end

#puts "#{stats.top_committers(beg).length} committers"
