require 'xcodeproj'
require 'fileutils'
root = File.expand_path('../..', __dir__)
output = File.join(root, 'artifacts/ios-rendering-tests')
FileUtils.rm_rf(output)
FileUtils.mkdir_p(output)
project = Xcodeproj::Project.new(File.join(output, 'RenderingTests.xcodeproj'))
target = project.new_target(:unit_test_bundle, 'RenderingTests', :ios, '16.0')
files = %w[KeyflowCursorNavigator.swift KeyflowCallout.swift KeyflowKey.swift KeyflowKeyboardView.swift KeyflowKeyboardLayout.swift KeyflowKeyRows.swift KeyflowLanguage.swift KeyflowTheme.swift KeyflowTabletAccents.swift]
refs = files.map { |name| project.main_group.new_file(File.join(root, 'ios', name)) }
refs << project.main_group.new_file(File.join(__dir__, 'KeyflowRenderingTests.swift'))
target.add_file_references(refs)
target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.keyflow.rendering-tests'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = 'Debug'
scheme.save_as(project.path, 'RenderingTests', true)
puts project.path
