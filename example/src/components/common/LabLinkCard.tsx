import { Pressable, Text, View } from 'react-native';
import { labTheme } from '../../constants/labTheme';

export function LabLinkCard({
  eyebrow,
  title,
  description,
  sample,
  accessibilityLabel,
  color = labTheme.surface,
  ink = labTheme.ink,
  onPress,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sample: string;
  accessibilityLabel?: string;
  color?: string;
  ink?: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 132,
        padding: 18,
        gap: 10,
        borderRadius: labTheme.radius,
        borderWidth: 1,
        borderColor: color === labTheme.surface ? labTheme.border : color,
        backgroundColor: color,
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{
            color: ink,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1,
          }}
        >
          {eyebrow.toUpperCase()}
        </Text>
        <View
          style={{ height: 1, flex: 1, backgroundColor: ink, opacity: 0.18 }}
        />
        <Text style={{ color: ink, fontSize: 18 }}>→</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {sample.split(' ').map((key, index) => (
          <View
            key={`${key}-${index}`}
            style={{
              minWidth: 26,
              padding: 6,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: '#FFFFFFA8',
            }}
          >
            <Text
              style={{ color: labTheme.ink, fontSize: 11, fontWeight: '700' }}
            >
              {key}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: ink, fontSize: 21, fontWeight: '700' }}>
        {title}
      </Text>
      <Text style={{ color: ink, opacity: 0.78, lineHeight: 20 }}>
        {description}
      </Text>
    </Pressable>
  );
}
