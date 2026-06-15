---
name: Dashboard auth routes - no email/SMTP dep
description: register and forgotPassword routes were broken due to missing transporter/validateEmail in paramsForRoutes
---

The dashboard register.js and forgotPassword.js routes originally required `transporter` (nodemailer), `validateEmail`, and `randomNumberApikey` from paramsForRoutes in app.js — but these were NEVER passed.

**Why:** Email verification was designed but SMTP was never configured. Routes crashed silently.

**Fix applied:** 
- register.js: Removed email verification step entirely; directly creates account after form validation
- forgotPassword.js: Creates nodemailer transporter from SMTP_USER/SMTP_PASS env vars if available; falls back to logging the code to console
- verifyfbid.js: Added local randomNumberApikey() function instead of depending on params

**How to apply:** If adding email features, set env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
