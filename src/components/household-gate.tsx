import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Card,
  FormField,
  PageHeader,
  Palette,
  Screen,
} from '@/components/flat-judge-ui';
import { supabase } from '@/lib/supabase';

export type Household = {
  id: string;
  name: string;
  inviteCode: string;
};

const HouseholdContext = createContext<Household | null>(null);

export function useHousehold() {
  const household = useContext(HouseholdContext);
  if (!household) throw new Error('Household data is not available.');
  return household;
}

export function HouseholdGate({ userId, children }: PropsWithChildren<{ userId: string }>) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHousehold() {
      setLoading(true);
      setError(null);
      try {
        const { data: membership, error: membershipError } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (membershipError) throw membershipError;
        if (!membership) {
          if (active) setHousehold(null);
          return;
        }

        const { data, error: householdError } = await supabase
          .from('households')
          .select('id, name, invite_code')
          .eq('id', membership.household_id)
          .single();

        if (householdError) throw householdError;
        if (active) {
          setHousehold({ id: data.id, name: data.name, inviteCode: data.invite_code });
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your household.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHousehold();
    return () => {
      active = false;
    };
  }, [attempt, userId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Palette.forest} />
        <Text style={styles.loadingLabel}>Loading your household…</Text>
      </View>
    );
  }

  if (error) {
    return <SetupError message={error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  if (!household) {
    return <HouseholdOnboarding onComplete={() => setAttempt((value) => value + 1)} />;
  }

  return <HouseholdContext.Provider value={household}>{children}</HouseholdContext.Provider>;
}

function HouseholdOnboarding({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (mode === 'create' && !householdName.trim()) {
      setError('Add a name for your household.');
      return;
    }
    if (mode === 'join' && !inviteCode.trim()) {
      setError('Enter the household invite code.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = mode === 'create'
      ? await supabase.rpc('create_household', { household_name: householdName.trim() })
      : await supabase.rpc('join_household', { code: inviteCode.trim().toUpperCase() });

    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }

    onComplete();
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="One last setup"
        title="Your household"
        subtitle="Create a household for your flat, or join one with an invite code."
      />
      <Card style={styles.onboardingCard}>
        <View style={styles.modeRow}>
          <ModeButton active={mode === 'create'} label="Create household" onPress={() => { setMode('create'); setError(null); }} />
          <ModeButton active={mode === 'join'} label="Join household" onPress={() => { setMode('join'); setError(null); }} />
        </View>
        {mode === 'create' ? (
          <FormField
            label="Household name"
            onChangeText={setHouseholdName}
            placeholder="For example: The Fernery"
            value={householdName}
          />
        ) : (
          <FormField
            label="Invite code"
            onChangeText={setInviteCode}
            placeholder="Enter the code from a flatmate"
            value={inviteCode}
          />
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <ActionButton
          disabled={busy}
          label={busy ? 'Please wait…' : mode === 'create' ? 'Create household' : 'Join household'}
          onPress={submit}
        />
      </Card>
      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>Invite your flatmates</Text>
        <Text style={styles.helpCopy}>After creating a household, share its invite code from the Profiles tab so everyone joins the same court.</Text>
      </Card>
      <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

function SetupError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Screen>
      <PageHeader eyebrow="Household setup" title="Almost there" subtitle="We couldn't load your household yet." />
      <Card style={styles.onboardingCard}>
        <Text style={styles.errorText}>{message}</Text>
        <Text style={styles.helpCopy}>If the database tables or functions are missing, apply the Supabase migration and try again.</Text>
        <ActionButton label="Try again" onPress={onRetry} />
        <Pressable accessibilityRole="button" onPress={() => { void supabase.auth.signOut(); }} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Palette.paper },
  loadingLabel: { color: Palette.muted, fontSize: 12, fontWeight: '600' },
  onboardingCard: { gap: 16 },
  modeRow: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: '#EAE6DC' },
  modeButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  modeButtonActive: { backgroundColor: Palette.card },
  modeLabel: { color: Palette.muted, fontSize: 12, fontWeight: '700' },
  modeLabelActive: { color: Palette.ink, fontWeight: '900' },
  errorText: { color: Palette.rose, fontSize: 12, lineHeight: 18 },
  helpCard: { gap: 7, backgroundColor: Palette.forestSoft, borderColor: Palette.forestSoft },
  helpTitle: { color: Palette.forest, fontSize: 14, fontWeight: '900' },
  helpCopy: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  signOutButton: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  signOutText: { color: Palette.muted, fontSize: 12, fontWeight: '800' },
});
