import type { PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const Palette = {
  paper: '#F5F1E8',
  card: '#FFFEFA',
  ink: '#1D2926',
  muted: '#707873',
  line: '#E5DFD3',
  forest: '#235548',
  forestSoft: '#E0EBE4',
  amber: '#E9B15C',
  amberSoft: '#F7ECD9',
  rose: '#A85242',
  roseSoft: '#F5E6E1',
  blueSoft: '#E5EBF0',
};

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  accessory,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  accessory?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {accessory}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeading({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'neutral' | 'green' | 'amber' | 'rose' | 'blue' }>) {
  const toneStyle = {
    neutral: styles.pillNeutral,
    green: styles.pillGreen,
    amber: styles.pillAmber,
    rose: styles.pillRose,
    blue: styles.pillBlue,
  }[tone];

  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Palette.muted}
        style={[styles.input, multiline && styles.multilineInput]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Initials({
  label,
  color = Palette.forestSoft,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View style={[styles.initials, { backgroundColor: color }]}>
      <Text style={styles.initialsText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.paper,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    gap: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerText: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    color: Palette.forest,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: Palette.ink,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    padding: 17,
    gap: 14,
    backgroundColor: Palette.card,
    borderColor: Palette.line,
    borderWidth: 1,
    borderRadius: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: Palette.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  sectionDetail: {
    color: Palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  pillNeutral: { backgroundColor: '#ECEAE4' },
  pillGreen: { backgroundColor: Palette.forestSoft },
  pillAmber: { backgroundColor: Palette.amberSoft },
  pillRose: { backgroundColor: Palette.roseSoft },
  pillBlue: { backgroundColor: Palette.blueSoft },
  pillText: {
    color: Palette.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actionButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.forest,
    borderRadius: 15,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    color: Palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.ink,
    fontSize: 15,
    backgroundColor: '#FAF8F2',
    borderColor: Palette.line,
    borderWidth: 1,
    borderRadius: 13,
  },
  multilineInput: {
    minHeight: 108,
    lineHeight: 21,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.line,
  },
  initials: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Palette.forest,
    fontSize: 16,
    fontWeight: '900',
  },
});
