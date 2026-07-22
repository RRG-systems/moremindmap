# Developer Access Security Report

Evidence class: observed and synthetic.

The expected code is read only from `COACH_CONNECT_DEVELOPER_ACCESS_CODE`. The endpoint requires `COACH_CONNECT_DEVELOPER_ACCESS_ENABLED=true`, rejects production, checks an environment allowlist, uses `crypto.timingSafeEqual`, does not log or persist the submission, throttles attempts in-process, and issues a signed 15-minute cookie. HttpOnly and SameSite=Strict are unconditional; Secure is required for preview or HTTPS and omitted only for authorized local/development/test HTTP. GET verifies the cookie and resolves the same `more_monthly_intelligence` access type as the paid grant shape, with source `temporary_internal_subscription_entitlement`, no billing evidence, and no Stripe record. DELETE clears the cookie and revokes its nonce server-side for the process lifetime.
