require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/react-native-permissions/scripts/setup'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'
require_relative '../node_modules/expo/scripts/autolinking'

# Read properties from Podfile.properties.json if it exists
properties_path = File.join(__dir__, 'Podfile.properties.json')
properties = {}
if File.exist?(properties_path)
  properties = JSON.parse(File.read(properties_path))
end

# Set environment variables based on properties
ENV['RCT_NEW_ARCH_ENABLED'] = properties['newArchEnabled'] == 'true' ? '1' : '0'
ENV['USE_HERMES'] = properties['useHermes'] == 'true' ? '1' : '0'
ENV['USE_FRAMEWORKS'] = properties['useFrameworks'] == 'static' ? 'static' : nil

# Set platform version from properties or default to 15.1
platform :ios, properties['ios.deploymentTarget'] || '15.1'
install! 'cocoapods', :deterministic_uuids => false

# Handle problematic targets in pre_install hook
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if pod.name.eql?('RCT-Folly') || pod.name.eql?('boost')
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
  
  # Fix for RCT-Folly Optional.h missing Coroutine.h
  folly_spec = installer.pod_targets.find { |spec| spec.name == 'RCT-Folly' }
  if folly_spec
    folly_spec.spec.prepare_command = <<-CMD
      sed -i.bak -e 's/#if FOLLY_HAS_COROUTINES/#if FOLLY_HAS_COROUTINES \\&\\& __has_include(<folly\\/experimental\\/coro\\/Coroutine.h>)\\n#define FOLLY_OPTIONAL_HAS_COROUTINE_HEADER 1/g' folly/Optional.h
    CMD
  end
end

