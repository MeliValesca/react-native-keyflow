import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { Button, Platform, Text, TextInput, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyflowAvoidingView } from 'react-native-keyflow';
import { useTransitionTests } from './useTransitionTests';

export function TransitionScreen() {
  const {
    raised,
    setRaised,
    engine,
    frame,
    running,
    status,
    composer,
    baseline,
    baselineFocused,
    bindings,
    run,
  } = useTransitionTests();
  const headerHeight = useHeaderHeight();
  const content = (
    <>
      <View style={{ flex: 1, padding: 20, gap: 8 }}>
        <Text style={{ color: '#192231', fontWeight: '700' }}>
          Transition checks
        </Text>
        <Text style={{ color: '#526174', fontSize: 12 }}>
          Same bottom composer, real keyboard baseline. Measures settled overlap
          and restoration; frame counts expose Android animation updates.
        </Text>
        <Button
          title={`Material: ${raised ? 'Raised' : 'Flat'}`}
          disabled={running}
          onPress={() => setRaised(!raised)}
        />
        <Button
          title={running ? 'Running…' : 'Run transition tests'}
          disabled={running}
          onPress={() => void run()}
        />
        <Text
          testID="transition-result"
          accessibilityLiveRegion="polite"
          numberOfLines={8}
          style={{ color: '#192231', fontSize: 11 }}
        >
          {status}
        </Text>
      </View>
      <View
        ref={composer}
        collapsable={false}
        testID="transition-composer"
        style={{
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 8,
          backgroundColor: '#DFE8F4',
          borderRadius: 12,
        }}
      >
        {engine === 'baseline' ? (
          <TextInput
            ref={baseline}
            onFocus={() => {
              baselineFocused.current = true;
            }}
            onBlur={() => {
              baselineFocused.current = false;
            }}
            defaultValue="Transition"
            accessibilityLabel="Baseline transition input"
            style={{ height: 48, backgroundColor: 'white', color: '#192231' }}
          />
        ) : (
          <ExampleTextInput
            {...bindings}
            defaultValue="Transition"
            accessibilityLabel="Keyflow transition input"
            style={{ height: 48, backgroundColor: 'white' }}
          />
        )}
      </View>
    </>
  );
  return (
    <KeyflowAvoidingView
      keyboardFrame={frame}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      style={{ flex: 1 }}
    >
      {content}
    </KeyflowAvoidingView>
  );
}
