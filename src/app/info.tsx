import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Card,
  Divider,
  FormField,
  PageHeader,
  Palette,
  Pill,
  Screen,
  SectionHeading,
} from '@/components/flat-judge-ui';

const trials = [
  {
    id: 'case-218',
    title: 'Bins left by the back door',
    person: 'Morgan Lee',
    result: 'Guilty',
    punishment: 'One additional recycling run',
    date: '12 Sep',
    tone: 'green' as const,
  },
  {
    id: 'case-214',
    title: 'Early morning kitchen noise',
    person: 'Riley Chen',
    result: 'Mistrial',
    punishment: 'No punishment',
    date: '04 Sep',
    tone: 'amber' as const,
  },
  {
    id: 'case-209',
    title: 'The mysterious empty milk carton',
    person: 'Morgan Lee',
    result: 'Not guilty',
    punishment: 'No punishment',
    date: '28 Aug',
    tone: 'blue' as const,
  },
];

const startingPunishments = [
  { level: '1', title: 'Dish duty', detail: 'Wash and put away the dishes after one shared meal.' },
  { level: '2', title: 'Bins and recycling', detail: 'Take out the bins and return them after collection.' },
  { level: '3', title: 'One extra chore', detail: 'Complete one additional chore from the household rota.' },
  { level: '4', title: 'Cover a chore for a week', detail: 'Take over one flatmate’s agreed chore for seven days.' },
  { level: '5', title: 'Cook for the flat', detail: 'Plan and cook one shared meal for the household.' },
  { level: '6', title: 'Common-area reset', detail: 'Deep clean one agreed shared area.' },
  { level: '7', title: 'Three-day chore run', detail: 'Complete one extra, reasonable chore each day for three days.' },
  { level: '8', title: 'Two rota turns', detail: 'Take the next two turns of one shared household chore.' },
  { level: '9', title: 'Weekly shared-space care', detail: 'Keep one agreed common area tidy for the coming week.' },
  {
    level: '10',
    title: 'Household service week',
    detail: 'Take one extra rota chore each day for a week, within agreed limits.',
  },
];

