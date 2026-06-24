# MORE MindMap Stripe Checkout Foundation 1B

Date: June 23, 2026

## Executive Summary

MM-PAY-1B implements Stripe-hosted Checkout Session creation for the three locked MORE MindMap products. This is Checkout initiation only.

This sprint does not implement Stripe webhook processing, durable paid access grants, subscription state, payment event records, or revenue indexing. Checkout redirect success is treated as pending verification, not payment proof.

## Products Implemented

1. Behavior Operating System
   - Price: $149
   - Product key: behavior_operating_system
   - Mode: payment
   - Env price ID: STRIPE_PRICE_BEHAVIOR_OS
   - Access type: behavior_operating_system

2. Business Assessment
   - Price: $49
   - Product key: business_assessment
   - Mode: payment
   - Env price ID: STRIPE_PRICE_BUSINESS_ASSESSMENT
   - Access type: business_assessment

3. MORE Monthly Intelligence
   - Price: $23.95/month
   - Product key: more_monthly_intelligence
   - Mode: subscription
   - Env price ID: STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE
   - Access type: more_monthly_intelligence

## Route Added

POST /api/stripe/create-checkout-session

The route accepts only a server allowlisted product_key and optional bounded metadata inputs. It does not accept amount, price ID, mode, or access state from the client.

Returned fields:

- ok
- checkout_url
- session_id
- product_key
- mode

The route does not return Stripe secret keys, env values, webhook secrets, full Stripe session objects, raw error stacks, or durable access state.

## Success And Cancel Pages

Routes added:

- /payment-success
- /payment-cancelled

Success copy states:

Checkout completed. We are verifying your access.

Durable paid access will be confirmed by payment processing.

Cancel copy states:

Checkout was cancelled. No payment access was changed.

## Frontend Buttons

Checkout buttons were added where product placement was clear and bounded:

- Behavior Operating System checkout from the profile offer page.
- Business Assessment checkout near the $49 Business Assessment offer.
- MORE Monthly Intelligence soft awareness near the Business Assessment offer.
- MORE Monthly Intelligence primary upgrade panel after Business Assessment output.

Existing promo/free flows remain intact. FATHOMFREE remains a promo access path. Profile ID retrieval remains intact.

## Payment Truth Boundary

- Payments do not create intelligence.
- Payments unlock access.
- Stripe records payment truth.
- MORE MindMap records access truth.
- Checkout redirect success is not sufficient payment proof.
- Webhook-confirmed events are required for durable paid access.
- Revenue claims remain unavailable until payment records are persistently indexed.

## Not Implemented

- Stripe webhook processing
- payment_event records
- access_grant records
- subscription_state records
- revenue_index records
- durable paid access unlocks
- custom Stripe payment UI
- revenue reporting

## Production Smoke Plan

After deployment:

- /leadership-dashboard returns 200.
- /business-assessment returns 200.
- POST /api/stripe/create-checkout-session with invalid product_key returns 400.
- POST /api/stripe/create-checkout-session for each product returns checkout_url if production env vars are configured.
- /payment-success returns 200.
- /payment-cancelled returns 200.
- No real payment is completed unless explicitly approved.
- No durable access grant is created.
- No payment truth is claimed from redirect success.
