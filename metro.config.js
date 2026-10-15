const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Keep release bundling stable on lower-memory Windows field laptops.
config.maxWorkers = Number(process.env.METRO_MAX_WORKERS || 1);

// Bundle pre-populated SQLite files from assets/
config.resolver.assetExts.push('db');
const damagedInstallFolders = exclusionList([
  /.*node_modules.*\.react-native-.*/,
  /.*node_modules.*\.sucrase-.*/,
]);

config.resolver.blockList = damagedInstallFolders;
config.resolver.blacklistRE = damagedInstallFolders;

module.exports = config;
