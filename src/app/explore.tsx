import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { useHousehold } from '@/components/household-gate';
import { EvidencePhotoPicker, type EvidencePhoto } from '@/components/evidence-photo-picker';
import {
  loadCaseEvidence,
  removeCaseEvidence,
  uploadCaseEvidence,
  type CaseEvidenceImage,
} from '@/lib/case-evidence';
import { supabase } from '@/lib/supabase';

const charges = ['Missed chore', 'Noise', 'Shared space', 'Property damage', 'Other'];

type Member = { user_id: string; display_name: string };
type CourtCase = {
  id: string;
  reporter_id: string;
  accused_id: string;
  charge: string;
  allegation: string;
  prosecutor_statement: string;
  evidence_notes: string;
  status: string;
  verdict_summary: string | null;
  punishment_details: string | null;
  created_at: string;
};
type Defense = { case_id: string; defendant_id: string; response: string; evidence_notes: string };
type PendingPhotoUpload = { caseId: string; photos: EvidencePhoto[] };

export default function CourtScreen() {
  const household = useHousehold();
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [selectedAccusedId, setSelectedAccusedId] = useState('');
  const [charge, setCharge] = useState(charges[0]);
  const [allegation, setAllegation] = useState('');
  const [prosecutorStatement, setProsecutorStatement] = useState('');
  const [prosecutionPhotos, setProsecutionPhotos] = useState<EvidencePhoto[]>([]);
  const [defense, setDefense] = useState('');
  const [defensePhotos, setDefensePhotos] = useState<EvidencePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [judgingCaseId, setJudgingCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [evidenceImages, setEvidenceImages] = useState<CaseEvidenceImage[]>([]);
  const [pendingPhotoUpload, setPendingPhotoUpload] = useState<PendingPhotoUpload | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCourt() {
      setLoading(true);
      setError(null);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        if (active) {
          setError(authError?.message ?? 'Please sign in to open your household court.');
          setLoading(false);
        }
        return;
      }

      const memberResult = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', household.id)
        .order('joined_at', { ascending: true });

      if (memberResult.error) {
        if (active) {
          setError(memberResult.error.message);
          setLoading(false);
        }
        return;
      }

      const ids = (memberResult.data ?? []).map((item) => item.user_id);
      const [profileResult, caseResult] = await Promise.all([
        ids.length
          ? supabase.from('profiles').select('id, display_name').in('id', ids)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('cases')
          .select('id, reporter_id, accused_id, charge, allegation, prosecutor_statement, evidence_notes, status, verdict_summary, punishment_details, created_at')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false }),
      ]);

      if (profileResult.error || caseResult.error) {
        if (active) {
          setError(profileResult.error?.message ?? caseResult.error?.message ?? 'Could not load court records.');
          setLoading(false);
        }
        return;
      }

      const nextCases = caseResult.data ?? [];
      const defenseResult = nextCases.length
        ? await supabase
            .from('case_defenses')
            .select('case_id, defendant_id, response, evidence_notes')
            .in('case_id', nextCases.map((item) => item.id))
        : { data: [], error: null };

      let nextEvidenceImages: CaseEvidenceImage[] = [];
      if (!defenseResult.error) {
        try {
          nextEvidenceImages = await loadCaseEvidence(nextCases.map((item) => item.id));
        } catch (evidenceError) {
          if (active) {
            setError(evidenceError instanceof Error ? evidenceError.message : 'Could not load case photos.');
            setLoading(false);
          }
          return;
        }
      }

      if (active) {
        if (defenseResult.error) {
          setError(defenseResult.error.message);
        } else {
          setUserId(authData.user.id);
          setMembers((profileResult.data ?? []).map((profile) => ({ user_id: profile.id, display_name: profile.display_name })));
          setCases(nextCases);
          setDefenses(defenseResult.data ?? []);
          setEvidenceImages(nextEvidenceImages);
        }
        setLoading(false);
      }
    }

    void loadCourt();
    return () => {
      active = false;
    };
  }, [household.id, reload]);

  const profileById = new Map(members.map((member) => [member.user_id, member.display_name]));
  const me = userId ? profileById.get(userId) ?? 'You' : 'You';
  const openStatuses = ['awaiting_defense', 'ready_for_judgment'];
  const activeAccusedIds = new Set(cases.filter((item) => openStatuses.includes(item.status)).map((item) => item.accused_id));
  const availableAccused = members.filter((member) => member.user_id !== userId && !activeAccusedIds.has(member.user_id));
  const accusedId = availableAccused.some((member) => member.user_id === selectedAccusedId)
    ? selectedAccusedId
    : availableAccused[0]?.user_id ?? '';
  const myPendingCase = cases.find((item) => item.accused_id === userId && item.status === 'awaiting_defense');

  async function fileCase() {
    if (!userId || !accusedId || !allegation.trim() || !prosecutorStatement.trim()) return;
    const photosToUpload = prosecutionPhotos;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data: createdCase, error: insertError } = await supabase.from('cases').insert({
      household_id: household.id,
      reporter_id: userId,
      accused_id: accusedId,
      charge,
      allegation: allegation.trim(),
      prosecutor_statement: prosecutorStatement.trim(),
    }).select('id').single();
    if (insertError) {
      setError(insertError.message);
    } else {
      setAllegation('');
      setProsecutorStatement('');
      setProsecutionPhotos([]);
      if (photosToUpload.length) {
        try {
          await uploadCaseEvidence({
            caseId: createdCase.id,
            householdId: household.id,
            userId,
            side: 'prosecution',
            photos: photosToUpload,
          });
        } catch {
          setPendingPhotoUpload({ caseId: createdCase.id, photos: photosToUpload });
          setNotice('The notice was filed, but its photos did not upload. Retry the photo upload below.');
          setReload((value) => value + 1);
          setBusy(false);
          return;
        }
      }
      setNotice(`Notice sent to ${profileById.get(accusedId) ?? 'your flatmate'}.`);
      setReload((value) => value + 1);
    }
    setBusy(false);
  }

  async function retryPhotoUpload() {
    if (!userId || !pendingPhotoUpload) return;
    setBusy(true);
    setError(null);
    try {
      await uploadCaseEvidence({
        caseId: pendingPhotoUpload.caseId,
        householdId: household.id,
        userId,
        side: 'prosecution',
        photos: pendingPhotoUpload.photos,
      });
      setPendingPhotoUpload(null);
      setNotice('Photo evidence was added to the case.');
      setReload((value) => value + 1);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload case photos.');
    } finally {
      setBusy(false);
    }
  }

  async function postDefense(caseId: string) {
    if (!userId || !defense.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await uploadCaseEvidence({
        caseId,
        householdId: household.id,
        userId,
        side: 'defense',
        photos: defensePhotos,
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload defense photos.');
      setBusy(false);
      return;
    }
    const { error: defenseError } = await supabase.from('case_defenses').insert({
      case_id: caseId,
      defendant_id: userId,
      response: defense.trim(),
    });
    if (defenseError) {
      setError(defenseError.message);
      if (defensePhotos.length) {
        try {
          await removeCaseEvidence(caseId, 'defense', userId);
        } catch {
          setError(`${defenseError.message} Some uploaded photos could not be removed; refresh the case before retrying.`);
        }
      }
    } else {
      setDefense('');
      setDefensePhotos([]);
      setNotice('Your defense has been added to the case. It is now ready for the AI Judge.');
      setReload((value) => value + 1);
    }
    setBusy(false);
  }

  async function judgeCase(caseId: string) {
    if (busy || judgingCaseId) return;
    setBusy(true);
    setJudgingCaseId(caseId);
    setError(null);
    setNotice(null);
    try {
      const { data: judgeResult, error: judgeError } = await supabase.functions.invoke('judge-case', { body: { caseId } });
      if (judgeError) {
        let message = judgeError.message;
        try {
          const response = judgeError.context as Response;
          const payload = await response.clone().json();
          if (typeof payload?.error === 'string') message = payload.error;
        } catch {
          // Use the SDK error message when the function response has no JSON body.
        }
        setError(message || 'The AI Judge could not complete this case. Please try again.');
        return;
      }
      setNotice(judgeResult?.reason === 'unreadable_ai_response'
        ? 'The AI response was unreadable, so the case was recorded as a mistrial because it was too severe to settle automatically.'
        : 'The AI Judge has reached a final verdict.');
      setReload((value) => value + 1);
    } catch {
      setError('The AI Judge could not complete this case. Please try again.');
    } finally {
      setBusy(false);
      setJudgingCaseId(null);
    }
  }

  if (loading) {
    return <Screen><ActivityIndicator color={Palette.forest} style={styles.loader} /></Screen>;
  }

  const defenseForPending = myPendingCase ? defenses.find((item) => item.case_id === myPendingCase.id) : undefined;

  return (
    <Screen>
      <PageHeader
        eyebrow={`${household.name} · Courtroom`}
        title="Court"
        subtitle="File a notice, let the accused respond, then send the record to the AI Judge."
        accessory={<Pill tone="amber">AI FINAL</Pill>}
      />

      <Card style={styles.accountCard}>
        <View style={styles.accountHeading}>
          <View style={styles.accountIcon}><Text style={styles.accountIconText}>§</Text></View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Signed in as {me}</Text>
            <Text style={styles.accountNote}>Court actions are filed under your account.</Text>
          </View>
          <Pill tone="green">LIVE</Pill>
        </View>
      </Card>

      {error ? <Card style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></Card> : null}
      {notice ? <Card style={styles.noticeCard}><Text style={styles.noticeText}>{notice}</Text></Card> : null}
      {pendingPhotoUpload ? (
        <Card style={styles.readyCard}>
          <Text style={styles.cardTitle}>Photos still need uploading</Text>
          <Text style={styles.bodyText}>{pendingPhotoUpload.photos.length} photo(s) are waiting to be attached to your filed notice.</Text>
          <ActionButton disabled={busy} label={busy ? 'Uploading…' : 'Retry photo upload'} onPress={() => { void retryPhotoUpload(); }} />
        </Card>
      ) : null}

      {myPendingCase ? (
        <View style={styles.sectionBlock}>
          <SectionHeading title="Your notice" detail="A defense is required before judgment" />
          <CaseCard
            item={myPendingCase}
            defenses={defenses}
            evidenceImages={evidenceImages}
            nameFor={(id) => profileById.get(id) ?? 'Flatmate'}
            onJudge={judgeCase}
            judging={false}
            disabled={busy}
          />
          <Card style={styles.formCard}>
            {defenseForPending ? (
              <>
                <Pill tone="green">DEFENSE SAVED</Pill>
                <Text style={styles.bodyText}>{defenseForPending.response}</Text>
                {defenseForPending.evidence_notes ? <Text style={styles.bodyText}>{defenseForPending.evidence_notes}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Post your defense</Text>
                <FormField label="Your response" multiline onChangeText={setDefense} placeholder="Explain your side of the situation." value={defense} />
                <EvidencePhotoPicker photos={defensePhotos} onChange={setDefensePhotos} onError={setError} disabled={busy} />
                <ActionButton disabled={busy || !defense.trim()} label={busy ? 'Saving…' : 'Post my defense'} onPress={() => { void postDefense(myPendingCase.id); }} />
              </>
            )}
          </Card>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionHeading title="File a notice" detail="One open notice per accused flatmate" />
        <Card style={styles.formCard}>
          {availableAccused.length ? (
            <>
              <Text style={styles.fieldLabel}>Flatmate</Text>
              <View style={styles.peopleList}>
                {availableAccused.map((person, index) => {
                  const selected = accusedId === person.user_id;
                  const initials = person.display_name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={person.user_id}
                      onPress={() => setSelectedAccusedId(person.user_id)}
                      style={[styles.personOption, selected && styles.personOptionSelected]}>
                      <Initials label={initials || '?'} color={avatarColors[index % avatarColors.length]} />
                      <Text style={[styles.personName, selected && styles.personNameSelected]}>{person.display_name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Charge</Text>
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
              <FormField label="Allegation" onChangeText={setAllegation} placeholder="What happened?" value={allegation} />
              <FormField label="Your statement" multiline onChangeText={setProsecutorStatement} placeholder="Explain the context and why you are filing." value={prosecutorStatement} />
              <EvidencePhotoPicker photos={prosecutionPhotos} onChange={setProsecutionPhotos} onError={setError} disabled={busy} />
              <ActionButton
                disabled={busy || !allegation.trim() || !prosecutorStatement.trim()}
                label={busy ? 'Sending…' : `Send notice to ${profileById.get(accusedId)?.split(' ')[0] ?? 'flatmate'}`}
                onPress={() => { void fileCase(); }}
              />
            </>
          ) : (
            <Text style={styles.bodyText}>
              {members.length <= 1
                ? 'Invite at least one flatmate before filing a notice.'
                : 'Every other flatmate has an open notice. New notices can be filed after a case is decided.'}
            </Text>
          )}
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Household cases" detail={`${cases.length} total`} />
        {cases.length ? cases.map((item) => (
          <CaseCard
            key={item.id}
            item={item}
            defenses={defenses}
            evidenceImages={evidenceImages}
            nameFor={(id) => profileById.get(id) ?? 'Flatmate'}
            onJudge={judgeCase}
            judging={judgingCaseId === item.id}
            disabled={busy && judgingCaseId !== item.id}
          />
        )) : (
          <Card><Text style={styles.bodyText}>No cases have been filed in this household.</Text></Card>
        )}
      </View>
    </Screen>
  );
}

function CaseCard({
  item,
  defenses,
  evidenceImages,
  nameFor,
  onJudge,
  judging,
  disabled,
}: {
  item: CourtCase;
  defenses: Defense[];
  evidenceImages: CaseEvidenceImage[];
  nameFor: (id: string) => string;
  onJudge: (caseId: string) => void;
  judging: boolean;
  disabled: boolean;
}) {
  const defense = defenses.find((entry) => entry.case_id === item.id);
  const prosecutionPhotos = evidenceImages.filter((image) => image.case_id === item.id && image.evidence_side === 'prosecution');
  const defensePhotos = evidenceImages.filter((image) => image.case_id === item.id && image.evidence_side === 'defense');
  const statusText = item.status === 'awaiting_defense'
    ? 'AWAITING DEFENSE'
    : item.status === 'ready_for_judgment'
      ? 'READY FOR AI'
      : outcomeLabel(item.status).toUpperCase();

  return (
    <Card style={styles.caseCard}>
      <View style={styles.caseHeader}>
        <View style={styles.caseCopy}>
          <Text style={styles.caseCharge}>{item.charge}</Text>
          <Text style={styles.caseMeta}>{nameFor(item.reporter_id)} filed against {nameFor(item.accused_id)}</Text>
        </View>
        <Pill tone={outcomeTone(item.status)}>{statusText}</Pill>
      </View>
      <Text style={styles.caseAllegation}>{item.allegation}</Text>
      <Text style={styles.statementLabel}>PROSECUTION</Text>
      <Text style={styles.bodyText}>{item.prosecutor_statement}</Text>
      {item.evidence_notes ? <Text style={styles.bodyText}>Evidence: {item.evidence_notes}</Text> : null}
      <StoredEvidencePhotos label="Prosecution photos" photos={prosecutionPhotos} />
      {defense ? (
        <View style={styles.defenseBlock}>
          <Text style={styles.statementLabel}>DEFENSE · {nameFor(defense.defendant_id)}</Text>
          <Text style={styles.bodyText}>{defense.response}</Text>
          {defense.evidence_notes ? <Text style={styles.bodyText}>Supporting details: {defense.evidence_notes}</Text> : null}
          <StoredEvidencePhotos label="Defense photos" photos={defensePhotos} />
        </View>
      ) : null}
      {item.verdict_summary ? <Text style={styles.bodyText}>Verdict: {item.verdict_summary}</Text> : null}
      {item.punishment_details ? <Text style={styles.punishmentText}>Punishment: {item.punishment_details}</Text> : null}
      {item.status === 'ready_for_judgment' ? (
        <View style={styles.judgeAction}>
          <Text style={styles.bodyText}>Running the AI Judge sends the case statements and private photos to OpenAI for review.</Text>
          <ActionButton
            disabled={disabled || judging}
            label={judging ? 'Judging…' : 'Send to AI Judge'}
            onPress={() => onJudge(item.id)}
          />
        </View>
      ) : null}
    </Card>
  );
}

function StoredEvidencePhotos({ label, photos }: { label: string; photos: CaseEvidenceImage[] }) {
  if (!photos.length) return null;
  return (
    <View style={styles.storedPhotosBlock}>
      <Text style={styles.statementLabel}>{label.toUpperCase()}</Text>
      <View style={styles.storedPhotos}>
        {photos.map((photo, index) => (
          <Image
            key={photo.id}
            accessibilityLabel={`${label}, photo ${index + 1}`}
            source={{ uri: photo.signed_url }}
            style={styles.storedPhoto}
          />
        ))}
      </View>
    </View>
  );
}

function outcomeLabel(status: string) {
  if (status === 'guilty') return 'Guilty';
  if (status === 'not_guilty') return 'Not guilty';
  if (status === 'mistrial') return 'Mistrial';
  return 'Awaiting';
}

function outcomeTone(status: string): 'green' | 'blue' | 'amber' | 'rose' {
  if (status === 'guilty') return 'green';
  if (status === 'not_guilty') return 'blue';
  if (status === 'mistrial') return 'rose';
  return 'amber';
}

const avatarColors = ['#E9DFCF', '#DCE6DD', '#E6DDE8', '#DCE5EC', '#F0DFD8'];

const styles = StyleSheet.create({
  sectionBlock: { gap: 12 },
  accountCard: { gap: 13 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.forestSoft },
  accountIconText: { color: Palette.forest, fontSize: 21, fontWeight: '800' },
  accountCopy: { flex: 1, gap: 3 },
  accountTitle: { color: Palette.ink, fontSize: 13, fontWeight: '900' },
  accountNote: { color: Palette.muted, fontSize: 10, lineHeight: 15 },
  formCard: { gap: 14 },
  fieldLabel: { color: Palette.ink, fontSize: 12, fontWeight: '800' },
  peopleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personOption: { minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 7, borderRadius: 14, borderWidth: 1, borderColor: Palette.line, backgroundColor: '#FAF8F2' },
  personOptionSelected: { borderColor: Palette.forest, backgroundColor: Palette.forestSoft },
  personName: { color: Palette.muted, fontSize: 11, fontWeight: '800' },
  personNameSelected: { color: Palette.forest },
  chargeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chargeChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: Palette.line, backgroundColor: '#FAF8F2' },
  chargeChipSelected: { backgroundColor: Palette.forest, borderColor: Palette.forest },
  chargeText: { color: Palette.muted, fontSize: 10, fontWeight: '700' },
  chargeTextSelected: { color: '#FFFFFF' },
  caseCard: { gap: 11 },
  caseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  caseCopy: { flex: 1, gap: 3 },
  caseCharge: { color: Palette.ink, fontSize: 14, fontWeight: '900' },
  caseMeta: { color: Palette.muted, fontSize: 10 },
  caseAllegation: { color: Palette.ink, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  statementLabel: { color: Palette.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  bodyText: { color: Palette.muted, fontSize: 11, lineHeight: 17 },
  defenseBlock: { gap: 6, padding: 11, borderRadius: 13, backgroundColor: Palette.forestSoft },
  storedPhotosBlock: { gap: 6 },
  storedPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  storedPhoto: { width: 104, height: 88, borderRadius: 12, backgroundColor: Palette.line },
  punishmentText: { color: Palette.forest, fontSize: 11, fontWeight: '800' },
  readyCard: { gap: 10, borderColor: '#C9DED2', backgroundColor: '#F3F8F4' },
  judgeAction: { gap: 8, paddingTop: 3 },
  cardTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  errorCard: { backgroundColor: Palette.roseSoft, borderColor: Palette.roseSoft },
  errorText: { color: Palette.rose, fontSize: 12, lineHeight: 18 },
  noticeCard: { backgroundColor: Palette.forestSoft, borderColor: Palette.forestSoft },
  noticeText: { color: Palette.forest, fontSize: 12, lineHeight: 18 },
  loader: { paddingVertical: 30 },
});
