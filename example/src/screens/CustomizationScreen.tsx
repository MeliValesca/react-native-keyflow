import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { useCustomizationTests } from './useCustomizationTests';
import { useFonts } from 'expo-font';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyflowAvoidingView,
  KeyflowKeyboard,
  createKeyboardTheme,
} from 'react-native-keyflow';
import type { KeyboardThemeOverrides } from 'react-native-keyflow';
import {
  customizationCases,
  customizationFonts,
  customizationMaterials,
  customizationVisuals,
} from '../testing/customizationCases';
const types = [
  { label: 'QWERTY', value: 'default' },
  { label: 'Number', value: 'number-pad' },
  { label: 'Decimal', value: 'decimal-pad' },
  { label: 'Phone', value: 'phone-pad' },
] as const;
const focusStyles = {
  native: {},
  plum: {
    preview: { background: '#F4F0FF', color: '#342B62' },
    selection: { background: '#733A91', color: '#FFFFFF' },
  },
  mint: {
    preview: { background: '#173E42', color: '#E1F7F1' },
    selection: { background: '#A8E6CF', color: '#123B32' },
  },
} satisfies Record<string, KeyboardThemeOverrides>;

export function CustomizationScreen() {
  const [loaded, error] = useFonts({
    KeyflowDemoMono: require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
  });
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();
  const header = useHeaderHeight();
  const {
    input,
    theme,
    type,
    setType,
    frame,
    setFrame,
    running,
    status,
    report,
    setReport,
    diagnostic,
    visual,
    setVisual,
    change,
    inspect,
    run,
  } = useCustomizationTests(loaded, landscape);
  const option = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: running }}
      disabled={running}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        minHeight: landscape ? 36 : 44,
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: selected ? '#192231' : '#E4EAF2',
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ color: selected ? '#FFFFFF' : '#192231' }}>{label}</Text>
    </Pressable>
  );
  if (!loaded)
    return <Text>{error ? String(error) : 'Loading example font…'}</Text>;
  return (
    <View style={{ flex: 1 }}>
      <Image
        source={require('../../assets/backdrops/coast.jpg')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      <KeyflowAvoidingView
        style={{ flex: 1 }}
        keyboardFrame={frame}
        keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
      >
        <View
          style={{
            padding: landscape ? 4 : 12,
            paddingLeft: Math.max(landscape ? 4 : 12, insets.left),
            paddingRight: Math.max(landscape ? 4 : 12, insets.right),
            gap: 4,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {types.map((t) =>
              option(t.label, type === t.value, () => {
                setType(t.value);
                setReport(null);
                void input.current?.focus();
              }),
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <KeyflowKeyboard
              ref={input}
              keyboardType={type}
              keyboardTheme={theme}
              onKeyboardFrameChange={setFrame}
              renderInput={(bindings) => (
                <ExampleTextInput
                  {...bindings}
                  keyboardType={type}
                  accessibilityLabel="Font customization input"
                  placeholder="Try your keyboard…"
                  style={{
                    flex: 1,
                    height: landscape ? 36 : 44,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                  }}
                />
              )}
            />
            <Pressable
              testID="customization-probe"
              accessibilityRole="button"
              accessibilityLabel={`Inspect customization${
                diagnostic ? `: ${JSON.stringify(diagnostic)}` : ''
              }`}
              onPress={() => void inspect()}
              style={{
                justifyContent: 'center',
                paddingHorizontal: 8,
                backgroundColor: '#DFE8F4',
                borderRadius: 8,
              }}
            >
              <Text>Check</Text>
            </Pressable>
            <Pressable
              testID="customization-run"
              accessibilityRole="button"
              accessibilityLabel={`Test customization boundaries${
                report ? `: ${JSON.stringify(report)}` : ''
              }`}
              disabled={running}
              onPress={() => void run()}
              style={{
                justifyContent: 'center',
                paddingHorizontal: 8,
                backgroundColor: '#DFE8F4',
                borderRadius: 8,
                opacity: running ? 0.6 : 1,
              }}
            >
              <Text>
                {running ? 'Testing…' : `Run ${customizationCases.length}`}
              </Text>
            </Pressable>
            <Pressable
              testID="customization-visual"
              accessibilityRole="button"
              accessibilityLabel="Next visual theme"
              disabled={running}
              onPress={() => {
                const n = (visual + 1) % customizationVisuals.length;
                setVisual(n);
                change(customizationVisuals[n]!.theme);
              }}
              style={{
                justifyContent: 'center',
                paddingHorizontal: 8,
                backgroundColor: '#DFE8F4',
                borderRadius: 8,
              }}
            >
              <Text>{customizationVisuals[visual]?.name ?? 'Themes'}</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, gap: 8 }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: '#192231',
              backgroundColor: '#FFFFFFDD',
              fontSize: 12,
            }}
          >
            {status}
          </Text>
          {type === 'default' && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#192231', backgroundColor: '#FFFFFFDD' }}>
                Long-press focus — hold a letter, then drag across its accents.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(focusStyles) as (keyof typeof focusStyles)[]).map(
                  (name) =>
                    option(
                      `${
                        name === 'native'
                          ? 'Default'
                          : name === 'plum'
                          ? 'Plum'
                          : 'Mint'
                      } focus`,
                      name === 'native'
                        ? !theme.sectionOverrides?.selection?.background
                        : theme.sectionOverrides?.selection?.background ===
                            focusStyles[name].selection.background,
                      () => {
                        const { preview, selection, ...sections } =
                          theme.sectionOverrides ?? {};
                        change(
                          createKeyboardTheme(focusStyles[name], {
                            ...theme,
                            sectionOverrides: sections,
                          }),
                        );
                      },
                    ),
                )}
              </View>
            </View>
          )}
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {customizationFonts.map((f) =>
              option(f.label, theme.fontFamily === f.family, () =>
                change(createKeyboardTheme({ fontFamily: f.family }, theme)),
              ),
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[12, 22, 32].map((size) =>
              option(`${size} pt`, theme.fontSize === size, () =>
                change(createKeyboardTheme({ fontSize: size }, theme)),
              ),
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['flat', 'raised'] as const).map((m) =>
              option(m, theme.material.type === m, () =>
                change(
                  createKeyboardTheme(
                    { fontFamily: theme.fontFamily, fontSize: theme.fontSize },
                    customizationMaterials[m],
                  ),
                ),
              ),
            )}
          </View>
        </ScrollView>
      </KeyflowAvoidingView>
    </View>
  );
}
