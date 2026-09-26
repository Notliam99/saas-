import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { useHousehold } from '@/components/household-gate';
import { supabase } from '@/lib/supabase';

const unsafePunishmentPattern = /\b(execut\w*|kill\w*|assault\w*|hit\w*|beat\w*|injur\w*|harm\w*|hurt\w*|violence|sleep\w*|rent|subsid\w*|fine|pay(?:ment)?|money|humiliat\w*|sham\w*|food|water|depriv\w*|lock ?out|exclu\w*|threat\w*|sexual|illegal|danger\w*|physical\w*|punch\w*|slap\w*|kick\w*|coerc\w*|starv\w*|evict\w*|homeless|camp\w*|overnight)\b/i;
// Temporarily disabled: custom punishments no longer have to match a chore vocabulary.
// const chorePunishmentPattern = /\b(?:chores?|clean(?:ing|ed)?|wash(?:ing|ed)?|dishes?|bins?|rubbish|recycling|laundry|laundering|cook(?:ing)?|meals?|tidy(?:ing)?|sweep(?:ing)?|vacuum(?:ing)?|mop(?:ping|ped)?|shared spaces?|common areas?|household tasks?|rota|gardening?|lawn|wiping|organis(?:e|ing|ation)|organize|declutter(?:ing)?)\b/i;

type Member = { user_id: string };
type Profile = { id: string; display_name: string };
type Trial = {
  id: string;
  accused_id: string;
  charge: string;
  allegation: string;
  status: string;
  verdict_summary: string | null;
  punishment_details: string | null;
  created_at: string;
};
type Punishment = {
  id: string;
  punishment_tier: number;
  title: string;
  details: string;
  is_default: boolean;
};

