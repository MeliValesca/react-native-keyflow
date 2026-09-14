require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
Pod::Spec.new do |s|
  s.name = 'KeyflowNative'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.author = 'Keyflow contributors'
  s.homepage = package['homepage']
  s.license = { :type => 'MIT', :file => '../LICENSE' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => package['repository']['url'], :tag => "v#{s.version}" }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.resource_bundles = { 'KeyflowPrivacy' => ['PrivacyInfo.xcprivacy'] }
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