export default function InfoScreen() {
  const [punishments, setPunishments] = useState(startingPunishments);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newLevel, setNewLevel] = useState('3');

  const addPunishment = () => {
    if (!newTitle.trim() || !newDetail.trim()) return;
    setPunishments((current) => [
      { level: newLevel, title: newTitle.trim(), detail: newDetail.trim() },
      ...current,
    ]);
    setNewTitle('');
    setNewDetail('');
    setNewLevel('3');
    setAddFormOpen(false);
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="The Fernery · Archive"
        title="Court record"
        subtitle="Past trials and the household’s scale of consequences."
        accessory={<Pill tone="green">FLAT 4</Pill>}
      />

      <Card style={styles.archiveCard}>
        <View style={styles.archiveHeadline}>
          <View style={styles.archiveIcon}>
            <Text style={styles.archiveIconText}>§</Text>
          </View>
          <View style={styles.archiveCopy}>
            <Text style={styles.archiveTitle}>The household ledger</Text>
            <Text style={styles.archiveSubtitle}>Final decisions are kept in the flat record.</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>TRIALS</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>CONVICTIONS</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>MISTRIALS</Text>
          </View>
        </View>
      </Card>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Past trials" detail="Most recent first" />
        <Card style={styles.trialsCard}>
          {trials.map((trial, index) => (
            <View key={trial.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.trial}>
                <View style={styles.trialHeader}>
                  <View style={styles.trialCopy}>
                    <Text style={styles.trialTitle}>{trial.title}</Text>
                    <Text style={styles.trialMeta}>{trial.person} · {trial.date}</Text>
                  </View>
                  <Pill tone={trial.tone}>{trial.result.toUpperCase()}</Pill>
                </View>
                <View style={styles.trialFooter}>
                  <Text style={styles.punishmentText}>{trial.punishment}</Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
        <Text style={styles.archiveNote}>
          Mistrials and not-guilty decisions remain in the archive but do not count as convictions.
        </Text>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Punishment scale" detail="1 · light — 10 · serious" />
        <Text style={styles.scaleIntro}>
          The AI Judge chooses a consequence from the household list after deciding the case.
          Flatmates can customise the list within safe, reasonable limits.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAddFormOpen(!addFormOpen)}
          style={({ pressed }) => [styles.addPunishmentButton, pressed && styles.pressed]}>
          <Text style={styles.addPunishmentText}>{addFormOpen ? 'Close form' : '＋ Add a household punishment'}</Text>
        </Pressable>
        {addFormOpen ? (
          <Card style={styles.editorCard}>
            <Text style={styles.editorTitle}>Add a custom option</Text>
            <FormField
              label="Punishment name"
              onChangeText={setNewTitle}
              placeholder="For example, take the next dishes turn"
              value={newTitle}
            />
            <FormField
              label="What it involves"
              multiline
              onChangeText={setNewDetail}
              placeholder="Keep it practical, safe, and household-focused."
              value={newDetail}
            />
            <Text style={styles.fieldLabel}>Punishment level</Text>
            <View style={styles.levelPicker}>
              {Array.from({ length: 10 }, (_, index) => String(index + 1)).map((level) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: newLevel === level }}
                  key={level}
                  onPress={() => setNewLevel(level)}
                  style={[styles.levelChoice, newLevel === level && styles.levelChoiceSelected]}>
                  <Text style={[styles.levelChoiceText, newLevel === level && styles.levelChoiceTextSelected]}>
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.editorNote}>Household chores only; no harmful or financial penalties.</Text>
            <ActionButton
              disabled={!newTitle.trim() || !newDetail.trim()}
              label="Add to punishment list"
              onPress={addPunishment}
            />
          </Card>
        ) : null}
        <View style={styles.punishmentList}>
          {punishments.map((punishment, index) => (
            <Card key={`${punishment.title}-${index}`} style={styles.punishmentCard}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelNumber}>{punishment.level}</Text>
              </View>
              <View style={styles.punishmentCopy}>
                <Text style={styles.punishmentTitle}>{punishment.title}</Text>
                <Text style={styles.punishmentDetail}>{punishment.detail}</Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <Card style={styles.footerCard}>
        <Text style={styles.footerTitle}>Evidence privacy</Text>
        <Text style={styles.footerText}>
          Case photos are visible to flat members and are scheduled for deletion after 14 days.
          Final rulings stay in the household record.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  archiveCard: { backgroundColor: Palette.forest, borderColor: Palette.forest, padding: 17 },
  archiveHeadline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  archiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  archiveIconText: { color: '#FFFFFF', fontSize: 23, fontWeight: '700' },
  archiveCopy: { flex: 1, gap: 4 },
  archiveTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  archiveSubtitle: { color: '#D6E5DC', fontSize: 11, lineHeight: 16 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    paddingTop: 15,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderTopWidth: 1,
  },
  statCell: { alignItems: 'flex-start', gap: 3 },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#D6E5DC', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  sectionBlock: { gap: 11 },
  trialsCard: { padding: 15 },
  trial: { gap: 11, paddingVertical: 11 },
  trialHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  trialCopy: { flex: 1, gap: 4 },
  trialTitle: { color: Palette.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  trialMeta: { color: Palette.muted, fontSize: 11 },
  trialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  punishmentText: { flex: 1, color: Palette.muted, fontSize: 11, lineHeight: 16 },
  archiveNote: { color: Palette.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 2 },
  scaleIntro: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  addPunishmentButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#B7C7BA',
    backgroundColor: Palette.forestSoft,
  },
  addPunishmentText: { color: Palette.forest, fontSize: 12, fontWeight: '800' },
  editorCard: { gap: 13, borderColor: '#B7C7BA' },
  editorTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  fieldLabel: { color: Palette.ink, fontSize: 13, fontWeight: '800' },
  levelPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  levelChoice: {
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: '#FAF8F2',
  },
  levelChoiceSelected: { backgroundColor: Palette.forest, borderColor: Palette.forest },
  levelChoiceText: { color: Palette.muted, fontSize: 12, fontWeight: '800' },
  levelChoiceTextSelected: { color: '#FFFFFF' },
  editorNote: { color: Palette.muted, fontSize: 10, lineHeight: 15 },
  punishmentList: { gap: 8 },
  punishmentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16 },
  levelBadge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.amberSoft,
  },
  levelNumber: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  punishmentCopy: { flex: 1, gap: 3 },
  punishmentTitle: { color: Palette.ink, fontSize: 12, fontWeight: '800' },
  punishmentDetail: { color: Palette.muted, fontSize: 11, lineHeight: 16 },
  footerCard: { backgroundColor: '#F0EDE4' },
  footerTitle: { color: Palette.ink, fontSize: 13, fontWeight: '900' },
  footerText: { color: Palette.muted, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.78 },
});
