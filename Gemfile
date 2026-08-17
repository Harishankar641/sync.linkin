# Gemfile — Ruby dependencies for SyncedIn's mobile CI/CD.
# Installed automatically by ruby/setup-ruby@v1 in the GitHub Actions
# workflow (bundler-cache: true).
#
# Local dev (rare — most updates ship via Vercel without touching native):
#   gem install bundler
#   bundle install
#   bundle exec fastlane ios beta       # or: android beta
source "https://rubygems.org"

gem "fastlane", "~> 2.227"
# Required by fastlane's cert/sigh actions (get_certificates /
# get_provisioning_profile) — they `require "multi_json"`, which isn't
# pulled in transitively, so bundler rejects it as "not part of the bundle"
# and the whole Fastfile fails to load (taking BOTH lanes down). Declaring
# it explicitly fixes the load.
gem "multi_json"

plugins_path = File.join(File.dirname(__FILE__), "fastlane", "Pluginfile")
eval_gemfile(plugins_path) if File.exist?(plugins_path)
