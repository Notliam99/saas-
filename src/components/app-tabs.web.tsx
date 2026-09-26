import { TabList, TabSlot, TabTrigger, Tabs, TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Palette } from '@/components/flat-judge-ui';

export default function AppTabs() {
  return (
    <Tabs style={{ flex: 1, backgroundColor: Palette.paper }}>
      <TabSlot style={{ flex: 1, marginBottom: 82 }} />
      <TabList style={styles.tabList}>
        <TabTrigger name="profiles" href="/" asChild>
          <TabButton icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }}>Profiles</TabButton>
        </TabTrigger>
        <TabTrigger name="court" href="/explore" asChild>
          <TabButton icon={{ ios: 'hammer.fill', android: 'gavel', web: 'gavel' }}>Court</TabButton>
        </TabTrigger>
        <TabTrigger name="info" href="/info" asChild>
          <TabButton icon={{ ios: 'text.book.closed.fill', android: 'menu_book', web: 'menu_book' }}>Info</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

type TabSymbolName = ComponentProps<typeof SymbolView>['name'];

function TabButton({
  children,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & {
  icon: TabSymbolName;
}) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <SymbolView
        name={icon}
        size={19}
        tintColor={isFocused ? Palette.forest : Palette.muted}
        style={styles.tabIcon}
      />
      <Text style={[styles.tabButtonText, isFocused && styles.tabButtonTextSelected]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabList: {
    position: 'absolute',
    right: 16,
    bottom: 10,
    left: 16,
    maxWidth: 520,
    marginHorizontal: 'auto',
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.card,
    boxShadow: '0 4px 18px rgba(29, 41, 38, 0.10)',
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 14,
  },
  tabIcon: { width: 21, height: 21 },
  tabButtonText: { color: Palette.muted, fontSize: 11, fontWeight: '700' },
  tabButtonTextSelected: { color: Palette.forest, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
