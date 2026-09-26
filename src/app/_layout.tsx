import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthScreen } from '@/components/auth-screen';
import AppTabs from '@/components/app-tabs';
import { Palette } from '@/components/flat-judge-ui';
import { Typography } from '@/constants/typography';
import { HouseholdGate } from '@/components/household-gate';
import { completeInitialOAuthRedirect } from '@/lib/auth';
import {
  dispatchPendingCaseNotifications,
  registerAndroidPushNotifications,
  subscribeToCaseNotificationNavigation,
  unregisterAndroidPushNotifications,
} from '../lib/push-notifications';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [authError, setAuthError] = useState<string | null>(null);
  const pushUserId = useRef<string | null>(null);

  useEffect(() => subscribeToCaseNotificationNavigation(), []);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    const previousUserId = pushUserId.current;
    if (previousUserId && previousUserId !== userId) {
      void unregisterAndroidPushNotifications(previousUserId);
    }
    pushUserId.current = userId;

    if (userId) {
      void registerAndroidPushNotifications(userId, false)
        .catch(() => false)
        .then(() => dispatchPendingCaseNotifications());
    }
  }, [session?.user.id]);

  useEffect(() => {
    let mounted = true;
    const fallbackTimer = Platform.OS === 'web' ? null : setTimeout(() => {
      if (mounted) {
        setAuthError('Session restore took too long. Sign in again to continue.');
        setReady(true);
      }
    }, 8000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setReady(true);
      }
    });

    async function restoreSession() {
      try {
        const redirectError = await completeInitialOAuthRedirect();
        if (redirectError) setAuthError(redirectError.message);
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (mounted) setSession(data.session);
      } catch (error) {
        if (mounted) setAuthError(error instanceof Error ? error.message : 'Unable to restore your session.');
      } finally {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (mounted) setReady(true);
      }
    }

    void restoreSession();
    return () => {
      mounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      {ready ? (
        session ? (
          <HouseholdGate userId={session.user.id}>
            <AppTabs />
          </HouseholdGate>
        ) : <AuthScreen initialMessage={authError} />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={Palette.accent} />
          <Text style={styles.loadingLabel}>Checking your sign-in…</Text>
        </View>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Palette.paper },
  loadingLabel: { color: Palette.muted, fontSize: Typography.caption, fontWeight: '600' },
});
