import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { EaseView } from 'react-native-ease';

export function ComparisonTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string; accessibilityLabel?: string }[];
  onChange(value: T): void;
}) {
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => listener.remove();
  }, []);
  const itemWidth = Math.max(0, width - 8) / options.length;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        padding: 4,
        borderRadius: 14,
        backgroundColor: '#E7DFC9',
        flexDirection: 'row',
      }}
    >
      <EaseView
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: 4,
          width: itemWidth,
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
        }}
        animate={{
          translateX:
            options.findIndex((option) => option.value === value) * itemWidth,
        }}
        transition={
          reduceMotion
            ? { type: 'none' }
            : { type: 'timing', duration: 180, easing: 'easeOut' }
        }
      />
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityLabel={option.accessibilityLabel ?? option.label}
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#003C69' }}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
