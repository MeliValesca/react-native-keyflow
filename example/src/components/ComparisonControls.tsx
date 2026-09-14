import { Platform, Pressable, Switch, Text, View } from 'react-native';
export function ComparisonControls({
  compact = false,
  mode,
  dark,
  onModeChange,
  onDarkChange,
}: {
  compact?: boolean;
  mode: 'custom' | 'system';
  dark: boolean;
  onModeChange: (mode: 'custom' | 'system') => void;
  onDarkChange: (dark: boolean) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#E3E8F0',
          padding: 4,
          borderRadius: 12,
        }}
      >
        {(['custom', 'system'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === value }}
            onPress={() => onModeChange(value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9,
              backgroundColor: mode === value ? '#FFFFFF' : 'transparent',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: '#192231', fontWeight: '600' }}>
              {value === 'custom'
                ? 'Keyflow keyboard'
                : Platform.OS === 'ios'
                ? 'Apple keyboard'
                : 'System keyboard'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#192231' }}>
          {Platform.OS === 'ios'
            ? 'Dark appearance for both keyboards'
            : 'Dark Keyflow keyboard'}
        </Text>
        <Switch
          accessibilityLabel="Dark keyboard"
          value={dark}
          onValueChange={onDarkChange}
        />
      </View>
      {Platform.OS === 'android' && !compact && (
        <Text style={{ color: '#526174', fontSize: 12 }}>
          System keyboard appearance follows your keyboard’s settings.
        </Text>
      )}
    </View>
  );
}
