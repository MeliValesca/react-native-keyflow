import { useEffect, useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { EaseView } from 'react-native-ease';
export function Submission({ text, color }: { text: string; color: string }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  return (
    <EaseView
      initialAnimate={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduceMotion ? { type: 'none' } : { type: 'timing', duration: 180 }
      }
    >
      <Text accessibilityLiveRegion="polite" style={{ color }}>
        Submitted: {text || '(empty)'}
      </Text>
    </EaseView>
  );
}
