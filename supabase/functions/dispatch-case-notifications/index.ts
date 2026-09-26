import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function shortText(value: string, maxLength = 180) {
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Push delivery is not configured.' }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { action?: string; expoPushToken?: string; caseId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'The request body must be valid JSON.' }, 400);
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!bearer) return jsonResponse({ error: 'Sign in to manage push notifications.' }, 401);

  const isInternal = bearer === serviceRoleKey;
  let userId: string | null = null;
  if (!isInternal) {
    const { data, error } = await admin.auth.getUser(bearer);
    if (error || !data.user) return jsonResponse({ error: 'Your session is not valid.' }, 401);
    userId = data.user.id;
  }

  if (body.action === 'register' || body.action === 'unregister') {
    if (!userId) return jsonResponse({ error: 'Only signed-in users can manage their devices.' }, 403);
    const token = body.expoPushToken?.trim() ?? '';
    if (!token || token.length > 512 || !/^(Expo|Exponent)PushToken\[.+\]$/.test(token)) {
      return jsonResponse({ error: 'A valid Expo push token is required.' }, 400);
    }

    if (body.action === 'register') {
      const { error } = await admin.from('push_devices').upsert({
        expo_push_token: token,
        user_id: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'expo_push_token' });
      if (error) return jsonResponse({ error: 'Could not register this device for push notifications.' }, 500);
      return jsonResponse({ ok: true });
    }

    const { error } = await admin.from('push_devices')
      .delete()
      .eq('expo_push_token', token)
      .eq('user_id', userId);
    if (error) return jsonResponse({ error: 'Could not unregister this device.' }, 500);
    return jsonResponse({ ok: true });
  }

  if (body.action !== 'dispatch') return jsonResponse({ error: 'Unknown notification action.' }, 400);
  if (isInternal && !body.caseId) return jsonResponse({ error: 'A caseId is required for internal dispatch.' }, 400);

  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await admin.from('push_notification_events')
    .update({ status: 'pending', processing_started_at: null, next_attempt_at: new Date().toISOString() })
    .eq('status', 'processing')
    .lt('processing_started_at', staleBefore);

  let eventQuery = admin.from('push_notification_events')
    .select('id, case_id, event_type, actor_id, recipient_id, attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(30);

  if (isInternal) {
    eventQuery = eventQuery.eq('case_id', body.caseId!);
  } else {
    eventQuery = eventQuery.or(`recipient_id.eq.${userId},actor_id.eq.${userId}`);
  }

  const { data: events, error: eventError } = await eventQuery;
  if (eventError) return jsonResponse({ error: 'Could not load pending case notifications.' }, 500);

  let sent = 0;
  for (const event of events ?? []) {
    const { data: devices, error: devicesError } = await admin.from('push_devices')
      .select('expo_push_token')
      .eq('user_id', event.recipient_id);
    if (devicesError || !devices?.length) continue;

    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin.from('push_notification_events')
      .update({ status: 'processing', processing_started_at: claimedAt, attempts: event.attempts + 1 })
      .eq('id', event.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (claimError || !claimed) continue;

    const failEvent = async (message: string) => {
      await admin.from('push_notification_events').update({
        status: 'pending',
        processing_started_at: null,
        next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        last_error: message.slice(0, 500),
      }).eq('id', event.id);
    };

    const { data: courtCase, error: caseError } = await admin.from('cases')
      .select('id, reporter_id, accused_id, charge, allegation, prosecutor_statement, status, verdict_summary')
      .eq('id', event.case_id)
      .maybeSingle();
    if (caseError || !courtCase) {
      await failEvent('Could not load the case for this notification.');
      continue;
    }

    const { data: profiles } = await admin.from('profiles')
      .select('id, display_name')
      .in('id', [courtCase.reporter_id, courtCase.accused_id]);
    const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const reporterName = profileNames.get(courtCase.reporter_id) ?? 'Your flatmate';
    const accusedName = profileNames.get(courtCase.accused_id) ?? 'Your flatmate';

    let title = '';
    let summary = '';
    let evidenceSide: 'prosecution' | 'defense' | null = null;
    if (event.event_type === 'case_filed') {
      title = `${reporterName} filed a case against you`;
      summary = `${courtCase.charge}: ${courtCase.allegation}`;
      evidenceSide = 'prosecution';
    } else if (event.event_type === 'defense_submitted') {
      const { data: defense } = await admin.from('case_defenses')
        .select('response')
        .eq('case_id', event.case_id)
        .maybeSingle();
      title = `${accusedName} responded to your case`;
      summary = `${courtCase.charge}: ${defense?.response ?? 'A defense was submitted.'}`;
      evidenceSide = 'defense';
    } else {
      title = `AI Judge verdict: ${courtCase.status.replaceAll('_', ' ')}`;
      summary = `${courtCase.charge}: ${courtCase.verdict_summary ?? 'The case has been decided.'}`;
      evidenceSide = 'defense';
    }

    let imageUrl: string | undefined;
    const evidenceSides = event.event_type === 'verdict' ? ['defense', 'prosecution'] : [evidenceSide];
    for (const side of evidenceSides) {
      if (!side) continue;
      const { data: evidence } = await admin.from('case_evidence')
        .select('storage_path')
        .eq('case_id', event.case_id)
        .eq('evidence_side', side)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!evidence?.storage_path) continue;

      const { data: signed } = await admin.storage.from('case-evidence')
        .createSignedUrl(evidence.storage_path, 60 * 60);
      if (signed?.signedUrl) {
        imageUrl = signed.signedUrl;
        break;
      }
    }

    const messages = devices.map((device) => ({
      to: device.expo_push_token,
      title: shortText(title, 100),
      body: shortText(summary),
      sound: 'default',
      channelId: 'case-updates',
      priority: 'high',
      data: { caseId: event.case_id, eventType: event.event_type },
      ...(imageUrl ? { richContent: { image: imageUrl } } : {}),
    }));

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    let expoResponse: Response;
    try {
      expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
    } catch {
      await failEvent('Could not reach the Expo Push Service.');
      continue;
    }

    const result = await expoResponse.json().catch(() => ({}));
    const tickets = Array.isArray(result?.data) ? result.data : [];
    const delivered = tickets.some((ticket: { status?: string }) => ticket.status === 'ok');
    const invalidTokens = tickets.flatMap((ticket: { status?: string; details?: { error?: string } }, index: number) =>
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? [messages[index]?.to]
        : []
    ).filter(Boolean);

    if (invalidTokens.length) {
      await admin.from('push_devices').delete().in('expo_push_token', invalidTokens);
    }

    if (!expoResponse.ok || !delivered) {
      const errorMessage = tickets.find((ticket: { message?: string }) => ticket.message)?.message
        ?? `Expo push request failed with HTTP ${expoResponse.status}.`;
      await failEvent(errorMessage);
      continue;
    }

    const { error: sentError } = await admin.from('push_notification_events').update({
      status: 'sent',
      processing_started_at: null,
      sent_at: new Date().toISOString(),
      last_error: null,
    }).eq('id', event.id);
    if (!sentError) sent += 1;
  }

  return jsonResponse({ ok: true, sent });
});
