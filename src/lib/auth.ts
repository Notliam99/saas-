import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

export type SocialProvider = 'apple' | 'google';

export async function signInWithSocialProvider(provider: SocialProvider) {
  const redirectTo =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : Linking.createURL('');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) throw error;
  if (Platform.OS === 'web') return;
  if (!data.url) throw new Error('The sign-in provider did not return a sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const params = Linking.parse(result.url).queryParams ?? {};
  const providerError = params.error_description ?? params.error;
  if (typeof providerError === 'string') throw new Error(providerError);

  const code = params.code;
  if (typeof code !== 'string') {
    throw new Error('Sign-in finished without a verification code. Please try again.');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function completeInitialOAuthRedirect() {
  const url =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.href
      : await Linking.getInitialURL();

  if (!url) return null;

  const params = Linking.parse(url).queryParams ?? {};
  const providerError = params.error_description ?? params.error;
  const code = params.code;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && (code || providerError)) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  if (typeof providerError === 'string') return new Error(providerError);
  if (typeof code !== 'string') return null;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error;
}
