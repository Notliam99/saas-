# Android case push notifications

Case events are written to `push_notification_events` by database triggers. The app dispatches pending events after filing a case or submitting a defense; `judge-case` dispatches after it saves a verdict. Events remain queued when a recipient has not registered a device yet or Expo reports a temporary delivery error.

## Setup

1. In Firebase, register an Android app with package ID `app.expo.judgy`, download its `google-services.json`, and set `expo.android.googleServicesFile` in `app.json` to that file. Upload the Firebase service-account key to the existing EAS project for FCM V1 using the [Expo setup guide](https://docs.expo.dev/push-notifications/fcm-credentials/). Keep the service-account key private; `google-services.json` contains public-facing identifiers. Remote push notifications are not available in Expo Go.
2. Push the migration and deploy both Edge Functions:

```bash
bunx supabase db push --project-ref qsvxklxhwvjlljnckrkl
bunx supabase functions deploy dispatch-case-notifications --project-ref qsvxklxhwvjlljnckrkl
bunx supabase functions deploy judge-case --project-ref qsvxklxhwvjlljnckrkl
```

3. Create and install an Android development build:

```bash
bunx eas-cli build --platform android --profile development
```

Then start the app with `bunx expo start` and open it in the installed development build. The app URL scheme is now `judgy`, so add `judgy://**` to Supabase Auth's allowed redirect URLs for native OAuth sign-in.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The dispatcher validates signed-in users itself and also accepts an internal request authenticated with the service-role key from `judge-case`. If Expo push access-token security is enabled for the EAS project, set `EXPO_ACCESS_TOKEN` as an Edge Function secret.

Users opt in from the Court screen. Expo push tokens are stored server-side and associated with the signed-in account. The dispatcher signs a private evidence image URL for one hour and sends it as an Android notification preview when a relevant photo exists. Notification title and body text are still sent if no preview can be loaded.
