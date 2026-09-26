import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Card,
  FormField,
  Initials,
  PageHeader,
  Palette,
  Pill,
  Screen,
  SectionHeading,
} from '@/components/flat-judge-ui';

const flatmates = [
  { id: 'morgan', name: 'Morgan Lee', initials: 'ML', color: '#E9DFCF' },
  { id: 'riley', name: 'Riley Chen', initials: 'RC', color: '#DCE6DD' },
  { id: 'jamie', name: 'Jamie Patel', initials: 'JP', color: '#E6DDE8' },
];

const charges = ['Missed chore', 'Noise', 'Shared space', 'Property damage', 'Other'];

type ConvictionNotice = {
  accusedId: string;
  prosecutorId: string;
  charge: string;
  allegation: string;
  statement: string;
  evidenceNotes: string;
};

export default function CourtScreen() {
  const [currentAccount, setCurrentAccount] = useState('morgan');
  const [accusedId, setAccusedId] = useState('riley');
  const [charge, setCharge] = useState('Missed chore');
  const [allegation, setAllegation] = useState('');
  const [prosecutorStatement, setProsecutorStatement] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  // Prototype limit: only one ticket is held here. Replace with per-user database records so more can be filed after accounts and storage are implemented.
  const [conviction, setConviction] = useState<ConvictionNotice | null>(null);
  const [defense, setDefense] = useState('');
  const [defenseEvidence, setDefenseEvidence] = useState('');
  const [defenseSubmitted, setDefenseSubmitted] = useState(false);
  const [judgmentRequested, setJudgmentRequested] = useState(false);

  const activeMember = flatmates.find((person) => person.id === currentAccount) ?? flatmates[0];
  const availableAccused = flatmates.filter((person) => person.id !== currentAccount);
  const selectedAccused = availableAccused.find((person) => person.id === accusedId) ?? availableAccused[0];
  const isDefendant = conviction?.accusedId === currentAccount;
  const isProsecutor = conviction?.prosecutorId === currentAccount;

  const fileConviction = () => {
    if (!allegation.trim() || !prosecutorStatement.trim()) return;
    setConviction({
      accusedId: selectedAccused.id,
      prosecutorId: currentAccount,
      charge,
      allegation: allegation.trim(),
      statement: prosecutorStatement.trim(),
      evidenceNotes: evidenceNotes.trim(),
    });
    setDefense('');
    setDefenseEvidence('');
    setDefenseSubmitted(false);
    setJudgmentRequested(false);
  };

  const resetDemo = () => {
    setConviction(null);
    setAllegation('');
    setProsecutorStatement('');
    setEvidenceNotes('');
    setDefense('');
    setDefenseEvidence('');
    setDefenseSubmitted(false);
    setJudgmentRequested(false);
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="The Fernery · Courtroom"
        title="Court"
        subtitle="File a conviction notice, hear the defense, then send both sides to the AI Judge."
        accessory={<Pill tone="amber">AI FINAL</Pill>}
      />

      <Card style={styles.accountCard}>
        <View style={styles.accountHeading}>
          <View style={styles.accountIcon}>
            <Text style={styles.accountIconText}>◉</Text>
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Viewing as {activeMember.name}</Text>
            <Text style={styles.accountNote}>Switch accounts to preview each person’s view.</Text>
          </View>
          <Pill tone="blue">DEMO</Pill>
        </View>
        <View style={styles.accountPicker}>
          {flatmates.map((person) => {
            const selected = currentAccount === person.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={person.id}
                onPress={() => setCurrentAccount(person.id)}
                style={[styles.accountOption, selected && styles.accountOptionSelected]}>
                <Text style={[styles.accountOptionText, selected && styles.accountOptionTextSelected]}>
                  {person.name.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {!conviction || (isProsecutor && !isDefendant) ? (
        <>
          {conviction ? (
            <Card style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Pill tone={defenseSubmitted ? 'green' : 'amber'}>
                  {judgmentRequested ? 'READY FOR AI' : defenseSubmitted ? 'DEFENSE RECEIVED' : 'AWAITING DEFENSE'}
                </Pill>
                <Text style={styles.statusMeta}>Filed against {flatmates.find((person) => person.id === conviction.accusedId)?.name}</Text>
              </View>
              <Text style={styles.statusTitle}>{conviction.allegation}</Text>
              <Text style={styles.statusCopy}>
                {defenseSubmitted
                  ? 'The defense has been added to the case. Both accounts can review the case before requesting the final AI ruling.'
                  : 'The notice is on the accused flatmate’s account. They can add a defense before the AI Judge makes a final ruling.'}
              </Text>
              {defenseSubmitted ? (
                <View style={styles.responsePreview}>
                  <Text style={styles.responseLabel}>DEFENSE</Text>
                  <Text style={styles.responseText}>{defense}</Text>
                </View>
              ) : null}
              {judgmentRequested ? (
                <Text style={styles.aiNotice}>
                  The AI Judge connection is not enabled in this prototype; the case is ready for that final review.
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={resetDemo}
                style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
                <Text style={styles.resetButtonText}>Start a new demo case</Text>
              </Pressable>
            </Card>
          ) : null}

          {!conviction ? (
            <View style={styles.sectionBlock}>
              <SectionHeading title="Issue a conviction notice" detail="Step 1 of 2" />
              <Card style={styles.noticeCard}>
                <View style={styles.formTitleRow}>
                  <View style={styles.formIcon}>
                    <Text style={styles.formIconText}>§</Text>
                  </View>
                  <View style={styles.formTitleCopy}>
                    <Text style={styles.formTitle}>File against a flatmate</Text>
                    <Text style={styles.formSubtitle}>They will see the notice on their account and can respond.</Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Flatmate</Text>
                <View style={styles.peopleList}>
                  {availableAccused.map((person) => {
                    const selected = selectedAccused.id === person.id;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={person.id}
                        onPress={() => setAccusedId(person.id)}
                        style={[styles.personOption, selected && styles.personOptionSelected]}>
                        <Initials label={person.initials} color={person.color} />
                        <Text style={[styles.personName, selected && styles.personNameSelected]}>
                          {person.name.split(' ')[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>What happened?</Text>
                <View style={styles.chargeWrap}>
                  {charges.map((option) => {
                    const selected = charge === option;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={option}
                        onPress={() => setCharge(option)}
                        style={[styles.chargeChip, selected && styles.chargeChipSelected]}>
                        <Text style={[styles.chargeText, selected && styles.chargeTextSelected]}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <FormField
                  label="Allegation"
                  onChangeText={setAllegation}
                  placeholder="For example: the bathroom rota was missed on Saturday."
                  value={allegation}
                />
                <FormField
                  label="Your statement"
                  multiline
                  onChangeText={setProsecutorStatement}
                  placeholder="Explain the situation and why you believe they should be held responsible."
                  value={prosecutorStatement}
                />
                <FormField
                  label="Evidence details (optional)"
                  multiline
                  onChangeText={setEvidenceNotes}
                  placeholder="Describe any supporting information. Photo uploads can be connected later."
                  value={evidenceNotes}
                />

                <ActionButton
                  disabled={!allegation.trim() || !prosecutorStatement.trim()}
                  label={`Send notice to ${selectedAccused.name.split(' ')[0]}`}
                  onPress={fileConviction}
                />
              </Card>
            </View>
          ) : null}

          {conviction ? (
            <Card style={styles.aiCard}>
              <Text style={styles.aiTitle}>The AI Judge has the final say</Text>
              <Text style={styles.aiCopy}>
                The final review considers the household rule, assigned chores, past convictions, the notice, and the defense.
              </Text>
              <ActionButton
                disabled={!defenseSubmitted}
                label="Request final AI judgment"
                onPress={() => setJudgmentRequested(true)}
              />
              {!defenseSubmitted ? (
                <Text style={styles.waitingNote}>The accused must submit a defense before final judgment.</Text>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : isDefendant ? (
        <>
          <View style={styles.sectionBlock}>
            <SectionHeading title="Your conviction notice" detail="Step 2 of 2" />
            <Card style={styles.convictionCard}>
              <View style={styles.caseHeader}>
                <View style={styles.caseIcon}>
                  <Text style={styles.caseIconText}>§</Text>
                </View>
                <View style={styles.caseCopy}>
                  <Text style={styles.caseCharge}>{conviction.charge}</Text>
                  <Text style={styles.caseMeta}>Filed by {flatmates.find((person) => person.id === conviction.prosecutorId)?.name}</Text>
                </View>
                <Pill tone="amber">NOTICE</Pill>
              </View>
              <Text style={styles.caseAllegation}>{conviction.allegation}</Text>
              <Text style={styles.statementLabel}>THEIR STATEMENT</Text>
              <Text style={styles.statementText}>{conviction.statement}</Text>
              {conviction.evidenceNotes ? (
                <View style={styles.evidenceSummary}>
                  <Text style={styles.statementLabel}>EVIDENCE DETAILS</Text>
                  <Text style={styles.statementText}>{conviction.evidenceNotes}</Text>
                </View>
              ) : null}
            </Card>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeading title="Post your defense" detail="Your side of the case" />
            <Card style={styles.defenseCard}>
              {defenseSubmitted ? (
                <>
                  <View style={styles.submittedHeader}>
                    <Pill tone="green">DEFENSE SENT</Pill>
                    <Text style={styles.submittedMeta}>Both sides are now on record.</Text>
                  </View>
                  <Text style={styles.responseText}>{defense}</Text>
                  {defenseEvidence ? (
                    <View style={styles.responsePreview}>
                      <Text style={styles.responseLabel}>YOUR SUPPORTING DETAILS</Text>
                      <Text style={styles.responseText}>{defenseEvidence}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <FormField
                    label="Your response"
                    multiline
                    onChangeText={setDefense}
                    placeholder="Explain what happened from your perspective, or add relevant context."
                    value={defense}
                  />
                  <FormField
                    label="Supporting details (optional)"
                    multiline
                    onChangeText={setDefenseEvidence}
                    placeholder="Add anything else the AI Judge should consider."
                    value={defenseEvidence}
                  />
                  <ActionButton
                    disabled={!defense.trim()}
                    label="Post my defense"
                    onPress={() => setDefenseSubmitted(true)}
                  />
                </>
              )}
            </Card>
          </View>

          <Card style={styles.aiCard}>
            <Text style={styles.aiTitle}>Final review comes after your response</Text>
            <Text style={styles.aiCopy}>
              The AI Judge will consider both accounts, household responsibilities, and past convictions before issuing a final ruling.
            </Text>
            <ActionButton
              disabled={!defenseSubmitted}
              label="Request final AI judgment"
              onPress={() => setJudgmentRequested(true)}
            />
            {!defenseSubmitted ? (
              <Text style={styles.waitingNote}>Post your defense to continue to the final review.</Text>
            ) : null}
            {judgmentRequested ? (
              <Text style={styles.aiNotice}>
                The AI Judge connection is not enabled in this prototype; the case is ready for that final review.
              </Text>
            ) : null}
          </Card>
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No notice on this account</Text>
          <Text style={styles.emptyCopy}>The current demo case is not addressed to {activeMember.name}.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: { gap: 13 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.forestSoft,
  },
  accountIconText: { color: Palette.forest, fontSize: 21, fontWeight: '800' },
  accountCopy: { flex: 1, gap: 3 },
  accountTitle: { color: Palette.ink, fontSize: 13, fontWeight: '900' },
  accountNote: { color: Palette.muted, fontSize: 10, lineHeight: 15 },
  accountPicker: { flexDirection: 'row', gap: 7 },
  accountOption: {
    flex: 1,
    minHeight: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: '#FAF8F2',
  },
  accountOptionSelected: { backgroundColor: Palette.forest, borderColor: Palette.forest },
  accountOptionText: { color: Palette.muted, fontSize: 11, fontWeight: '800' },
  accountOptionTextSelected: { color: '#FFFFFF' },
  sectionBlock: { gap: 12 },
  noticeCard: { gap: 15 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  formIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.forestSoft,
  },
  formIconText: { color: Palette.forest, fontSize: 22, fontWeight: '800' },
  formTitleCopy: { flex: 1, gap: 3 },
  formTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  formSubtitle: { color: Palette.muted, fontSize: 10, lineHeight: 15 },
  fieldLabel: { color: Palette.ink, fontSize: 12, fontWeight: '800' },
  peopleList: { flexDirection: 'row', gap: 9 },
  personOption: {
    flex: 1,
    minHeight: 75,
    padding: 8,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F2',
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: 15,
  },
  personOptionSelected: { borderColor: Palette.forest, backgroundColor: Palette.forestSoft },
  personName: { color: Palette.muted, fontSize: 11, fontWeight: '800' },
  personNameSelected: { color: Palette.forest },
  chargeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chargeChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: '#FAF8F2',
  },
  chargeChipSelected: { backgroundColor: Palette.forest, borderColor: Palette.forest },
  chargeText: { color: Palette.muted, fontSize: 10, fontWeight: '700' },
  chargeTextSelected: { color: '#FFFFFF' },
  statusCard: { gap: 11, backgroundColor: Palette.amberSoft, borderColor: '#EDE0C9' },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statusMeta: { color: Palette.muted, fontSize: 10, fontWeight: '700' },
  statusTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  statusCopy: { color: Palette.muted, fontSize: 11, lineHeight: 17 },
  resetButton: { alignSelf: 'flex-start', paddingVertical: 5 },
  resetButtonText: { color: Palette.forest, fontSize: 11, fontWeight: '800' },
  convictionCard: { gap: 13 },
  caseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caseIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.amberSoft,
  },
  caseIconText: { color: Palette.ink, fontSize: 21, fontWeight: '800' },
  caseCopy: { flex: 1, gap: 3 },
  caseCharge: { color: Palette.ink, fontSize: 14, fontWeight: '900' },
  caseMeta: { color: Palette.muted, fontSize: 10 },
  caseAllegation: { color: Palette.ink, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  statementLabel: { color: Palette.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  statementText: { color: Palette.ink, fontSize: 12, lineHeight: 18 },
  evidenceSummary: { gap: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: Palette.line },
  defenseCard: { gap: 14, borderColor: '#D5DFE5' },
  submittedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submittedMeta: { color: Palette.muted, fontSize: 10 },
  responsePreview: { gap: 5, padding: 12, borderRadius: 13, backgroundColor: '#F0F3F5' },
  responseLabel: { color: '#3B5868', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  responseText: { color: Palette.ink, fontSize: 12, lineHeight: 18 },
  aiCard: { gap: 11, backgroundColor: '#EBEEE6', borderColor: '#DCE2D8' },
  aiTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  aiCopy: { color: Palette.muted, fontSize: 11, lineHeight: 17 },
  waitingNote: { color: Palette.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  aiNotice: { color: Palette.forest, fontSize: 11, fontWeight: '700', lineHeight: 17 },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  emptyCopy: { color: Palette.muted, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  pressed: { opacity: 0.8 },
});
