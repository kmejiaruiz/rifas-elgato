const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const ASSERT_MOCK_PATH = path.resolve(__dirname, 'assert-mock.js');

// Interceptar directamente el módulo 'assert' antes de que Metro lo busque
// en node_modules (evita problemas con enlaces simbólicos de pnpm).
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'assert') {
    return { type: 'sourceFile', filePath: ASSERT_MOCK_PATH };
  }
  // Delegar el resto al resolver predeterminado
  return context.resolveRequest(context, moduleName, platform);
};

// Respaldo: también mapear via extraNodeModules
config.resolver.extraNodeModules = {
  assert: ASSERT_MOCK_PATH,
};

// Ensure Metro watches from the project root
config.watchFolders = [__dirname];

// Make sure the project root is set correctly
config.projectRoot = __dirname;

module.exports = config;
