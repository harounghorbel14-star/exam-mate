import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/lib/app';
import { colors } from './src/lib/theme';
import { HomeScreen } from './src/screens/HomeScreen';
import { SolverScreen } from './src/screens/SolverScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { GamesScreen, GamePlayScreen } from './src/screens/GamesScreen';
import { FlashcardsScreen } from './src/screens/FlashcardsScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ExamsScreen } from './src/screens/ExamsScreen';
import { ToolsScreen } from './src/screens/ToolsScreen';
import { CoachScreen } from './src/screens/CoachScreen';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.elev, primary: colors.primary, text: colors.text, border: colors.border } };
const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

function TabsRoot() {
  const { t } = useApp();
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t('nav.home'), tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="Scan" component={ScanScreen} options={{ title: t('nav.scan'), tabBarIcon: icon('◉') }} />
      <Tabs.Screen name="Solver" component={SolverScreen} options={{ title: t('nav.solver'), tabBarIcon: icon('∑') }} />
      <Tabs.Screen name="Games" component={GamesScreen} options={{ title: t('nav.games'), tabBarIcon: icon('◆') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings'), tabBarIcon: icon('⚙') }} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { t } = useApp();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabsRoot} options={{ headerShown: false }} />
        <Stack.Screen name="GamePlay" component={GamePlayScreen as never} options={{ title: t('nav.games') }} />
        <Stack.Screen name="Flashcards" component={FlashcardsScreen} options={{ title: t('nav.flashcards') }} />
        <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: t('nav.documents') }} />
        <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: t('nav.progress') }} />
        <Stack.Screen name="Exams" component={ExamsScreen} options={{ title: t('nav.exams') }} />
        <Stack.Screen name="Tools" component={ToolsScreen} options={{ title: t('nav.tools') }} />
        <Stack.Screen name="Coach" component={CoachScreen} options={{ title: t('nav.coach') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
