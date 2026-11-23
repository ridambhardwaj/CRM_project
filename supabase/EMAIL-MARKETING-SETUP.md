# AI Email Marketing Setup

The campaign composer and server routes are implemented, but actual AI generation, shared database persistence, scheduled delivery, provider analytics, and sending require the external provider credentials below. Do not copy service-role or provider secrets into browser code or commit a real `.env.local` file.

## Supabase

1. Apply `migrations/20261122000000_work_management.sql` and `migrations/20261123000000_email_marketing.sql` in order.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server.
3. Set `CAMPAIGN_ORGANIZATION_ID` to the workspace UUID and `CAMPAIGN_OPERATOR_USER_ID` to the authenticated admin profile UUID. The user must be an active organization member.
4. Configure the admin-only consent ledger in `email_marketing_consents`. Use only the valid legal bases and capture a source/evidence record; withdrawn contacts are automatically suppressed.
5. Keep `email_suppressions` current for unsubscribe, complaint, hard bounce, and manual suppression.

The campaign API uses a server operator token for this initial CRM workspace integration. `CAMPAIGN_SEND_TOKEN` must be long, random, server-only, and provided only to authorized operators. This is a deployment-level gate, not a substitute for user-session authorization; replace it with authenticated role checks before multi-user production rollout.

## AI Drafting

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Draft generation accepts a bounded brief, category, objective, verified product/service facts, selected eligible CRM context, tone, style, brand colors, CTA/contact info, and variation count. The server returns multiple subject/headline/body/CTA/signature variations and generates escaped responsive HTML. Drafting requires the operator token.

## Resend Delivery

Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL`, `APP_BASE_URL`, and a strong `UNSUBSCRIBE_SECRET`. The sender only accepts a database campaign with server-recorded approval, rechecks current consent and suppression for every recipient, logs individual delivery outcomes, personalizes first name/company placeholders, and includes signed unsubscribe links and List-Unsubscribe headers.

Register `https://your-crm-domain.example/api/campaigns/webhook` in Resend and set `RESEND_WEBHOOK_SECRET` from the webhook signing secret. The endpoint verifies Svix signatures and records verified sent, delivered, bounced, opened, clicked, complaint, and unsubscribe events. Complaint/unsubscribe events update suppression and withdraw consent. Opens/clicks are only available if provider tracking is enabled and should be interpreted with the provider's tracking limitations.

## Scheduling

Deploy `functions/process-email-campaigns/index.ts` as a Supabase Edge Function with `CAMPAIGN_SCHEDULER_SECRET`, `APP_BASE_URL`, and `CAMPAIGN_SEND_TOKEN` configured as Edge Function secrets. Schedule it with Supabase Cron every minute using `Authorization: Bearer <CAMPAIGN_SCHEDULER_SECRET>`. The worker fetches due server campaigns and eligible recipients; the send endpoint rechecks approval, due time, consent, and suppression before delivery.

## Server campaign routes

Set `CAMPAIGN_ORGANIZATION_ID` and `CAMPAIGN_OPERATOR_USER_ID` in the Next.js server environment. The configured user must be an active member of that organization so campaign foreign keys and workspace scope remain valid. Set `CAMPAIGN_APPROVER_USER_ID` to a different active member and configure a separate `CAMPAIGN_APPROVAL_TOKEN`; server approval rejects self-approval. Campaign management/send routes require `x-campaign-token`, while approvals require `x-campaign-approval-token`. Never expose either token in public client configuration. Add rate limiting at the hosting edge before opening these routes to external traffic.

The campaign analytics route reads only `is_verified = true` events. Counts and rates remain blank/zero until a signed Resend webhook arrives. Suggestions are based on observed delivery/click/unsubscribe events and are not represented as an AI-generated prediction.

## AI Email Marketing Agent

The `/email-agent` workspace adds a full AI email marketing agent on top of the campaign system. Apply `migrations/20261124000000_email_agent.sql` after the work-management and email-marketing migrations to create `email_templates`, `email_sequences`, and `email_sequence_steps`. All agent routes reuse the existing `CAMPAIGN_SEND_TOKEN` operator token and `OPENAI_API_KEY`; no new secrets are required.

Sections and routes:

- AI Generator (`/email-agent` generator tab) — category-aware drafting via `POST /api/campaigns/draft`. Supports all 14 categories, multiple variants, and the shared 6-style HTML renderer with brand colors, logo, social links, and footer.
- Promotional Campaigns — same campaign lifecycle (draft → needs approval → approved → scheduled → sent) with server-side consent and suppression re-checks before every send.
- Templates — `GET/POST /api/templates`, `POST /api/templates/generate` (AI-built responsive HTML in corporate/minimal/modern/premium/promotional/creative styles), and `DELETE /api/templates/[id]`.
- Scheduled Emails — scheduled campaigns dispatch only after approval and Supabase scheduler deployment.
- Follow-up Sequences — `GET/POST /api/sequences`, `PATCH/DELETE /api/sequences/[id]`. Persist Day 1 / Day 3 / Day 7 style multi-step sequences; activation requires the operator token.
- Contacts / Recipients — `GET/POST /api/recipients` to view CRM contacts with consent status, record consent, withdraw consent, and suppress recipients. Only recorded, non-suppressed contacts are ever eligible to send.
- Analytics — reuses `/api/campaigns/analytics`; reports only signature-verified provider events and distinguishes estimated vs. verified metrics.
- AI Assistant — the chat UI posts to `/api/campaigns/assistant` and can load generated variants straight into the generator for review.
- Content Improvement — `POST /api/content/improve` suggests subject lines, strengthens CTAs, flags spam-trigger words, adjusts tone, and returns notes. Falls back to a deterministic heuristic when no AI key is configured.

## Current limitations

- Gmail, Microsoft 365 OAuth, generic SMTP, attachments, recurring schedules, and multi-step no-reply sequences are not integrated.
- The first email provider adapter is Resend. The UI offers only server capabilities that are implemented; no AI-generated performance claims are shown.
- Role-based authorization currently uses a configured workspace and operator token for the email routes. A complete multi-user authenticated campaign API should use Supabase Auth session claims and organization roles.
- Browser-local campaign entries are demo-only and never enter the send path.
- Apply migrations to a real Supabase project and configure provider secrets before expecting server operations to succeed. This workspace has no configured database or provider keys, so the SQL and live provider flow have not been executed here.
