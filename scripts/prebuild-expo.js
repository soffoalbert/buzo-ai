#!/usr/bin/env node
// This script needs to be run using: npx expo prebuild-expo.js

// Ignore any additional arguments like --platform
const args = process.argv.slice(2);
console.log('Arguments passed:', args);
console.log('Ignoring platform arguments and running prebuild tasks...');

const { execSync } = require('child_process');

try {
  console.log('Installing unimodules-app-loader...');
  execSync('npm install unimodules-app-loader || true', { stdio: 'inherit' });
  
  console.log('Applying patches...');
  execSync('npx patch-package', { stdio: 'inherit' });
  
  console.log('Prebuild completed successfully');
  process.exit(0);
} catch (error) {
  console.error('Prebuild failed:', error);
  process.exit(1);
} 