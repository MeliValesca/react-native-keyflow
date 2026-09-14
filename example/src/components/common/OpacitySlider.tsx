import { useState } from 'react';
import { Text, View } from 'react-native';

/** A continuous, keyboard-safe slider with a 44-point touch area. */
export function OpacitySlider({
  value,
  onChange,
  label = 'Opacity',
  accessibilityLabel = 'Background opacity',
}: {
  value: number;
  onChange(value: number): void;
  accessibilityLabel?: string;
  label?: string;
}) {
  const [width, setWidth] = useState(0);
  const percent = Math.round(value * 100);
  const trackWidth = Math.max(0, width - 28);
  const update = (x: number) => {
    if (trackWidth)
      onChange(
        Math.round(Math.max(0, Math.min(1, (x - 14) / trackWidth)) * 100) / 100,
      );
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#FFFFFFDD',
      }}
    >
      <Text
        accessible={false}
        style={{ width: 78, color: '#102D46', fontWeight: '600', fontSize: 12 }}
      >
        {label}
      </Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: percent,
          text: `${percent}%`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase opacity' },
          { name: 'decrement', label: 'Decrease opacity' },
        ]}
        onAccessibilityAction={({ nativeEvent }) =>
          onChange(
            Math.max(
              0,
              Math.min(
                1,
                value + (nativeEvent.actionName === 'increment' ? 0.05 : -0.05),
              ),
            ),
          )
        }
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={({ nativeEvent }) => update(nativeEvent.locationX)}
        onResponderMove={({ nativeEvent }) => update(nativeEvent.locationX)}
        onResponderRelease={({ nativeEvent }) => update(nativeEvent.locationX)}
        style={{ flex: 1, height: 44, justifyContent: 'center' }}
      >
        <View
          pointerEvents="none"
          style={{
            height: 4,
            marginHorizontal: 14,
            borderRadius: 2,
            backgroundColor: '#B5C6CD',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 14,
            top: 20,
            width: trackWidth * value,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#246279',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: trackWidth * value,
            top: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#246279',
            shadowColor: '#102D46',
            shadowOpacity: 0.12,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
          }}
        />
      </View>
      <Text
        accessible={false}
        style={{
          width: 36,
          color: '#102D46',
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
          fontSize: 12,
        }}
      >
        {percent}%
      </Text>
    </View>
  );
}
