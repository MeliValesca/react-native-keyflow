import { launchTest, testPlatform, testMaterial } from './testing/launch';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CustomizationScreen } from './screens/CustomizationScreen';
import { CustomFontScreen } from './screens/CustomFontScreen';
import { TransitionScreen } from './screens/TransitionScreen';
import { KeyboardScreen } from './screens/KeyboardScreen';
import { ProductThemeScreen } from './screens/ProductThemeScreen';
import { ShowcaseScreen } from './screens/ShowcaseScreen';
import { TransparencyScreen } from './screens/TransparencyScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { LayoutsScreen } from './screens/LayoutsScreen';
import { InteractionScreen } from './screens/InteractionScreen';
import { LongPressScreen } from './screens/LongPressScreen';
import { TeardownScreen } from './screens/TeardownScreen';
import { ReturnActionScreen } from './screens/ReturnActionScreen';
export type Routes = {
  Teardown: undefined;
  ReturnActions: undefined;
  Showcase: undefined;
  Transparency: undefined;
  Interactions: undefined;
  LongPress: undefined;
  Layouts: undefined;
  Languages: undefined;
  ProductTheme: undefined;
  Transitions: undefined;
  Customization: undefined;
  CustomFont: undefined;
  Keyboard: { preset: 'native' | 'studio' | 'multiline' };
};
const Stack = createNativeStackNavigator<Routes>();
export default function App() {
  const test =
    __DEV__ && (testPlatform === 'all' || Platform.OS === testPlatform)
      ? launchTest
      : null;
  return (
    <SafeAreaProvider>
      <NavigationContainer key={`${test}:${testMaterial}`}>
        <Stack.Navigator
          initialRouteName={
            test === 'customization'
              ? 'Customization'
              : test === 'transitions'
              ? 'Transitions'
              : 'Showcase'
          }
          screenOptions={{
            headerShadowVisible: false,
            ...(Platform.OS === 'android'
              ? { statusBarStyle: 'dark' as const }
              : {}),
            headerStyle: { backgroundColor: '#F7F8FA' },
            contentStyle: { backgroundColor: '#F7F8FA' },
          }}
        >
          <Stack.Screen
            name="Showcase"
            component={ShowcaseScreen}
            options={{ title: 'Keyflow' }}
          />
          <Stack.Screen
            name="Transparency"
            component={TransparencyScreen}
            options={{
              title: 'Transparency',
              animation: 'none',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="Languages"
            component={LanguageScreen}
            options={{ title: 'English & French' }}
          />
          <Stack.Screen
            name="Layouts"
            component={LayoutsScreen}
            options={{ title: 'Layouts & rotation' }}
          />
          <Stack.Screen
            name="Interactions"
            component={InteractionScreen}
            options={{ title: 'Native interaction tests' }}
          />
          <Stack.Screen
            name="Teardown"
            component={TeardownScreen}
            options={{ title: 'Focused teardown' }}
          />
          <Stack.Screen
            name="ReturnActions"
            component={ReturnActionScreen}
            options={{ title: 'Return actions' }}
          />
          <Stack.Screen
            name="LongPress"
            component={LongPressScreen}
            options={{ title: 'Long press tests' }}
          />
          <Stack.Screen
            name="ProductTheme"
            component={ProductThemeScreen}
            options={{ title: 'Story Studio' }}
          />
          <Stack.Screen
            name="CustomFont"
            component={CustomFontScreen}
            options={{ title: 'Custom app font' }}
          />
          <Stack.Screen
            name="Customization"
            component={CustomizationScreen}
            options={{ title: 'Customize & test' }}
          />
          <Stack.Screen
            name="Transitions"
            component={TransitionScreen}
            options={{ title: 'Keyboard transitions' }}
          />
          <Stack.Screen
            name="Keyboard"
            component={KeyboardScreen}
            options={{ title: 'Keyboard playground' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
