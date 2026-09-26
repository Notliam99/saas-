import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/components/flat-judge-ui';
import { Typography } from '@/constants/typography';
import { signInWithSocialProvider, type SocialProvider } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Mode = 'sign_in' | 'create_account';

export function AuthScreen({ initialMessage }: { initialMessage?: string | null }) {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [messageIsError, setMessageIsError] = useState(Boolean(initialMessage));

  const normalizedEmail = email.trim().toLowerCase();

  async function sendCode() {
    if (!normalizedEmail.includes('@')) {
      setMessage('Enter a valid email address to continue.');
      setMessageIsError(true);
      return;
    }

    if (mode === 'create_account' && !displayName.trim()) {
      setMessage('Add a display name for your flatmate profile.');
      setMessageIsError(true);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: mode === 'create_account',
          ...(mode === 'create_account'
            ? { data: { display_name: displayName.trim() } }
            : {}),
        },
      });

      if (error) throw error;
      setCodeSent(true);
      setMessage(`A one-time code is on its way to ${normalizedEmail}.`);
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send a sign-in code.');
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code.trim())) {
      setMessage('Enter the six-digit code from your email.');
      setMessageIsError(true);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code.trim(),
        type: 'email',
      });

      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That code could not be verified.');
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function continueWith(provider: SocialProvider) {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithSocialProvider(provider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Social sign-in could not be started.');
      setMessageIsError(true);
      setBusy(false);
      return;
    }
    if (Platform.OS !== 'web') setBusy(false);
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setCodeSent(false);
    setCode('');
    setMessage(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>J</Text></View>
            <Text style={styles.brandName}>Judgy</Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>A fairer way to handle flatmate friction</Text>
            <Text style={styles.title}>{codeSent ? 'Check your inbox.' : 'Come on in.'}</Text>
            <Text style={styles.subtitle}>
              {codeSent
                ? `Enter the six-digit code sent to ${normalizedEmail}.`
                : 'Sign in to your household court or create an account to get started.'}
            </Text>
          </View>

          {!codeSent ? (
            <>
              <View style={styles.modeSwitch}>
                <ModeButton
                  active={mode === 'sign_in'}
                  label="Sign in"
                  onPress={() => changeMode('sign_in')}
                />
                <ModeButton
                  active={mode === 'create_account'}
                  label="Create account"
                  onPress={() => changeMode('create_account')}
                />
              </View>

              <View style={styles.form}>
                {mode === 'create_account' ? (
                  <InputField
                    autoCapitalize="words"
                    label="Display name"
                    onChangeText={setDisplayName}
                    placeholder="What should your flatmates call you?"
                    value={displayName}
                  />
                ) : null}
                <InputField
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  label="Email address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  value={email}
                />
                {mode === 'create_account' ? (
                  <Text style={styles.helper}>Display names can be shared by multiple people.</Text>
                ) : null}
                <PrimaryButton
                  disabled={busy}
                  label={mode === 'create_account' ? 'Create account with email' : 'Email me a sign-in code'}
                  onPress={sendCode}
                />
              </View>

              <View style={styles.separatorRow}>
                <View style={styles.separator} />
                <Text style={styles.separatorLabel}>or use</Text>
                <View style={styles.separator} />
              </View>

              <View style={styles.socialButtons}>
                <SocialButton disabled={busy} label="Apple" onPress={() => continueWith('apple')} />
                <SocialButton disabled={busy} label="Google" onPress={() => continueWith('google')} />
              </View>
            </>
          ) : (
            <View style={styles.form}>
              <InputField
                autoCapitalize="none"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                label="One-time code"
                maxLength={6}
                onChangeText={setCode}
                placeholder="123456"
                value={code}
              />
              <PrimaryButton disabled={busy} label="Verify and sign in" onPress={verifyCode} />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setCodeSent(false)}
                style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Use a different email or sign-in method</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={sendCode} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Send another code</Text>
              </Pressable>
            </View>
          )}

          {message ? (
            <View style={[styles.messageBox, messageIsError && styles.errorBox]}>
              <Text style={[styles.messageText, messageIsError && styles.errorText]}>{message}</Text>
            </View>
          ) : null}

          {busy ? <ActivityIndicator color={Palette.accent} style={styles.loader} /> : null}
          <Text style={styles.footnote}>Your name is for your household profile. Your email keeps your account secure.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeButtonLabel, active && styles.modeButtonLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  autoComplete,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize: 'none' | 'words';
  autoComplete?: 'email' | 'one-time-code';
  keyboardType?: 'email-address' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Palette.muted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function SocialButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.socialButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.socialLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  scrollContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: Palette.ink, fontSize: Typography.heading, fontWeight: '900' },
  brandName: { color: Palette.ink, fontSize: Typography.body, fontWeight: '800' },
  intro: { gap: 8, marginTop: 6 },
  eyebrow: { color: Palette.ink, fontSize: Typography.body, fontWeight: '700' },
  title: { color: Palette.ink, fontSize: Typography.display, lineHeight: 40, fontWeight: '900', letterSpacing: -1.1 },
  subtitle: { maxWidth: 410, color: Palette.muted, fontSize: Typography.body, lineHeight: 21 },
  modeSwitch: { flexDirection: 'row', padding: 4, borderRadius: 15, backgroundColor: Palette.paper },
  modeButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: Palette.accent },
  modeButtonLabel: { color: Palette.muted, fontSize: Typography.body, fontWeight: '700' },
  modeButtonLabelActive: { color: Palette.ink, fontWeight: '900' },
  form: { gap: 14 },
  inputGroup: { gap: 7 },
  inputLabel: { color: Palette.ink, fontSize: Typography.caption, fontWeight: '800' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: 14,
    backgroundColor: Palette.card,
    paddingHorizontal: 15,
    color: Palette.ink,
    fontSize: Typography.body,
  },
  helper: { marginTop: -7, color: Palette.muted, fontSize: Typography.caption },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.accent,
    paddingHorizontal: 18,
  },
  primaryButtonLabel: { color: Palette.ink, fontSize: Typography.body, fontWeight: '900' },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  separator: { height: 1, flex: 1, backgroundColor: Palette.line },
  separatorLabel: { color: Palette.muted, fontSize: Typography.caption, fontWeight: '600' },
  socialButtons: { flexDirection: 'row', gap: 10 },
  socialButton: {
    minHeight: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.card,
  },
  socialLabel: { color: Palette.ink, fontSize: Typography.body, fontWeight: '800' },
  messageBox: { borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Palette.line, backgroundColor: Palette.paper },
  errorBox: { borderColor: Palette.accent },
  messageText: { color: Palette.ink, fontSize: Typography.body, lineHeight: 20 },
  errorText: { color: Palette.ink },
  loader: { marginTop: -10 },
  textButton: { alignSelf: 'center', paddingVertical: 5 },
  textButtonLabel: { color: Palette.ink, fontSize: Typography.caption, fontWeight: '800' },
  footnote: { color: Palette.muted, fontSize: Typography.caption, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
