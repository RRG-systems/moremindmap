# MORE MindMap Stripe Webhook + Durable Access Grants v0 1C

Date: June 23, 2026

## Executive Summary

MM-PAY-1C implements webhook-confirmed payment truth and durable access grant records v0.

Checkout creation remains only the initiation step. Durable paid access is created only after a verified Stripe webhook event is received and processed.

## Routes Added

- POST /api/stripe/webhook
- GET /api/stripe/access-status

## Webhook Events Handled

- checkout.session.completed
- invoice.paid
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

## Durable Records

The webhook route creates compact source-labeled records only after signature verification.

Records:

- payment_event:{stripe_event_id}
- access_grant:{grant_id}
- access_grant_by_email:{email}
- access_grant_by_profile:{profile_id}
- access_grant_by_assessment:{assessment_id}
- access_grant_by_session:{session_id}
- subscription_state:{subscription_id}
- payment_revenue_index:{yyyy_mm}

Raw webhook payloads are not stored.

## Access Grant Policy

Durable paid access can be created only from verified Stripe webhook events. Redirect success and client-side Checkout Session creation do not create access grants.

Access grants are source-labeled:

- source: paid_stripe

Promo, free, partner-sponsored, and admin access remain separate access sources and are not removed or changed by this sprint.

## Subscription State Policy

Subscription state is updated from subscription-related Stripe events and subscription Checkout completion. The v0 state stores compact subscription status data without exposing raw Stripe subscription objects.

## Revenue Index Policy

V0 appends payment event ids into a month index. This is an indexed foundation only. Dashboard revenue totals remain unavailable until a separate safe reporting route is explicitly built.

## Access Status Route

GET /api/stripe/access-status supports safe lookup by:

- email
- profile_id
- assessment_id
- session_id
- optional product_key filter

It returns compact grants and compact subscription state only. It does not expose Redis keys, raw Stripe records, raw webhook payloads, or secrets.

## Success Page Update

/payment-success can check access-status by session_id. It shows:

- "Payment verified. Your access is active." only after active webhook-confirmed access is found.
- "Checkout completed. We are verifying your access." when access is still pending/not found.

Redirect success is still not payment proof.

## Required Production Setup

Create a Stripe webhook endpoint:

Endpoint URL:

https://moremindmap.com/api/stripe/webhook

Events:

- checkout.session.completed
- invoice.paid
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

Then add the Stripe webhook signing secret directly to Vercel as:

STRIPE_WEBHOOK_SECRET

Do not paste the webhook secret into chat.

## Limits

- No real payment was completed in implementation.
- No fake payment events were created.
- No custom payment UI was added.
- No canonical dossier records were mutated.
- No assessment records were mutated.
- No broad revenue totals are exposed.
- STRIPE_WEBHOOK_SECRET must be configured before production webhook verification can pass.
