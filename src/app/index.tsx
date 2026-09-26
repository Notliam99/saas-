import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Divider,
  Initials,
  PageHeader,
  Palette,
  Pill,
  Screen,
  SectionHeading,
} from '@/components/flat-judge-ui';

const flatmates = [
  {
    id: 'morgan',
    name: 'Morgan Lee',
    initials: 'ML',
    room: 'Room 1',
    convictions: 2,
    chores: ['Kitchen reset', 'Recycling'],
    nextTask: 'Kitchen reset · Tonight',
    color: '#E9DFCF',
    cases: [
      { title: 'Bins left by the back door', outcome: 'Guilty', tone: 'green' as const },
      { title: 'The mysterious empty milk carton', outcome: 'Not guilty', tone: 'blue' as const },
    ],
  },
  {
    id: 'riley',
    name: 'Riley Chen',
    initials: 'RC',
    room: 'Room 2',
    convictions: 1,
    chores: ['Bathroom', 'Front entry'],
    nextTask: 'Bathroom · Saturday',
    color: '#DCE6DD',
    cases: [{ title: 'Bathroom roster missed', outcome: 'Guilty', tone: 'green' as const }],
  },
  {
    id: 'jamie',
    name: 'Jamie Patel',
    initials: 'JP',
    room: 'Room 3',
    convictions: 0,
    chores: ['Living room', 'Shared meal'],
    nextTask: 'Shared meal · Sunday',
    color: '#E6DDE8',
    cases: [],
  },
];

export default function ProfilesScreen() {
  const [expandedId, setExpandedId] = useState<string | null>('morgan');

  return (
    <Screen>
      <PageHeader
        eyebrow="The Fernery · Flat 4"
        title="Profiles"
        subtitle="Chores, responsibilities, and each flatmate’s court record."
        accessory={<Pill tone="green">3 MEMBERS</Pill>}
      />

      <Card style={styles.houseCard}>
        <View style={styles.houseIcon}>
          <Text style={styles.houseIconText}>⌂</Text>
        </View>
        <View style={styles.houseCopy}>
          <Text style={styles.houseTitle}>The Fernery</Text>
          <Text style={styles.houseDescription}>Shared house · Christchurch</Text>
        </View>
        <View style={styles.houseStat}>
          <Text style={styles.statNumber}>03</Text>
          <Text style={styles.statCaption}>open cases</Text>
        </View>
      </Card>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Flatmates" detail="Tap a profile to view record" />
        <View style={styles.profileList}>
          {flatmates.map((person) => {
            const expanded = expandedId === person.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                key={person.id}
                onPress={() => setExpandedId(expanded ? null : person.id)}
                style={({ pressed }) => [styles.profilePressable, pressed && styles.pressed]}>
                <Card style={styles.profileCard}>
                  <View style={styles.profileTop}>
                    <Initials label={person.initials} color={person.color} />
                    <View style={styles.profileIdentity}>
                      <Text style={styles.name}>{person.name}</Text>
                      <Text style={styles.room}>{person.room}</Text>
                    </View>
                    <View style={styles.recordCount}>
                      <Text style={styles.recordNumber}>{person.convictions}</Text>
                      <Text style={styles.recordLabel}>convictions</Text>
                    </View>
                  </View>

                  <View style={styles.choreRow}>
                    {person.chores.map((chore) => (
                      <Pill key={chore}>{chore}</Pill>
                    ))}
                  </View>

                  <View style={styles.nextTaskRow}>
                    <Text style={styles.nextTaskLabel}>NEXT UP</Text>
                    <Text style={styles.nextTask}>{person.nextTask}</Text>
                  </View>

                  {expanded ? (
                    <View style={styles.recordDetails}>
                      <Divider />
                      <Text style={styles.recordHeading}>CRIMINAL RECORD</Text>
                      {person.cases.length ? (
                        person.cases.map((item) => (
                          <View key={item.title} style={styles.caseRow}>
                            <Text style={styles.caseTitle}>{item.title}</Text>
                            <Pill tone={item.tone}>{item.outcome}</Pill>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyRecord}>No past trials. A spotless ledger.</Text>
                      )}
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={styles.noticeCard}>
        <View style={styles.noticeMark}>
          <Text style={styles.noticeMarkText}>i</Text>
        </View>
        <Text style={styles.noticeText}>
          Chore assignments are the household’s shared source of truth. Past case records are
          preserved when responsibilities change.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  houseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.forest,
    borderColor: Palette.forest,
    padding: 16,
  },
  houseIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  houseIconText: { color: '#FFFFFF', fontSize: 31, fontWeight: '500', lineHeight: 36 },
  houseCopy: { flex: 1, gap: 4, marginLeft: 12 },
  houseTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  houseDescription: { color: '#D6E5DC', fontSize: 12 },
  houseStat: { alignItems: 'flex-end' },
  statNumber: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  statCaption: { color: '#D6E5DC', fontSize: 10 },
  sectionBlock: { gap: 13 },
  profileList: { gap: 12 },
  profilePressable: { borderRadius: 20 },
  profileCard: { gap: 14, padding: 15 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileIdentity: { flex: 1, gap: 4 },
  name: { color: Palette.ink, fontSize: 16, fontWeight: '800' },
  room: { color: Palette.muted, fontSize: 12 },
  recordCount: {
    alignItems: 'center',
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Palette.amberSoft,
  },
  recordNumber: { color: Palette.ink, fontSize: 17, fontWeight: '900' },
  recordLabel: { color: Palette.muted, fontSize: 9, fontWeight: '700' },
  choreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  nextTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingTop: 2,
  },
  nextTaskLabel: { color: Palette.forest, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  nextTask: { color: Palette.muted, fontSize: 11, fontWeight: '600' },
  recordDetails: { gap: 10, paddingTop: 1 },
  recordHeading: { color: Palette.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  caseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  caseTitle: { flex: 1, color: Palette.ink, fontSize: 12, fontWeight: '600' },
  emptyRecord: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  noticeCard: { flexDirection: 'row', gap: 11, padding: 14, backgroundColor: '#F0EDE4' },
  noticeMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.forestSoft,
  },
  noticeMarkText: { color: Palette.forest, fontWeight: '900', fontSize: 13 },
  noticeText: { flex: 1, color: Palette.muted, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.88 },
});
