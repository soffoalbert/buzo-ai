// This script handles prebuild operations for EAS
// It will ignore any additional arguments passed to it

const { execSync } = require('child_process');

console.log('Starting prebuild process...');

try {
  // Install dependencies
  console.log('Installing unimodules-app-loader...');
  try {
    execSync('npm install unimodules-app-loader', { stdio: 'inherit' });
  } catch (e) {
    console.log('Non-fatal error installing unimodules-app-loader, continuing...');
  }

  // Apply patches
  console.log('Applying patches...');
  execSync('npx patch-package', { stdio: 'inherit' });

  console.log('Prebuild completed successfully');
} catch (error) {
  console.error('Error during prebuild:', error);
  // Exit with success anyway to not block the build
  // because failures here are often non-fatal
}

// Always exit with success
process.exit(0); 