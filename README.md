# STRAVIO

Stravio is a Vite + React strategy workspace. The production data/auth backend is Supabase (PostgreSQL, Auth, RLS and Edge Functions).

## Backend setup

1. Create a Supabase project and configure Email auth. Enable Google OAuth in Supabase only if Google sign-in is required; register the project callback URL with Google.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` to the project root URL (for example, `https://<project-ref>.supabase.co`, without `/rest/v1`) and `VITE_SUPABASE_ANON_KEY`. The anon key is public; never add the `service_role` key to frontend variables.
3. Install the Supabase CLI and authenticate, then run `supabase link --project-ref <project-ref>` and `supabase db push` to apply the RLS schema and RPCs.
4. Configure the Edge Function server secrets with `supabase secrets set AI_API_KEY=... AI_MODEL=gpt-4o-mini AI_BASE_URL=https://api.openai.com/v1/chat/completions APP_ORIGIN=https://your-app.example`. For local Vite development, set `APP_ORIGIN=http://localhost:5173` in the Supabase project's function secrets.
5. Deploy the authenticated AI endpoint with `supabase functions deploy ai`.
6. Run `npm install`, `npm run dev`, and `npm run build`.

Vite deployments can serve the generated `dist/` directory on any static host. Configure `VITE_SUPABASE_URL` (the project root, without `/rest/v1`) and `VITE_SUPABASE_ANON_KEY` in the frontend build environment; configure `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` and the exact frontend `APP_ORIGIN` as Supabase Edge Function secrets. In Supabase Auth URL Configuration, set the Site URL to the deployed frontend origin and add that origin to the redirect allow-list. Email confirmation is enabled on the currently configured Supabase project, so new users must confirm their email before signing in. No frontend `VITE_` variable may contain a secret.

If `AI_API_KEY` is absent, the authenticated endpoint stores and returns `AI Agent is not connected yet.` without calling an external provider. AI proposals require an explicit Apply/Create Tasks or Cancel action.

## Local data migration

Sign in to the cloud account with the same email as the previous local account, open Settings, review the detected record counts, then select **Import local data**. The import is authenticated, transactionally scoped to the signed-in user, repeatable, and does not remove the browser source. Local password hashes are not migrated; passwords remain managed by Supabase Auth. Project workspace files are not part of the current database schema and remain local.

## Security model

All workspace tables use row-level security; child rows carry a composite `(strategy_id, user_id)` foreign key. Edge Functions validate the caller JWT and use the caller's RLS-scoped session. Only `AI_API_KEY` is a server-side secret. Set `APP_ORIGIN` to the exact deployed frontend origin before production deployment.
