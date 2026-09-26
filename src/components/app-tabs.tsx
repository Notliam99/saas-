import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/components/flat-judge-ui';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Palette.card}
      disableTransparentOnScrollEdge
      iconColor={{ default: Palette.muted, selected: Palette.forest }}
      indicatorColor={Palette.forestSoft}
      labelStyle={{
        default: { color: Palette.muted },
        selected: { color: Palette.forest, fontWeight: '700' },
      }}
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Profiles</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="people" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Court</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="hammer.fill" md="gavel" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="info">
        <NativeTabs.Trigger.Label>Info</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="text.book.closed.fill" md="menu_book" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
