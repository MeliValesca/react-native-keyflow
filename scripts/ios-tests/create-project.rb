# Standalone UI-test runner for the app already built and launched by Stim.
require 'xcodeproj'
require 'fileutils'
root = File.expand_path('../..', __dir__)
output = File.join(root, 'artifacts/ios-qwerty-tests')
FileUtils.mkdir_p(output)
project = Xcodeproj::Project.new(File.join(output, 'QwertyTests.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'QwertyTests', :ios, '16.0')
target.add_file_references([project.main_group.new_file(File.join(__dir__, 'KeyflowQwertyTests.swift'))])
target.add_resources(%w[apple-letter-reference apple-tablet-letter-reference].map { |name| project.main_group.new_file(File.join(root, "scripts/fixtures/#{name}.json")) })
target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.keyflow.parity-tests'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = 'Debug'
scheme.save_as(project.path, 'QwertyTests', true)
puts project.path
