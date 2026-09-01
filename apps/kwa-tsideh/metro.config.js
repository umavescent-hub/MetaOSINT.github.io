// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Required for the self-registering source adapters in src/sources/.
// Without this, `require.context` is not transformed and the app boots with
// zero sources. See src/core/registry.ts.
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