target 'BuzoAI' do
  use_expo_modules!
  config = use_native_modules!

  use_frameworks! :linkage => :static
  $RNFirebaseAsStaticFramework = true

  # Flags change depending on the env values.
  flags = get_default_flags()

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => flags[:hermes_enabled],
    :fabric_enabled => flags[:fabric_enabled],
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  # Uncomment to opt-in to using Flipper
  # Note that if you have use_frameworks! enabled, Flipper will not work
  #
  # use_flipper!()

  post_install do |installer|
    # https://github.com/facebook/react-native/blob/main/packages/react-native/scripts/react_native_pods.rb#L197-L202
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
    
    # Fix for RCT-Folly Optional.h missing Coroutine.h
    folly_dir = installer.sandbox.pod_dir('RCT-Folly')
    if folly_dir && File.exist?("#{folly_dir}/folly/Optional.h")
      puts "Patching RCT-Folly Optional.h for missing Coroutine.h"
      optional_h_content = File.read("#{folly_dir}/folly/Optional.h")
      patched_content = optional_h_content.gsub(
        /#if FOLLY_HAS_COROUTINES/,
        "#if FOLLY_HAS_COROUTINES && __has_include(<folly/experimental/coro/Coroutine.h>)\n#define FOLLY_OPTIONAL_HAS_COROUTINE_HEADER 1"
      )
      
      # Add conditional compilation for OptionalPromiseReturn
      patched_content = patched_content.gsub(
        /template <typename Value>\nstruct OptionalPromiseReturn/,
        "template <typename Value>\n#if FOLLY_OPTIONAL_HAS_COROUTINE_HEADER\nstruct OptionalPromiseReturn"
      )
      
      # Add endif after OptionalPromise
      patched_content = patched_content.gsub(
        /};\n} \/\/ namespace detail/,
        "};\n#endif // FOLLY_OPTIONAL_HAS_COROUTINE_HEADER\n} // namespace detail"
      )
      
      # Add conditional compilation for awaiter
      patched_content = patched_content.gsub(
        /template <typename T>\nstruct awaiter<folly::Optional<T>> {/,
        "template <typename T>\nstruct awaiter<folly::Optional<T>> {\n#if FOLLY_OPTIONAL_HAS_COROUTINE_HEADER"
      )
      
      # Add endif after awaiter
      patched_content = patched_content.gsub(
        /};\n} \/\/ namespace folly/,
        "};\n#endif // FOLLY_OPTIONAL_HAS_COROUTINE_HEADER\n} // namespace folly"
      )
      
      # Add endif at the end of the coroutines section
      patched_content = patched_content.gsub(
        /#endif \/\/ FOLLY_HAS_COROUTINES/,
        "#endif // FOLLY_HAS_COROUTINES && __has_include"
      )
      
      File.write("#{folly_dir}/folly/Optional.h", patched_content)
    end
    
    # Apply iOS 17 privacy manifest fix
    installer.pods_project.targets.each do |target|
      if target.name.end_with?('_privacy')
        puts "Disabling privacy target: #{target.name}"
        target.build_configurations.each do |config|
          config.build_settings['ENABLE_BITCODE'] = 'NO'
          config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64'
          config.build_settings['DEAD_CODE_STRIPPING'] = 'YES'
          config.build_settings['ONLY_ACTIVE_ARCH'] = 'YES'
          config.build_settings['ENABLE_TESTABILITY'] = 'YES'
          config.build_settings['SWIFT_VERSION'] = '5.0'
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
          config.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = 'DEBUG'
          config.build_settings['SKIP_INSTALL'] = 'YES'
        end
      end
    end

    # Special handling for React-jsinspector (C++20 compatibility)
    installer.pods_project.targets.each do |target|
      if target.name == 'React-jsinspector' || target.name == 'React-jsinspector-modern'
        puts "Special handling for C++20 target: #{target.name}"
        # Check if the problematic file exists
        problematic_file = "#{installer.sandbox.pod_dir('React-jsinspector')}/ReactCommon/jsinspector-modern/RuntimeTargetConsole.cpp"
        if File.exist?(problematic_file)
          puts "Found problematic file: #{problematic_file}"
        end
        target.build_configurations.each do |config|
          puts "Setting C++20 standard for target: #{target.name}"
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        end
      end
    end

    # Create empty module maps for all targets
    installer.pods_project.targets.each do |target|
      if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
      
      # Create empty module maps
      if !target.name.include?('Pods-')
        puts "Created empty module.modulemap for #{target.name}"
        module_map_file = "#{installer.sandbox.root}/#{target.name}/module.modulemap"
        File.open(module_map_file, 'w') {}
      end
    end

    # Copy custom module maps for React-Core
    react_core_module_map = "#{installer.sandbox.root}/React-Core/React/React.modulemap"
    if File.exist?("#{__dir__}/patches/React.modulemap")
      FileUtils.cp("#{__dir__}/patches/React.modulemap", react_core_module_map)
      puts "Copied custom React-Core module map from patches"
    end

    # Check if DerivedData exists and copy module maps over
    derived_data_path = nil
    
    # Use a simpler approach to find DerivedData
    derived_data_dir = File.expand_path("~/Library/Developer/Xcode/DerivedData")
    if Dir.exist?(derived_data_dir)
      puts "Looking for DerivedData in default location: #{derived_data_dir}"
      Dir.foreach(derived_data_dir) do |entry|
        next if entry == '.' || entry == '..'
        if entry.start_with?('BuzoAI-')
          derived_data_path = File.join(derived_data_dir, entry)
          puts "Found DerivedData at: #{derived_data_path}"
          break
        end
      end
    end

    if !derived_data_path
      # Fallback to a search in the default location
      puts "Derived data path not found, using default location"
      derived_data_path = derived_data_dir
    end

    # Copy module maps to DerivedData if found
    if derived_data_path && Dir.exist?(derived_data_path)
      puts "Copying module maps to DerivedData: #{derived_data_path}"
      
      # Copy for Expo modules
      expo_modules_dir = "#{derived_data_path}/Build/Products/Debug-iphonesimulator/ExpoModulesCore"
      if Dir.exist?(expo_modules_dir)
        FileUtils.cp("#{installer.sandbox.root}/ExpoModulesCore/module.modulemap", "#{expo_modules_dir}/module.modulemap")
        puts "Copied module map for ExpoModulesCore"
      end
      
      # Copy for React-Core
      react_core_dir = "#{derived_data_path}/Build/Products/Debug-iphonesimulator/React-Core"
      if Dir.exist?(react_core_dir)
        FileUtils.cp(react_core_module_map, "#{react_core_dir}/React.modulemap")
        puts "Copied module map for React-Core"
      end
    else
      puts "DerivedData directory not found or not accessible"
    end
  end
end 