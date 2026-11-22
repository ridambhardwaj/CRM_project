# Work Management Setup

The `/tasks` screen currently uses browser storage so it works without external credentials. This provides persistence and same-browser tab updates, but it does not synchronize different users or devices. The SQL migration is the production database foundation; the current page is not yet wired to these tables or Supabase Auth.

## Database

1. Create a Supabase project and enable email/password or your preferred Supabase Auth provider.
2. Apply `migrations/20261122000000_work_management.sql` using the Supabase SQL editor or Supabase CLI.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.example` for the application. Never expose the service-role key to browser code.
4. Create an authenticated account, then call `create_workspace('Your company')` once to create an organization and its initial admin membership. Invite additional employees through an admin-only server workflow.

The migration scopes records by organization and applies row-level security. Roles are `admin`, `manager`, `team_leader`, and `employee`. The `work_activity_log`, assignment/completion notifications, and `reminder_queue` are populated by database triggers.

## Background reminders

Deploy `functions/process-reminders/index.ts` as a Supabase Edge Function and configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong `REMINDER_JOB_SECRET` in the function's server-side secrets. Schedule the function to run every minute from Supabase Cron, sending `Authorization: Bearer <REMINDER_JOB_SECRET>`. The worker converts due queue entries into in-app notification records, including task deadlines and meeting reminders.

This worker does not send browser/mobile push notifications. Push delivery needs a subscription table, a user-facing permission/subscription flow, VAPID credentials, and a push transport; none are configured in this repository.