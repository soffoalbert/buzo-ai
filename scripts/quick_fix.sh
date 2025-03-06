#!/bin/bash

cd ios

# Create directories for the missing file
mkdir -p Pods/RCT-Folly/folly/experimental/coro

# Create a stub Coroutine.h file
cat > Pods/RCT-Folly/folly/experimental/coro/Coroutine.h << 'EOL'
// Stub Coroutine.h file to avoid missing file errors
#pragma once

#include <folly/Portability.h>

namespace folly {
namespace coro {
  // Empty stub implementation
}
}
EOL

echo "Created stub Coroutine.h file"

# Make symbolic links to the Headers directories
mkdir -p Pods/Headers/Public/RCT-Folly/folly/experimental/coro
mkdir -p Pods/Headers/Private/RCT-Folly/folly/experimental/coro

# Use relative path for the links
ln -sf ../../../../RCT-Folly/folly/experimental/coro/Coroutine.h Pods/Headers/Public/RCT-Folly/folly/experimental/coro/Coroutine.h
ln -sf ../../../../RCT-Folly/folly/experimental/coro/Coroutine.h Pods/Headers/Private/RCT-Folly/folly/experimental/coro/Coroutine.h

echo "Created symbolic links to stub Coroutine.h"

# Define preprocessor to disable coroutines
sed -i '' '1i\
// Disable coroutines\
#ifndef FOLLY_CFG_NO_COROUTINES\
#define FOLLY_CFG_NO_COROUTINES 1\
#endif\
' Pods/RCT-Folly/folly/Optional.h

echo "Added FOLLY_CFG_NO_COROUTINES definition to Optional.h"

echo "All fixes applied successfully"

# Add a note for the user
echo "Now you can try building the project in Xcode" 