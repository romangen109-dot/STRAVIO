# STRAVIO

Stravio is a Vite + React strategy workspace. The production data/auth backend is Supabase (PostgreSQL, Auth, RLS and Edge Functions).

## Backend setup

1. Create a Supabase project. In **Authentication → Providers → Email**, enable email/password sign-in and decide whether email confirmation is required. When confirmation is enabled, users must follow the confirmation link before password sign-in.
2. In **Authentication → URL Configuration**, set **Site URL** to the canonical app origin, for example `https://your-app.vercel.app`. Add each permitted callback URL to **Redirect URLs**: `http://localhost:5173/` for local development, the production origin with `/`, and any Vercel preview origins you intentionally support. Registration redirects to `/`; password-reset emails redirect to `/?flow=recovery`. Supabase Auth must allow both callback origins.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` to the project root URL (for example, `https://<project-ref>.supabase.co`, without `/rest/v1`) and `VITE_SUPABASE_ANON_KEY` to the project's publishable/anon key. The anon key is public; never add the `service_role` key to frontend variables.
4. Install the Supabase CLI and authenticate, then run `supabase link --project-ref <project-ref>` and `supabase db push` to apply the RLS schema, profile-on-signup trigger and RPCs.
5. Configure the Edge Function server secrets with `supabase secrets set AI_API_KEY=... AI_MODEL=gpt-4o-mini AI_BASE_URL=https://api.openai.com/v1/chat/completions APP_ORIGIN=https://your-app.example`. For local Vite development, set `APP_ORIGIN=http://localhost:5173` in the Supabase project's function secrets.
6. Deploy the authenticated AI endpoint with `supabase functions deploy ai`.
7. Run `npm install`, `npm run dev`, and `npm run build`. `npm run build` includes the TypeScript project checks and the production Vite build.

For Vercel, import the Git repository and use the checked-in `vercel.json` build/output/SPA-rewrite configuration. In **Project → Settings → Environment Variables**, define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for every environment that should work (Production, Preview and/or Development), then redeploy so Vite embeds the values in the client bundle. Use only the Supabase project URL and publishable/anon key; never set `service_role` or the AI provider key as a `VITE_` value. Add the deployed and intentionally supported preview origins to Supabase Auth's Redirect URLs.

Email/password registration and sign-in, persistent session restoration, sign-out, email confirmation messaging and password recovery are implemented through Supabase Auth. The existing database trigger creates `profiles` rows for new Auth users using signup metadata; profile edits update Auth metadata and upsert the same user's profile row under RLS. To enable Google OAuth, create a Google OAuth client, set its authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback` (or the callback URL shown for your Supabase custom auth domain), then enter the client ID and secret in **Authentication → Providers → Google**. Keep those provider credentials in Supabase, not Vercel frontend variables.

No frontend `VITE_` variable may contain a secret.

If `AI_API_KEY` is absent, the AI Edge Function returns an explicit configuration error and does not create a simulated assistant response. Configure the key only as a Supabase Edge Function secret; never add it to frontend environment variables. AI proposals require an explicit Apply/Create Tasks or Cancel action.

## Workspace features

- The sidebar contains Dashboard, Strategy Algorithm, Documents, Planning and Settings. Project Files are not exposed as a separate feature; older browser file records are not deleted, but are not imported as Documents because the database has no equivalent file record schema.
- Strategies, documents, tasks and AI history are scoped to the authenticated Supabase user by RLS. Selecting an active strategy is remembered in browser storage per user; strategy content itself is stored in Supabase.
- The Strategy Algorithm lets users create multiple strategies and enter their own alternatives, Plan A / Plan B, stages and control measures. New strategies start blank rather than with example business assumptions.
- Planning supports All Tasks, Today, Tomorrow, Week and Month views. Task deadlines are calendar dates interpreted in the browser's local timezone; tasks without a deadline remain visible in All Tasks.
- AI history is stored per strategy in `ai_messages`. The current schema does not define separate named conversation threads.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Run TypeScript checks and create the production bundle in `dist/` |
| `npm run preview` | Preview the production bundle locally |

There are currently no configured test or lint scripts. For deployment, run `npm run build`, publish `dist/`, and apply Supabase changes with the linked Supabase CLI before deploying the `ai` function.

## Local data migration

Sign in to the cloud account with the same email as the previous local account, open Settings, review the detected record counts, then select **Import local data**. The import is authenticated, transactionally scoped to the signed-in user, repeatable, and does not remove the browser source. Local password hashes are not migrated; passwords remain managed by Supabase Auth. Project workspace files are not part of the current database schema and remain local.

## Security model

All workspace tables use row-level security; child rows carry a composite `(strategy_id, user_id)` foreign key. Edge Functions validate the caller JWT and use the caller's RLS-scoped session. Only `AI_API_KEY` is a server-side secret. Set `APP_ORIGIN` to the exact deployed frontend origin before production deployment.
