import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Card,
  FormField,
  PageHeader,
  Palette,
  Pill,
  Screen,
  SectionHeading,
} from '@/components/flat-judge-ui';
import { useHousehold } from '@/components/household-gate';
import { Typography } from '@/constants/typography';
import { loadCaseEvidence, type CaseEvidenceImage } from '@/lib/case-evidence';
import { supabase } from '@/lib/supabase';

const unsafePunishmentPattern = /\b(execut\w*|kill\w*|assault\w*|hit\w*|beat\w*|injur\w*|harm\w*|hurt\w*|violence|sleep\w*|rent|subsid\w*|fine|pay(?:ment)?|money|humiliat\w*|sham\w*|food|water|depriv\w*|lock ?out|exclu\w*|threat\w*|sexual|illegal|danger\w*|physical\w*|punch\w*|slap\w*|kick\w*|coerc\w*|starv\w*|evict\w*|homeless|camp\w*|overnight)\b/i;
// Temporarily disabled: custom punishments no longer have to match a chore vocabulary.
// const chorePunishmentPattern = /\b(?:chores?|clean(?:ing|ed)?|wash(?:ing|ed)?|dishes?|bins?|rubbish|recycling|laundry|laundering|cook(?:ing)?|meals?|tidy(?:ing)?|sweep(?:ing)?|vacuum(?:ing)?|mop(?:ping|ped)?|shared spaces?|common areas?|household tasks?|rota|gardening?|lawn|wiping|organis(?:e|ing|ation)|organize|declutter(?:ing)?)\b/i;

type Member = { user_id: string };
type Profile = { id: string; display_name: string };
type HouseholdCase = {
  id: string;
  reporter_id: string;
  accused_id: string;
  charge: string;
  allegation: string;
  prosecutor_statement: string;
  status: string;
  verdict_summary: string | null;
  punishment_details: string | null;
  created_at: string;
};
type Defense = { case_id: string; response: string };
type Punishment = {
  id: string;
  punishment_tier: number;
  title: string;
  details: string;
  is_default: boolean;
};

