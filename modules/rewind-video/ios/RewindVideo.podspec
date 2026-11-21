Pod::Spec.new do |s|
  s.name           = 'RewindVideo'
  s.version        = '1.0.0'
  s.summary        = 'Copies videos from the photo library into the app sandbox for playback'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Rewind'
  s.homepage       = 'https://github.com/herdtbenny/rewind'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/herdtbenny/rewind.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
