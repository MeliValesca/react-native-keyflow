import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Routes } from '../App';
import { LabLinkCard } from '../components/common/LabLinkCard';
import { labTheme } from '../constants/labTheme';

const sections = [
  {
    title: 'Behavior',
    description: 'Each screen isolates one interaction family.',
    cards: [
      {
        route: 'Interactions',
        accessibilityLabel: 'Compare native interactions',
        eyebrow: 'Typing · cursor · delete',
        title: 'Native interactions',
        description:
          'Compare editing, selection, shift and held delete with the system keyboard.',
        sample: 'A a ⌫',
        color: '#EAF1FF',
      },
      {
        route: 'LongPress',
        accessibilityLabel: 'Test long press behavior',
        eyebrow: 'Press · hold · drag',
        title: 'Long press behavior',
        description:
          'Test previews, accents, cancellation and repeated deletion independently.',
        sample: 'E É È',
        color: '#F3ECFF',
      },
      {
        route: 'Transitions',
        accessibilityLabel: 'Test keyboard transitions',
        eyebrow: 'Show · hide · interrupt',
        title: 'Keyboard transitions',
        description:
          'Measure avoidance, restoration and animation frames against the native baseline.',
        sample: '↑ · ↓',
        color: '#E9F6F1',
      },
      {
        route: 'Teardown',
        accessibilityLabel: 'Test focused teardown',
        eyebrow: 'Focus · close · unmount',
        title: 'Focused teardown',
        description:
          'Close a focused preview and unmount its entire Keyflow hook.',
        sample: '×',
        color: '#EAF1FF',
      },
    ],
  },
  {
    title: 'Layouts',
    description: 'Verify one layout or language configuration at a time.',
    cards: [
      {
        route: 'Layouts',
        accessibilityLabel: 'Compare layouts & rotation',
        eyebrow: 'Phone · tablet · rotation',
        title: 'Layouts and rotation',
        description:
          'Compare QWERTY and each number pad in portrait and landscape.',
        sample: 'Q 1 #',
        color: '#FFF2E8',
      },
      {
        route: 'Languages',
        accessibilityLabel: 'English & French keyboards',
        eyebrow: 'English · Français',
        title: 'Language layouts',
        description:
          'Check QWERTY, AZERTY, accents and the globe switch without suggestions.',
        sample: 'Q A É',
        color: '#EDF2FF',
      },
    ],
  },
  {
    title: 'Appearance',
    description:
      'Stress-test customization without changing keyboard geometry.',
    cards: [
      {
        route: 'Customization',
        accessibilityLabel: 'Customize fonts & test layouts',
        eyebrow: 'Colors · materials · sizing',
        title: 'Customization matrix',
        description:
          'Run fonts, opacity, radii and flat or raised material as atomic cases.',
        sample: 'Aa ◐ ◼',
        color: '#F6EEFF',
      },
    ],
  },
] as const;

export function ShowcaseScreen({
  navigation,
}: NativeStackScreenProps<Routes, 'Showcase'>) {
  return (
    <ScrollView
      style={{ backgroundColor: labTheme.background }}
      contentContainerStyle={{
        padding: labTheme.spacing,
        gap: 24,
        paddingBottom: 48,
      }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: labTheme.ink }}>
          Keyboard lab
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: labTheme.muted }}>
          Open one focused test, follow its instruction, and compare the result.
        </Text>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 20, fontWeight: '700', color: labTheme.ink }}
            >
              {section.title}
            </Text>
            <Text
              style={{ fontSize: 14, lineHeight: 20, color: labTheme.muted }}
            >
              {section.description}
            </Text>
          </View>
          {section.cards.map((card) => (
            <LabLinkCard
              key={card.route}
              {...card}
              onPress={() => navigation.navigate(card.route)}
            />
          ))}
        </View>
      ))}
      <View style={{ gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: '700', color: labTheme.ink }}
        >
          Theme showcases
        </Text>
        <LabLinkCard
          eyebrow="Platform defaults"
          title="Feels familiar"
          accessibilityLabel="Feels familiar."
          description="Compare Keyflow light and dark styles with your installed keyboard."
          sample="Q W E"
          color="#E4EAF2"
          onPress={() => navigation.navigate('Keyboard', { preset: 'native' })}
        />
        <LabLinkCard
          eyebrow="Original app theme"
          title="Multiline notes"
          accessibilityLabel="Try multiline notes"
          description="Write paragraphs, insert newlines, and move the cursor across wrapped lines in Keyflow or the system keyboard."
          sample="↔ ↕"
          color="#E9F6F1"
          onPress={() =>
            navigation.navigate('Keyboard', { preset: 'multiline' })
          }
        />
        <LabLinkCard
          eyebrow="Original app theme"
          title="Story Studio"
          description="A polished plum, rose and aqua keyboard inside a real note-writing screen."
          sample="S T O R Y"
          color="#342B62"
          ink="#FFFFFF"
          onPress={() => navigation.navigate('ProductTheme')}
        />
        <LabLinkCard
          eyebrow="Bundled typeface"
          title="Your app. Your type."
          accessibilityLabel="Your app. Your type."
          description="Use Quicksand on every key and test three font weights."
          sample="Q U I C K"
          color="#F0EBDD"
          onPress={() => navigation.navigate('CustomFont')}
        />
        <LabLinkCard
          eyebrow="Independent opacity"
          title="Make room for your style"
          accessibilityLabel="Make room for your style."
          description="Adjust keyboard and key opacity separately over an app background."
          sample="C L E A R"
          color="#C7DDEB"
          onPress={() => navigation.navigate('Transparency')}
        />
      </View>
    </ScrollView>
  );
}
