const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '..');
config.watchFolders = [...new Set([...config.watchFolders, root])];
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  new RegExp(
    path.join(root, 'artifacts').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/.*',
  ),
];
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-keyflow/testing') {
    return { type: 'sourceFile', filePath: path.join(root, 'src/testing.ts') };
  }
  if (moduleName === 'react-native-keyflow') {
    return { type: 'sourceFile', filePath: path.join(root, 'src/index.ts') };
  }
  return previousResolveRequest
    ? previousResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
