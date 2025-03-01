// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for importing SVG files
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg', 'js', 'jsx', 'ts', 'tsx', 'cjs', 'mjs'];

// Add support for PDF.js
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'pdfjs-dist': path.resolve(__dirname, 'node_modules/pdfjs-dist'),
};

// Ensure we transpile PDF.js
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');

module.exports = config; 