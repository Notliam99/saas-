# AI Judge function

The function uses the OpenAI Responses API from Supabase Edge Functions. Keep `OPENAI_API_KEY` on the server; never add it to an Expo `EXPO_PUBLIC_*` variable.

For local Supabase development, create `supabase/functions/.env` with:

```env
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
```

For the hosted project, add `OPENAI_API_KEY` as an Edge Function secret in Supabase Dashboard → Edge Functions → Secrets. `OPENAI_MODEL` is optional. Deploy with:

```bash
bunx supabase functions deploy judge-case --project-ref qsvxklxhwvjlljnckrkl
```

The function requires an authenticated household member, a case in `ready_for_judgment`, and the accused's submitted defense. It stores only the verdict and selected punishment; the AI's internal severity score is not returned or stored. OpenAI requests use `store: false`. Case statements and temporary signed photo URLs are sent to OpenAI when a member asks the AI Judge to decide.

No database migration is needed for this function with the existing schema.