export default function InfoScreen() {
  const household = useHousehold();
  const [trials, setTrials] = useState<Trial[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newLevel, setNewLevel] = useState('3');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadArchive() {
      setLoading(true);
      setError(null);
      const [memberResult, caseResult, defaultPunishmentResult, householdPunishmentResult] = await Promise.all([
        supabase.from('household_members').select('user_id').eq('household_id', household.id),
        supabase
          .from('cases')
          .select('id, accused_id, charge, allegation, status, verdict_summary, punishment_details, created_at')
          .eq('household_id', household.id)
          .in('status', ['guilty', 'not_guilty', 'mistrial'])
          .order('created_at', { ascending: false }),
        supabase.from('punishments').select('id, punishment_tier, title, details, is_default').is('household_id', null),
        supabase.from('punishments').select('id, punishment_tier, title, details, is_default').eq('household_id', household.id),
      ]);

      const failed = memberResult.error ?? caseResult.error ?? defaultPunishmentResult.error ?? householdPunishmentResult.error;
      if (failed) {
        if (active) {
          setError(failed.message);
          setLoading(false);
        }
        return;
      }

      const ids = (memberResult.data ?? []).map((member: Member) => member.user_id);
      const profileResult = ids.length
        ? await supabase.from('profiles').select('id, display_name').in('id', ids)
        : { data: [], error: null };

      if (active) {
        if (profileResult.error) {
          setError(profileResult.error.message);
        } else {
          setTrials(caseResult.data ?? []);
          setProfiles(profileResult.data ?? []);
          setPunishments(
            [...(defaultPunishmentResult.data ?? []), ...(householdPunishmentResult.data ?? [])]
              .sort((left, right) => left.punishment_tier - right.punishment_tier || left.title.localeCompare(right.title)),
          );
        }
        setLoading(false);
      }
    }

    void loadArchive();
    return () => {
      active = false;
    };
  }, [household.id, reload]);

  async function addPunishment() {
    if (!newTitle.trim() || !newDetail.trim()) return;
    const punishmentText = `${newTitle.trim()} ${newDetail.trim()}`;
    if (unsafePunishmentPattern.test(punishmentText)) {
      setError('Custom options cannot involve harm, money, sleeping arrangements, humiliation, or exclusion.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError(authError?.message ?? 'Sign in before adding a household punishment.');
      setBusy(false);
      return;
    }

    const { error: insertError } = await supabase.from('punishments').insert({
      household_id: household.id,
      punishment_tier: Number(newLevel),
      title: newTitle.trim(),
      details: newDetail.trim(),
      is_default: false,
      created_by: authData.user.id,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setNewTitle('');
      setNewDetail('');
      setNewLevel('3');
      setAddFormOpen(false);
      setReload((value) => value + 1);
    }
    setBusy(false);
  }

  const guiltyCount = trials.filter((trial) => trial.status === 'guilty').length;
  const mistrialCount = trials.filter((trial) => trial.status === 'mistrial').length;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.display_name]));

  return (
    <Screen>
      <PageHeader
        eyebrow={`${household.name} · Archive`}
        title="Court record"
        subtitle="Past decisions and the household’s scale of consequences."
        accessory={<Pill tone="green">HOUSEHOLD</Pill>}
      />

      {error ? <Card style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></Card> : null}

      <Card style={styles.archiveCard}>
        <View style={styles.archiveHeadline}>
          <View style={styles.archiveIcon}><Text style={styles.archiveIconText}>§</Text></View>
          <View style={styles.archiveCopy}>
            <Text style={styles.archiveTitle}>The household ledger</Text>
            <Text style={styles.archiveSubtitle}>Final decisions are kept in this flat’s record.</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <StatCell value={loading ? '—' : String(trials.length)} label="TRIALS" />
          <StatCell value={loading ? '—' : String(guiltyCount)} label="CONVICTIONS" />
          <StatCell value={loading ? '—' : String(mistrialCount)} label="MISTRIALS" />
        </View>
      </Card>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Past trials" detail="Most recent first" />
        {loading ? <ActivityIndicator color={Palette.forest} style={styles.loader} /> : trials.length ? (
          <Card style={styles.trialsCard}>
            {trials.map((trial, index) => (
              <View key={trial.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.trial}>
                  <View style={styles.trialHeader}>
                    <View style={styles.trialCopy}>
                      <Text style={styles.trialTitle}>{trial.charge}: {trial.allegation}</Text>
                      <Text style={styles.trialMeta}>
                        {profileById.get(trial.accused_id) ?? 'Flatmate'} · {formatDate(trial.created_at)}
                      </Text>
                    </View>
                    <Pill tone={outcomeTone(trial.status)}>{outcomeLabel(trial.status).toUpperCase()}</Pill>
                  </View>
                  {trial.verdict_summary ? <Text style={styles.punishmentText}>{trial.verdict_summary}</Text> : null}
                  {trial.punishment_details ? <Text style={styles.punishmentResult}>Punishment · {trial.punishment_details}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Text style={styles.emptyText}>No final decisions have been recorded yet.</Text></Card>
        )}
        <Text style={styles.archiveNote}>Mistrials and not-guilty decisions remain in the archive but do not count as convictions.</Text>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Punishment scale" detail="1 · light — 10 · serious" />
        <Text style={styles.scaleIntro}>The AI Judge chooses from this household list after deciding a case. Custom options may be household-specific, but harmful or coercive punishments are excluded.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAddFormOpen(!addFormOpen)}
          style={({ pressed }) => [styles.addPunishmentButton, pressed && styles.pressed]}>
          <Text style={styles.addPunishmentText}>{addFormOpen ? 'Close form' : '＋ Add a household punishment'}</Text>
        </Pressable>
        {addFormOpen ? (
          <Card style={styles.editorCard}>
            <Text style={styles.editorTitle}>Add a custom option</Text>
            <FormField label="Punishment name" onChangeText={setNewTitle} placeholder="For example, take the next dishes turn" value={newTitle} />
            <FormField label="What it involves" multiline onChangeText={setNewDetail} placeholder="Keep it practical, safe, and household-focused." value={newDetail} />
            <Text style={styles.fieldLabel}>Punishment level</Text>
            <View style={styles.levelPicker}>
              {Array.from({ length: 10 }, (_, index) => String(index + 1)).map((level) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: newLevel === level }}
                  key={level}
                  onPress={() => setNewLevel(level)}
                  style={[styles.levelChoice, newLevel === level && styles.levelChoiceSelected]}>
                  <Text style={[styles.levelChoiceText, newLevel === level && styles.levelChoiceTextSelected]}>{level}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.editorNote}>Keep custom options reasonable and household-appropriate. Harm, money, sleeping arrangements, humiliation, and exclusion are not allowed.</Text>
            <ActionButton
              disabled={busy || !newTitle.trim() || !newDetail.trim()}
              label={busy ? 'Saving…' : 'Add to punishment list'}
              onPress={() => { void addPunishment(); }}
            />
          </Card>
        ) : null}
        {loading ? <ActivityIndicator color={Palette.forest} style={styles.loader} /> : punishments.length ? (
          <View style={styles.punishmentList}>
            {punishments.map((punishment) => (
              <Card key={punishment.id} style={styles.punishmentCard}>
                <View style={styles.levelBadge}><Text style={styles.levelNumber}>{punishment.punishment_tier}</Text></View>
                <View style={styles.punishmentCopy}>
                  <View style={styles.punishmentTitleRow}>
                    <Text style={styles.punishmentTitle}>{punishment.title}</Text>
                    {punishment.is_default ? <Pill tone="blue">DEFAULT</Pill> : null}
                  </View>
                  <Text style={styles.punishmentDetail}>{punishment.details}</Text>
                </View>
              </Card>
            ))}
          </View>
        ) : <Card><Text style={styles.emptyText}>No punishment options are configured yet.</Text></Card>}
      </View>

      <Card style={styles.footerCard}>
        <Text style={styles.footerTitle}>Evidence privacy</Text>
        <Text style={styles.footerText}>Photos are stored in private household case storage. Signed viewing links expire after one hour; automatic photo deletion is not configured yet.</Text>
      </Card>
    </Screen>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return <View style={styles.statCell}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function outcomeLabel(status: string) {
  if (status === 'guilty') return 'Guilty';
  if (status === 'not_guilty') return 'Not guilty';
  return 'Mistrial';
}

function outcomeTone(status: string): 'green' | 'blue' | 'rose' {
  if (status === 'guilty') return 'green';
  if (status === 'not_guilty') return 'blue';
  return 'rose';
}

const styles = StyleSheet.create({
  archiveCard: { backgroundColor: Palette.forest, borderColor: Palette.forest, padding: 17 },
  archiveHeadline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  archiveIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  archiveIconText: { color: '#FFFFFF', fontSize: 23, fontWeight: '700' },
  archiveCopy: { flex: 1, gap: 4 },
  archiveTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  archiveSubtitle: { color: '#D6E5DC', fontSize: 11, lineHeight: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, paddingTop: 15, borderTopColor: 'rgba(255,255,255,0.18)', borderTopWidth: 1 },
  statCell: { alignItems: 'flex-start', gap: 3 },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#D6E5DC', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  sectionBlock: { gap: 11 },
  trialsCard: { padding: 15 },
  trial: { gap: 8, paddingVertical: 11 },
  trialHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  trialCopy: { flex: 1, gap: 4 },
  trialTitle: { color: Palette.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  trialMeta: { color: Palette.muted, fontSize: 11 },
  punishmentText: { color: Palette.muted, fontSize: 11, lineHeight: 16 },
  punishmentResult: { color: Palette.forest, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  archiveNote: { color: Palette.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 2 },
  scaleIntro: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  addPunishmentButton: { alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: '#B7C7BA', backgroundColor: Palette.forestSoft },
  addPunishmentText: { color: Palette.forest, fontSize: 12, fontWeight: '800' },
  editorCard: { gap: 13, borderColor: '#B7C7BA' },
  editorTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  fieldLabel: { color: Palette.ink, fontSize: 13, fontWeight: '800' },
  levelPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  levelChoice: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Palette.line, backgroundColor: '#FAF8F2' },
  levelChoiceSelected: { backgroundColor: Palette.forest, borderColor: Palette.forest },
  levelChoiceText: { color: Palette.muted, fontSize: 12, fontWeight: '800' },
  levelChoiceTextSelected: { color: '#FFFFFF' },
  editorNote: { color: Palette.muted, fontSize: 10, lineHeight: 15 },
  punishmentList: { gap: 8 },
  punishmentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16 },
  levelBadge: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.amberSoft },
  levelNumber: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  punishmentCopy: { flex: 1, gap: 3 },
  punishmentTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  punishmentTitle: { flex: 1, color: Palette.ink, fontSize: 12, fontWeight: '800' },
  punishmentDetail: { color: Palette.muted, fontSize: 11, lineHeight: 16 },
  footerCard: { backgroundColor: '#F0EDE4' },
  footerTitle: { color: Palette.ink, fontSize: 13, fontWeight: '900' },
  footerText: { color: Palette.muted, fontSize: 11, lineHeight: 17 },
  emptyText: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  errorCard: { backgroundColor: Palette.roseSoft, borderColor: Palette.roseSoft },
  errorText: { color: Palette.rose, fontSize: 12, lineHeight: 18 },
  loader: { paddingVertical: 18 },
  pressed: { opacity: 0.78 },
});
