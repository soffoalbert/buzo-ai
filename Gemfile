source "https://rubygems.org"

ruby '3.4.2'

gem "fastlane"
gem "cocoapods"

plugins_path = File.join(File.dirname(__FILE__), 'fastlane', 'Pluginfile')
eval_gemfile(plugins_path) if File.exist?(plugins_path)
gem "abbrev", "~> 0.1.2"
