import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { useHousehold } from '@/components/household-gate';
import { supabase } from '@/lib/supabase';

type Member = { user_id: string; role: string };
type Profile = { id: string; display_name: string };
type Chore = { id: string; assigned_to: string | null; title: string; schedule: string; is_active: boolean };
type CaseRecord = {
  id: string;
  accused_id: string;
  charge: string;
  allegation: string;
  status: string;
  verdict_summary: string | null;
  punishment_details: string | null;
  created_at: string;
};

const avatarColors = ['#E9DFCF', '#DCE6DD', '#E6DDE8', '#DCE5EC', '#F0DFD8'];

export default function ProfilesScreen() {
  const household = useHousehold();
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfiles() {
      setLoading(true);
      setError(null);
      const memberResult = await supabase
        .from('household_members')
        .select('user_id, role')
        .eq('household_id', household.id)
        .order('joined_at', { ascending: true });

      if (memberResult.error) {
        if (active) setError(memberResult.error.message);
        if (active) setLoading(false);
        return;
      }

      const nextMembers = memberResult.data ?? [];
      const memberIds = nextMembers.map((member) => member.user_id);
      const [profileResult, choreResult, caseResult] = await Promise.all([
        memberIds.length
          ? supabase.from('profiles').select('id, display_name').in('id', memberIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('chores')
          .select('id, assigned_to, title, schedule, is_active')
          .eq('household_id', household.id)
          .eq('is_active', true),
        supabase
          .from('cases')
          .select('id, accused_id, charge, allegation, status, verdict_summary, punishment_details, created_at')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false }),
      ]);

      const failed = profileResult.error ?? choreResult.error ?? caseResult.error;
      if (active) {
        if (failed) {
          setError(failed.message);
        } else {
          setMembers(nextMembers);
          setProfiles(profileResult.data ?? []);
          setChores(choreResult.data ?? []);
          setCases(caseResult.data ?? []);
          setExpandedId((current) => current ?? nextMembers[0]?.user_id ?? null);
        }
        setLoading(false);
      }
    }

    void loadProfiles();
    return () => {
      active = false;
    };
  }, [household.id]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  const activeCases = cases.filter((item) => item.status === 'awaiting_defense' || item.status === 'ready_for_judgment');

  return (
    <Screen>
      <PageHeader
        eyebrow="Household ledger"
        title="Profiles"
        subtitle="Chores and court records for the people in your household."
        accessory={
          <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.signOutButton}>
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </Pressable>
        }
      />

      <Card style={styles.houseCard}>
        <View style={styles.houseIcon}><Text style={styles.houseIconText}>⌂</Text></View>
        <View style={styles.houseCopy}>
          <Text style={styles.houseTitle}>{household.name}</Text>
          <Text style={styles.houseDescription}>Invite code · {household.inviteCode}</Text>
        </View>
        <View style={styles.houseStat}>
          <Text style={styles.statNumber}>{String(activeCases.length).padStart(2, '0')}</Text>
          <Text style={styles.statCaption}>open cases</Text>
        </View>
      </Card>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Flatmates" detail={`${members.length} ${members.length === 1 ? 'member' : 'members'}`} />
        {loading ? (
          <ActivityIndicator color={Palette.forest} style={styles.loader} />
        ) : error ? (
          <Card><Text style={styles.errorText}>Could not load household profiles: {error}</Text></Card>
        ) : profiles.length ? (
          <View style={styles.profileList}>
            {members.map((member, index) => {
              const person = profiles.find((profile) => profile.id === member.user_id);
              if (!person) return null;
              const personChores = chores.filter((chore) => chore.assigned_to === person.id);
              const personCases = cases.filter((item) => item.accused_id === person.id);
              const convictions = personCases.filter((item) => item.status === 'guilty').length;
              const expanded = expandedId === person.id;
              const initials = person.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  key={person.id}
                  onPress={() => setExpandedId(expanded ? null : person.id)}
                  style={({ pressed }) => [styles.profilePressable, pressed && styles.pressed]}>
                  <Card style={styles.profileCard}>
                    <View style={styles.profileTop}>
                      <Initials label={initials || '?'} color={avatarColors[index % avatarColors.length]} />
                      <View style={styles.profileIdentity}>
                        <Text style={styles.name}>{person.display_name}</Text>
                        <Text style={styles.role}>{member.role}</Text>
                      </View>
                      <View style={styles.recordCount}>
                        <Text style={styles.recordNumber}>{convictions}</Text>
                        <Text style={styles.recordLabel}>convictions</Text>
                      </View>
                    </View>

                    <View style={styles.choreRow}>
                      {personChores.length ? personChores.map((chore) => (
                        <Pill key={chore.id}>{chore.title}</Pill>
                      )) : <Text style={styles.emptyRecord}>No chores assigned yet</Text>}
                    </View>

                    {expanded ? (
                      <View style={styles.recordDetails}>
                        <Divider />
                        <Text style={styles.recordHeading}>PAST CASES</Text>
                        {personCases.length ? personCases.map((item) => (
                          <View key={item.id} style={styles.caseRow}>
                            <View style={styles.caseCopy}>
                              <Text style={styles.caseTitle}>{item.charge}</Text>
                              <Text style={styles.caseAllegation}>{item.allegation}</Text>
                              {item.punishment_details ? <Text style={styles.casePunishment}>{item.punishment_details}</Text> : null}
                            </View>
                            <Pill tone={outcomeTone(item.status)}>{outcomeLabel(item.status)}</Pill>
                          </View>
                        )) : <Text style={styles.emptyRecord}>No past cases on the household record.</Text>}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card><Text style={styles.emptyRecord}>No household members were found.</Text></Card>
        )}
      </View>

      <Card style={styles.noticeCard}>
        <View style={styles.noticeMark}><Text style={styles.noticeMarkText}>i</Text></View>
        <Text style={styles.noticeText}>Names may be shared. Account identity is tied to the verified sign-in, and household records stay with this household.</Text>
      </Card>
    </Screen>
  );
}

function outcomeLabel(status: string) {
  if (status === 'guilty') return 'Guilty';
  if (status === 'not_guilty') return 'Not guilty';
  if (status === 'mistrial') return 'Mistrial';
  if (status === 'ready_for_judgment') return 'Ready';
  return 'Awaiting';
}

function outcomeTone(status: string): 'green' | 'blue' | 'amber' | 'rose' {
  if (status === 'guilty') return 'green';
  if (status === 'not_guilty') return 'blue';
  if (status === 'mistrial') return 'rose';
  return 'amber';
}

const styles = StyleSheet.create({
  signOutButton: { marginTop: 2, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: Palette.line, borderRadius: 12, backgroundColor: Palette.card },
  signOutText: { color: Palette.forest, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  houseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.forest, borderColor: Palette.forest, padding: 16 },
  houseIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  houseIconText: { color: '#FFFFFF', fontSize: 31, fontWeight: '500', lineHeight: 36 },
  houseCopy: { flex: 1, gap: 4, marginLeft: 12 },
  houseTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  houseDescription: { color: '#D6E5DC', fontSize: 11 },
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
  role: { color: Palette.muted, fontSize: 12, textTransform: 'capitalize' },
  recordCount: { alignItems: 'center', minWidth: 64, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: Palette.amberSoft },
  recordNumber: { color: Palette.ink, fontSize: 17, fontWeight: '900' },
  recordLabel: { color: Palette.muted, fontSize: 9, fontWeight: '700' },
  choreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  recordDetails: { gap: 10, paddingTop: 1 },
  recordHeading: { color: Palette.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  caseRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingVertical: 3 },
  caseCopy: { flex: 1, gap: 3 },
  caseTitle: { color: Palette.ink, fontSize: 12, fontWeight: '700' },
  caseAllegation: { color: Palette.muted, fontSize: 11, lineHeight: 16 },
  casePunishment: { color: Palette.forest, fontSize: 10, fontWeight: '700' },
  emptyRecord: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  noticeCard: { flexDirection: 'row', gap: 11, padding: 14, backgroundColor: '#F0EDE4' },
  noticeMark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.forestSoft },
  noticeMarkText: { color: Palette.forest, fontWeight: '900', fontSize: 13 },
  noticeText: { flex: 1, color: Palette.muted, fontSize: 11, lineHeight: 17 },
  loader: { paddingVertical: 24 },
  errorText: { color: Palette.rose, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.88 },
});
