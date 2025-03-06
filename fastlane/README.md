fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

### ios_debug_beta

```sh
[bundle exec] fastlane ios_debug_beta
```

Debug beta build for iOS (with automatic signing)

### ios_debug

```sh
[bundle exec] fastlane ios_debug
```

Debug build for iOS (test only)

### ios_beta

```sh
[bundle exec] fastlane ios_beta
```

Deploy iOS app to TestFlight

### ios_release

```sh
[bundle exec] fastlane ios_release
```

Deploy iOS app to App Store

### ios_adhoc

```sh
[bundle exec] fastlane ios_adhoc
```

Build iOS AdHoc for internal testing

### android_internal

```sh
[bundle exec] fastlane android_internal
```

Deploy Android app to internal testing

### android_production

```sh
[bundle exec] fastlane android_production
```

Deploy Android app to production

### increment_ios_version

```sh
[bundle exec] fastlane increment_ios_version
```

Increment iOS version

### increment_android_version

```sh
[bundle exec] fastlane increment_android_version
```

Increment Android version

### beta_all

```sh
[bundle exec] fastlane beta_all
```

Deploy to both iOS and Android beta/internal

### release_all

```sh
[bundle exec] fastlane release_all
```

Deploy to both iOS and Android production

### increment_version_all

```sh
[bundle exec] fastlane increment_version_all
```

Increment version for both iOS and Android

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
