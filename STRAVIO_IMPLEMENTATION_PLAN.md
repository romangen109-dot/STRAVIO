# STRAVIO V2 implementation checklist

## Audit snapshot

- React 18, TypeScript 5.6, Vite 6 and Supabase JS are in use; `npm run build` runs TypeScript project checks and the production Vite build.
- Email/password registration and sign-in, auth-event session restoration, sign-out, email confirmation messaging, password reset/recovery, and Google OAuth initiation use the existing Supabase Auth client. Private workspace components mount only for an authenticated user.
- The initial migration defines user-owned profiles, strategies, documents, tasks, AI messages, activity, rate limits, composite strategy ownership foreign keys, RLS, activity triggers, local import and AI proposal RPCs.
- The authenticated `supabase/functions/ai` endpoint exists and loads strategy-specific context through the caller's RLS session. It requires server-side `APP_ORIGIN`; AI provider settings are described in README.
- Strategy data is persisted in Supabase, but `useStrategy` always picks the most recently updated strategy and the Strategy page has no strategy library/selection or CRUD controls.
- Documents have persistent create/open/edit/duplicate/delete flows, but document rename is missing.
- Planning has persistent task CRUD and links tasks to strategies and stage-plan IDs. Today/Tomorrow/Week/Month views are missing; task deletion is not confirmed.
- The sidebar still exposes browser-only mock PROJECT FILES and a mock project identity. Legacy Research, Tasks, Insights and generic Documents surfaces render hard-coded sample data.
- Dashboard uses actual documents/tasks/activity but focuses on only the one implicitly active strategy, so it does not yet represent a multi-strategy workspace.
- `.env.example` names only the public Supabase URL/key. `vercel.json` defines the Vite build/output and SPA rewrite. README describes Supabase redirect allow-lists, Vercel environment variables, email confirmation, password recovery and Google OAuth provider setup.
- `package-lock.json` was already modified in the worktree before implementation; preserve it.

## Critical

- [x] Preserve pre-existing worktree changes; do not commit or push.
- [x] Review the existing Auth/RLS ownership model and keep its authorization checks intact.
- [x] Remove mock project/file records and demo-only routes from the user-facing application.
- [x] Implement Supabase email/password sign-up and sign-in, explicit auth error handling, persistent session recovery, sign-out and protected workspace rendering.
- [x] Implement email password-reset and recovery flows; keep Google OAuth on the existing provider integration.
- [x] Keep profile creation on the existing Auth trigger and synchronize profile edits through the owner-scoped profile table.
- [x] Add Vercel SPA/build configuration and document required public frontend environment variables.
- [ ] Verify Auth and cross-user RLS behavior against a configured Supabase project.

## High

- [x] Remove the standalone Files/project-file experience while preserving Documents and local migration records.
- [x] Provide real multi-strategy create/open/edit/rename/delete/active-selection flows.
- [x] Ensure Dashboard, Planning and AI context follow the selected strategy and display real user data.
- [x] Complete persistent document creation, rename, edit and safely confirmed deletion.
- [x] Add Today, Tomorrow, Week and Month planning views; confirm task deletion.

## Medium

- [x] Remove or replace legacy mock-only pages and duplicate routes.
- [x] Surface profile save failures and document external OAuth/AI setup accurately.
- [x] Keep README and this checklist aligned with shipped behavior and external setup.
- [ ] Browser-check responsive layouts and end-to-end interactions.

## Final verification

- [x] Run the available TypeScript + production build (`npm run build`).
- [x] Check configured test/lint scripts; package scripts currently define neither.
- [ ] Verify auth-protected flows and Supabase CRUD/RLS scenarios where credentials are available.
- [x] Record scenarios blocked on credentials or Dashboard configuration.

## Implementation status

- Implemented the workspace, strategy-library, document, Planning, AI configuration-error and profile error-handling changes described above.
- Implemented Supabase Auth registration/login/logout/session and password-recovery UI, auth-state race protection, explicit registration confirmation messaging, profile upsert and Vercel deployment configuration.
- No database schema changes were needed; the existing RLS schema, owner-scoped relations and storage/migration data were preserved.
- TypeScript checks and Vite production build pass. There are no configured automated test or lint scripts.
- Live Auth, cross-user RLS, database persistence, Google OAuth and AI-provider scenarios still require project credentials and Supabase Dashboard/function configuration. Vercel project environment variables must also be entered by the owner.

## Local workspace functional audit — 2026-10-27

- [x] Persist strategy edits immediately and keep the selected strategy stable when another strategy is read or updated.
- [x] Keep generated strategy-document content in sync with strategy changes without overwriting manually edited content.
- [x] Persist document editor drafts locally so they survive navigation/reload; clear drafts only after a successful save or explicit cancellation.
- [x] Keep Planning task caches and Dashboard/task consumers up to date after strategy/task changes.
- [x] Validate Today, Tomorrow, Week and Month date boundaries, including year rollover and invalid calendar dates.
- [x] Validate local workflow data for two independent strategies, algorithm fields, linked documents/tasks, activity, profile persistence and AI-context filtering.
- [x] Run `npm test`, `npm run build`, `git diff --check` and workspace diagnostics.
- [ ] Browser-level end-to-end testing was not available in this environment.
- [ ] Real AI responses still require the authenticated external Edge Function; no response is simulated in local Demo Mode.
