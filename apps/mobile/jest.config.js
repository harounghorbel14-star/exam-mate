const path = require('path');
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  // The first test in a file pays for transforming core + mathjs; cold CI runners need more than 5 s.
  testTimeout: 30000,
  // Core is compiled from ../../packages/core; resolve its imports (mathjs, Babel helpers) from this app.
  modulePaths: [path.resolve(__dirname, 'node_modules')],
  moduleNameMapper: {
    '^@exammate/core$': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|expo-.*|@expo(nent)?/.*|@react-navigation/.*|react-native-.*|mathjs)/)'],
};
