jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => () => undefined, fetch: async () => ({ isConnected: false }) }));
jest.mock('expo-secure-store', () => { const m = new Map(); return { getItemAsync: async (k) => m.get(k) ?? null, setItemAsync: async (k, v) => { m.set(k, v); }, deleteItemAsync: async (k) => { m.delete(k); } }; });
jest.mock('expo-speech', () => ({ speak: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: (cb) => { const React = require('react'); React.useEffect(cb, []); } }));
