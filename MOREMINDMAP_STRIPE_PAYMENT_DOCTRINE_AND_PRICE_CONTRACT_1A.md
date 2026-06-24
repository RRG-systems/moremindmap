# MORE MindMap Stripe Payment Doctrine + Price Contract 1A

Date: June 23, 2026

## Purpose

This sprint locks the payment doctrine and product price contract before Stripe Checkout is implemented. It also repairs the bounded Business Assessment visual return-state issue where closing visual artifacts could return the user to the assessment entry context instead of the current result context.

No Stripe Checkout route, webhook route, payment record, subscription record, or durable access write is implemented in this sprint.

## Product Ladder

1. Behavior Operating System - $149
   - Customer promise: Understand yourself.
   - Stripe amount: 14900
   - Currency: usd
   - Mode: payment
   - Access type: behavior_operating_system
   - Description: one-time access to behavior profile / profile intelligence

2. Business Assessment - $49
   - Customer promise: Understand your business.
   - Stripe amount: 4900
   - Currency: usd
   - Mode: payment
   - Access type: business_assessment
   - Description: one-time business assessment

3. MORE Monthly Intelligence - $23.95/month
   - Customer promise: Keep improving over time.
   - Stripe amount: 2395
   - Currency: usd
   - Mode: subscription
   - Interval: month
   - Access type: more_monthly_intelligence
   - Description: monthly recursive coaching / strategy loop
   - Promise: keep improving over time
   - Headline: You have your map. Now keep it alive.

## Locked Subscription Copy

Headline:

You have your map.
Now keep it alive.

Post-assessment panel:

Your assessment created your current map.

Monthly Intelligence helps you keep moving.

Each month, MORE MindMap helps you:

- track your One Move
- record what happened
- see what changed
- avoid overclaiming progress
- generate an updated strategy draft
- choose the next best move

Start MORE Monthly Intelligence

$23.95/month

## Subscription Placement

- Before Business Assessment: soft awareness below or near the $49 assessment card.
- After Business Assessment output: primary upgrade panel after Five Futures + One Move.
- Do not lead with "subscription."
- Lead with "MORE Monthly Intelligence."
- Subscription and legal language can appear in fine print.

## Payment Truth Rules

- Payments do not create intelligence.
- Payments unlock access.
- Stripe records payment truth.
- MORE MindMap records access truth.
- Checkout redirect success is not sufficient payment proof.
- Webhook-confirmed events are required for durable paid access.
- Revenue claims remain unavailable until payment records are persistently indexed.
- One-time products and subscription products must be stored separately.
- Promo, free, partner-sponsored, and admin access must remain explicitly labeled.

## Access Truth Rules

Durable paid access must come from verified Stripe webhook events, not redirect success. Redirect success can show a pending or checking state, but cannot become the system of record.

Allowed future access source labels:

- paid_stripe
- promo_code
- free_admin
- partner_sponsored
- internal_test

Promo and free paths must remain supported and visibly separable from paid Stripe access. Existing FATHOMFREE and Profile ID retrieval flows must not be broken by Stripe implementation.

## Expected Future Environment Variables

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_BEHAVIOR_OS
- STRIPE_PRICE_BUSINESS_ASSESSMENT
- STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE
- PUBLIC_SITE_URL or existing equivalent

No Stripe secret or price value is hardcoded in this sprint.

## Expected Future Routes

- POST /api/stripe/create-checkout-session
- POST /api/stripe/webhook
- GET /api/stripe/access-status, if needed
- Success/cancel pages or existing route query-state handling, if safe

Stripe-hosted Checkout should be used first. Custom payment UI is out of scope until the hosted Checkout foundation is stable.

## Expected Future Durable Records

- payment_session:{session_id}
- payment_event:{event_id}
- access_grant:{grant_id}
- access_grant_by_email:{email}
- access_grant_by_profile:{profile_id}
- subscription_state:{customer_or_subscription_id}
- revenue_index:{date_or_month}

One-time purchase records and subscription state records must remain separate.

## Revenue Truth Rules

Revenue can be discussed only after webhook-confirmed payment events are persistently indexed. Checkout starts, redirects, abandoned sessions, test access, promo access, and admin access are not revenue.

## Business Assessment Visual Return-State Repair

Investigation found that Business Assessment visual artifacts are standalone routes:

- /business-assessment/visual-map
- /business-assessment/five-futures

The result-page launch links previously passed only the profile id. The visual shell back link returned to /business-assessment, which loses the current retrieved result context and can feel like returning home.

Repair:

- Result launch links now include a safe returnTo target.
- Visual pages use returnTo only when it starts with /business-assessment.
- Fallback return target is /business-assessment?id={profile_id}#business-assessment-results.
- The Business Assessment page now rehydrates a retrieved assessment from ?id=... and anchors the result section.

No assessment records, canonical dossiers, payment records, or strategy artifacts are mutated by this repair.

## Implementation Limits

- Stripe Checkout is not live.
- Stripe webhooks are not live.
- Payment records are not created.
- Subscription records are not created.
- Paid access grants are not created.
- Revenue claims remain unavailable.
- No payment behavior should be presented as live until webhook-confirmed access exists.

## Next Sprint Recommendation

Build the Stripe Checkout foundation next:

1. Add environment-backed product price resolution.
2. Add hosted Checkout Session creation for one-time and subscription products.
3. Add webhook handling as the only durable payment truth source.
4. Add access grant records with explicit source labels.
5. Add safe redirect-state messaging that never treats redirect success as payment proof.
