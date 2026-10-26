# STRAVIO

Stravio is a Vite + React strategy workspace. During the temporary offline period, workspace data and local profiles are stored in the browser.

## Temporary local Demo Mode

- The existing login screen opens a local profile for any non-empty login and password. A password is never stored or verified.
- The browser stores each profile's strategies, documents, tasks, AI history, activity and profile name in profile-scoped `localStorage`. Signing out removes only the current session; it does not delete workspace data.
- Demo Mode is not authentication or a security boundary. Anyone with access to the same browser profile can inspect or modify its local data. Use a different browser profile/device for separate local data.
- Google OAuth, email confirmation and password-reset emails are unavailable in Demo Mode; these actions report that they require the cloud auth service.
- Existing Supabase Edge Function calls are retained for AI. The current AI function requires a Supabase-authenticated user and reads strategy context from the cloud database, so it can fail while Demo Mode is active. The app displays the error and does not fabricate an AI response.
- Existing browser-local records are retained and may be linked to the first local profile that signs in. Local storage errors and quota exhaustion are surfaced; failed writes are not reported as saved.

## Re-enabling Supabase later

The Supabase schema, RLS policies, profile trigger and AI Edge Function remain in the repository. Before restoring cloud mode, reintroduce a real Auth provider and cloud data adapter; do not treat Demo Mode sessions as authenticated Supabase users.

1. Create a Supabase project. In **Authentication → Providers → Email**, enable email/password sign-in and decide whether email confirmation is required.
2. Set **Authentication → URL Configuration → Site URL** to the deployed origin. Allow production and local callback URLs, including `/?flow=recovery`.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Vite only when cloud integrations are needed. The anon/publishable key is public; never expose `service_role`, Google client secrets or AI provider keys in frontend variables.
4. Apply the existing migration and deploy the authenticated AI Edge Function only after verifying the target project and obtaining explicit approval.
5. For Google OAuth, create a Google OAuth client with the Supabase callback URL shown in the project, then configure the client ID and secret in **Authentication → Providers → Google**. Keep provider credentials in Supabase.

For Vercel, use the checked-in `vercel.json` build/output/SPA-rewrite configuration. Never put `service_role` or AI provider credentials in `VITE_` variables.

If `AI_API_KEY` is absent, the AI Edge Function returns an explicit configuration error and does not create a simulated assistant response. Configure the key only as a Supabase Edge Function secret. AI proposals require an explicit Apply/Create Tasks or Cancel action.

## Workspace features

- The sidebar contains Dashboard, Strategy Algorithm, Documents, Planning and Settings. Project Files are not exposed as a separate feature; older browser file records are not deleted, but are not imported as Documents because the database has no equivalent file record schema.
- Strategies, documents, tasks, profiles, activity and AI history are scoped to a local profile in browser storage during Demo Mode.
- The Strategy Algorithm lets users create multiple strategies and enter their own alternatives, Plan A / Plan B, stages and control measures. New strategies start blank rather than with example business assumptions.
- Planning supports All Tasks, Today, Tomorrow, Week and Month views. Task deadlines are calendar dates interpreted in the browser's local timezone; tasks without a deadline remain visible in All Tasks.
- AI history is stored per strategy in local browser storage. The current schema does not define separate named conversation threads.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Run TypeScript checks and create the production bundle in `dist/` |
| `npm test` | Run auth-helper and local-profile storage tests |
| `npm run preview` | Preview the production bundle locally |

There is no configured lint script. For a local build, run `npm run build`; deployment is not performed by these commands.

## Local data migration

If a prior local account is available in this browser, open Settings, review the detected counts, then select **Import local data**. The import is profile-scoped, repeatable and never removes its source data. Passwords are not migrated or stored. Project workspace files remain local.

## Security model

Demo Mode is not secure authentication: local profile IDs are labels, not credentials, and localStorage is accessible to the browser user. The retained cloud schema uses RLS and composite `(strategy_id, user_id)` relations. The AI Edge Function validates a caller JWT and uses its RLS-scoped session; it may therefore be unavailable in Demo Mode. `AI_API_KEY` must remain a server-side Edge Function secret.
