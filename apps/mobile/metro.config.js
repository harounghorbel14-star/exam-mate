// Metro config: compile the shared core package from source.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);
const coreSrc = path.resolve(__dirname, '../../packages/core/src');
config.watchFolders = [coreSrc];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@exammate/core') return { type: 'sourceFile', filePath: path.join(coreSrc, 'index.ts') };
  if (moduleName.startsWith('@exammate/core/')) moduleName = path.join(coreSrc, moduleName.slice('@exammate/core/'.length));
  // Core uses ESM-style ".js" specifiers for TypeScript files.
  if (moduleName.endsWith('.js') && (moduleName.startsWith('.') || moduleName.startsWith('/'))) {
    const base = path.resolve(path.dirname(context.originModulePath), moduleName);
    const ts = base.replace(/\.js$/, '.ts');
    if (fs.existsSync(ts)) return { type: 'sourceFile', filePath: ts };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};
module.exports = config;