export default function InfoScreen() {
  const household = useHousehold();
  const [cases, setCases] = useState<HouseholdCase[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [caseEvidence, setCaseEvidence] = useState<CaseEvidenceImage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editingPunishmentId, setEditingPunishmentId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newLevel, setNewLevel] = useState('3');
  const [busy, setBusy] = useState(false);
  const [removingPunishmentId, setRemovingPunishmentId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadArchive() {
      setLoading(true);
      setError(null);
      const [memberResult, caseResult, defaultPunishmentResult, householdPunishmentResult, hiddenDefaultResult, overrideResult] = await Promise.all([
        supabase.from('household_members').select('user_id').eq('household_id', household.id),
        supabase
          .from('cases')
          .select('id, reporter_id, accused_id, charge, allegation, prosecutor_statement, status, verdict_summary, punishment_details, created_at')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false }),
        supabase.from('punishments').select('id, punishment_tier, title, details, is_default').is('household_id', null),
        supabase.from('punishments').select('id, punishment_tier, title, details, is_default').eq('household_id', household.id),
        supabase.from('household_hidden_default_punishments').select('punishment_id').eq('household_id', household.id),
        supabase.from('household_default_punishment_overrides').select('punishment_id, punishment_tier, title, details').eq('household_id', household.id),
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
      const caseIds = (caseResult.data ?? []).map((item) => item.id);
      const evidenceRequest: Promise<CaseEvidenceImage[]> = caseIds.length
        ? loadCaseEvidence(caseIds).catch(() => [])
        : Promise.resolve([]);
      const [profileResult, defenseResult, evidenceResult] = await Promise.all([
        ids.length
          ? supabase.from('profiles').select('id, display_name').in('id', ids)
          : Promise.resolve({ data: [], error: null }),
        caseIds.length
          ? supabase.from('case_defenses').select('case_id, response').in('case_id', caseIds)
          : Promise.resolve({ data: [], error: null }),
        evidenceRequest,
      ]);

      if (active) {
        if (profileResult.error || defenseResult.error) {
          setError(profileResult.error?.message ?? defenseResult.error?.message ?? 'Could not load household case details.');
        } else {
          const hiddenDefaultIds = new Set((hiddenDefaultResult.data ?? []).map((item) => item.punishment_id));
          const overridesById = new Map((overrideResult.data ?? []).map((item) => [item.punishment_id, item]));
          const visibleDefaults = (defaultPunishmentResult.data ?? [])
            .filter((item) => !hiddenDefaultIds.has(item.id))
            .map((item) => {
              const override = overridesById.get(item.id);
              return override ? { ...item, ...override } : item;
            });
          setCases(caseResult.data ?? []);
          setDefenses(defenseResult.data ?? []);
          setCaseEvidence(evidenceResult);
          setProfiles(profileResult.data ?? []);
          setPunishments(
            [
              ...visibleDefaults,
              ...(householdPunishmentResult.data ?? []),
            ]
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

  async function savePunishment() {
    if (!newTitle.trim() || !newDetail.trim() || busy) return;
    const punishmentText = `${newTitle.trim()} ${newDetail.trim()}`;
    if (unsafePunishmentPattern.test(punishmentText)) {
      setError('Custom options cannot involve harm, money, sleeping arrangements, humiliation, or exclusion.');
      return;
    }
    setBusy(true);
    setError(null);
    let saveError: string | null = null;
    const editingPunishment = editingPunishmentId
      ? punishments.find((item) => item.id === editingPunishmentId)
      : undefined;

    if (editingPunishment?.is_default) {
      const { error: updateError } = await supabase.from('household_default_punishment_overrides').upsert({
        household_id: household.id,
        punishment_id: editingPunishment.id,
        punishment_tier: Number(newLevel),
        title: newTitle.trim(),
        details: newDetail.trim(),
      }, { onConflict: 'household_id,punishment_id' });
      saveError = updateError?.message ?? null;
    } else if (editingPunishment) {
      const { error: updateError } = await supabase.from('punishments').update({
        punishment_tier: Number(newLevel),
        title: newTitle.trim(),
        details: newDetail.trim(),
      }).eq('id', editingPunishment.id).eq('household_id', household.id);
      saveError = updateError?.message ?? null;
    } else {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        saveError = authError?.message ?? 'Sign in before adding a household rule.';
      } else {
        const { error: insertError } = await supabase.from('punishments').insert({
          household_id: household.id,
          punishment_tier: Number(newLevel),
          title: newTitle.trim(),
          details: newDetail.trim(),
          is_default: false,
          created_by: authData.user.id,
        });
        saveError = insertError?.message ?? null;
      }
    }

    if (saveError) {
      setError(saveError);
    } else {
      setNewTitle('');
      setNewDetail('');
      setNewLevel('3');
      setEditingPunishmentId(null);
      setAddFormOpen(false);
      setReload((value) => value + 1);
    }
    setBusy(false);
  }

  function editPunishment(punishment: Punishment) {
    setEditingPunishmentId(punishment.id);
    setNewTitle(punishment.title);
    setNewDetail(punishment.details);
    setNewLevel(String(punishment.punishment_tier));
    setError(null);
    setAddFormOpen(true);
  }

  function togglePunishmentForm() {
    if (addFormOpen) {
      setAddFormOpen(false);
      setEditingPunishmentId(null);
      setNewTitle('');
      setNewDetail('');
      setNewLevel('3');
      return;
    }
    setEditingPunishmentId(null);
    setNewTitle('');
    setNewDetail('');
    setNewLevel('3');
    setAddFormOpen(true);
  }

  async function removeDefaultPunishment(punishmentId: string) {
    setRemovingPunishmentId(punishmentId);
    setError(null);
    const { error: hideError } = await supabase.from('household_hidden_default_punishments').insert({
      household_id: household.id,
      punishment_id: punishmentId,
    });
    if (hideError) {
      setError(hideError.message);
    } else {
      setPunishments((current) => current.filter((item) => item.id !== punishmentId));
      if (editingPunishmentId === punishmentId) {
        setEditingPunishmentId(null);
        setAddFormOpen(false);
        setNewTitle('');
        setNewDetail('');
        setNewLevel('3');
      }
      setReload((value) => value + 1);
    }
    setRemovingPunishmentId(null);
  }

  const guiltyCount = cases.filter((item) => item.status === 'guilty').length;
  const mistrialCount = cases.filter((item) => item.status === 'mistrial').length;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.display_name]));

  return (
    <Screen>
      <PageHeader
        title="Court record"
        subtitle="House rules and case history."
      />

      {error ? <Card style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></Card> : null}

      <View style={styles.statsRow}>
        <StatCell value={loading ? '' : String(cases.length)} label="Cases" />
        <StatCell value={loading ? '' : String(guiltyCount)} label="Guilty" />
        <StatCell value={loading ? '' : String(mistrialCount)} label="Mistrials" />
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="House penalties" detail="1 to 10 for seriousness" />
        <Text style={styles.scaleIntro}>The AI Judge chooses from this household list after deciding a case. Custom options may be household-specific, but harmful or coercive punishments are excluded.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={togglePunishmentForm}
          style={({ pressed }) => [styles.addPunishmentButton, pressed && styles.pressed]}>
          <Text style={styles.addPunishmentText}>{addFormOpen ? 'Close form' : 'Add a household rule'}</Text>
        </Pressable>
        {addFormOpen ? (
          <Card style={styles.editorCard}>
            <Text style={styles.editorTitle}>{editingPunishmentId ? 'Edit house rule' : 'Add a household rule'}</Text>
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
              label={busy ? 'Saving…' : editingPunishmentId ? 'Save changes' : 'Add rule'}
              onPress={() => { void savePunishment(); }}
            />
          </Card>
        ) : null}
        {loading ? <ActivityIndicator color={Palette.accent} style={styles.loader} /> : punishments.length ? (
          <View style={styles.punishmentList}>
            {punishments.map((punishment) => (
              <Card key={punishment.id} style={styles.punishmentCard}>
                <View style={styles.levelBadge}><Text style={styles.levelNumber}>{punishment.punishment_tier}</Text></View>
                <View style={styles.punishmentCopy}>
                  <View style={styles.punishmentTitleRow}>
                    <Text style={styles.punishmentTitle}>{punishment.title}</Text>
                    <View style={styles.punishmentActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${punishment.title}`}
                        disabled={busy || removingPunishmentId !== null}
                        onPress={() => editPunishment(punishment)}>
                        <Text style={styles.editRuleText}>Edit</Text>
                      </Pressable>
                      {punishment.is_default ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${punishment.title} from house rules`}
                          disabled={removingPunishmentId === punishment.id}
                          onPress={() => { void removeDefaultPunishment(punishment.id); }}>
                          <Text style={styles.removeRuleText}>{removingPunishmentId === punishment.id ? 'Removing…' : 'Remove'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.punishmentDetail}>{punishment.details}</Text>
                </View>
              </Card>
            ))}
          </View>
        ) : <Card><Text style={styles.emptyText}>No punishment options are configured yet.</Text></Card>}
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Household cases" detail={`${cases.length} total`} />
        {loading ? <ActivityIndicator color={Palette.accent} style={styles.loader} /> : cases.length ? (
          <View style={styles.punishmentList}>
            {cases.map((item) => {
              const defense = defenses.find((entry) => entry.case_id === item.id);
              const photos = caseEvidence.filter((image) => image.case_id === item.id);
              const active = item.status === 'awaiting_defense' || item.status === 'ready_for_judgment';
              return (
                <Card key={item.id} style={styles.caseCard}>
                  <View style={styles.trialHeader}>
                    <View style={styles.trialCopy}>
                      <Text style={styles.trialTitle}>{item.charge}</Text>
                      <Text style={styles.trialMeta}>
                        {profileById.get(item.reporter_id) ?? 'Flatmate'} filed against {profileById.get(item.accused_id) ?? 'Flatmate'} on {formatDate(item.created_at)}
                      </Text>
                    </View>
                    <Pill tone={active ? 'accent' : 'neutral'}>{outcomeLabel(item.status)}</Pill>
                  </View>
                  <Text style={styles.caseAllegation}>{item.allegation}</Text>
                  <Text style={styles.caseStatement}>{item.prosecutor_statement}</Text>
                  {defense ? <Text style={styles.caseStatement}>Response: {defense.response}</Text> : null}
                  {photos.length ? (
                    <View style={styles.casePhotos}>
                      {photos.map((photo, index) => (
                        <Image
                          key={photo.id}
                          accessibilityLabel={`${photo.evidence_side === 'prosecution' ? 'Reporter' : 'Response'} evidence photo ${index + 1}`}
                          source={{ uri: photo.signed_url }}
                          contentFit="cover"
                          style={styles.casePhoto}
                        />
                      ))}
                    </View>
                  ) : null}
                  {item.verdict_summary ? <Text style={styles.punishmentText}>{item.verdict_summary}</Text> : null}
                  {item.punishment_details ? <Text style={styles.punishmentResult}>House rule: {item.punishment_details}</Text> : null}
                </Card>
              );
            })}
          </View>
        ) : (
          <Card><Text style={styles.emptyText}>No cases have been filed in this household.</Text></Card>
        )}
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
  if (status === 'awaiting_defense') return 'Awaiting response';
  if (status === 'ready_for_judgment') return 'Ready to judge';
  return 'Mistrial';
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: Palette.ink, fontSize: Typography.title, fontWeight: '900' },
  statLabel: { color: Palette.ink, fontSize: Typography.body, fontWeight: '800' },
  sectionBlock: { gap: 11 },
  trialHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  trialCopy: { flex: 1, gap: 4 },
  trialTitle: { color: Palette.ink, fontSize: Typography.body, lineHeight: 18, fontWeight: '800' },
  trialMeta: { color: Palette.muted, fontSize: Typography.caption },
  punishmentText: { color: Palette.muted, fontSize: Typography.caption, lineHeight: 16 },
  punishmentResult: { color: Palette.ink, fontSize: Typography.caption, lineHeight: 16, fontWeight: '800' },
  scaleIntro: { color: Palette.muted, fontSize: Typography.body, lineHeight: 20 },
  addPunishmentButton: { alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Palette.accent, backgroundColor: Palette.accent },
  addPunishmentText: { color: Palette.ink, fontSize: Typography.body, fontWeight: '800' },
  editorCard: { gap: 13, borderColor: Palette.line },
  editorTitle: { color: Palette.ink, fontSize: Typography.heading, fontWeight: '900' },
  fieldLabel: { color: Palette.ink, fontSize: Typography.body, fontWeight: '800' },
  levelPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  levelChoice: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: Palette.line, backgroundColor: Palette.card },
  levelChoiceSelected: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  levelChoiceText: { color: Palette.muted, fontSize: Typography.caption, fontWeight: '800' },
  levelChoiceTextSelected: { color: Palette.ink },
  editorNote: { color: Palette.muted, fontSize: Typography.caption, lineHeight: 17 },
  punishmentList: { gap: 8 },
  punishmentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16 },
  levelBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.accent },
  levelNumber: { color: Palette.ink, fontSize: Typography.body, fontWeight: '900' },
  punishmentCopy: { flex: 1, gap: 3 },
  punishmentTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  punishmentActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editRuleText: { color: Palette.ink, fontSize: Typography.caption, fontWeight: '700' },
  removeRuleText: { color: Palette.ink, fontSize: Typography.caption, fontWeight: '700' },
  punishmentTitle: { flex: 1, color: Palette.ink, fontSize: Typography.body, fontWeight: '800' },
  punishmentDetail: { color: Palette.muted, fontSize: Typography.caption, lineHeight: 17 },
  caseCard: { gap: 10 },
  caseAllegation: { color: Palette.ink, fontSize: Typography.body, fontWeight: '700', lineHeight: 20 },
  caseStatement: { color: Palette.muted, fontSize: Typography.body, lineHeight: 20 },
  casePhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  casePhoto: { width: 88, height: 88, borderRadius: 10, backgroundColor: Palette.line },
  footerCard: { backgroundColor: Palette.paper },
  footerTitle: { color: Palette.ink, fontSize: Typography.body, fontWeight: '900' },
  footerText: { color: Palette.muted, fontSize: Typography.body, lineHeight: 20 },
  emptyText: { color: Palette.muted, fontSize: Typography.body, lineHeight: 20 },
  errorCard: { backgroundColor: Palette.paper, borderColor: Palette.accent },
  errorText: { color: Palette.ink, fontSize: Typography.body, lineHeight: 20 },
  loader: { paddingVertical: 18 },
  pressed: { opacity: 0.78 },
});
