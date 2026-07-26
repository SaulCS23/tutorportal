# Production Email Setup — Resend SMTP + Supabase

This guide configures TutorPortal to send transactional email (signup confirmation, password reset) through Resend via Supabase's custom SMTP feature.

No secrets or API keys are stored in this repository. All credentials are entered directly into the Supabase and Resend dashboards.

---

## Part A — Resend Setup

### 1. Create or log into a Resend account

Go to [https://resend.com](https://resend.com) and sign in. The free tier supports 3,000 emails per month and 100 per day, which is sufficient for early-stage use.

### 2. Add and verify a sending domain

1. In the Resend sidebar, click **Domains**.
2. Click **Add Domain**.
3. Enter the domain you control (for example, `mydomain.com`). This must be a domain whose DNS you can edit.
4. Resend will show you a set of DNS records to add:
   - **MX record** — for receiving bounces
   - **SPF TXT record** — authorizes Resend to send on your behalf
   - **DKIM TXT record(s)** — signs outgoing messages
   - **DMARC TXT record** (recommended) — instructs receiving servers how to handle failures
5. Add every record to your DNS provider (Cloudflare, Namecheap, Route 53, etc.).
6. Click **Verify** in the Resend dashboard. DNS propagation can take a few minutes to several hours. All records must show **Verified** before you proceed.

> **Do not skip DKIM and DMARC.** Without them, your emails are likely to be routed to spam.

### 3. Create an SMTP credential

1. In the Resend sidebar, click **API Keys**.
2. Click **Create API Key**.
3. Give it a descriptive name such as `tutorportal-supabase-smtp`.
4. Set **Permission** to **Sending access** only.
5. Click **Create**. **Copy the key immediately** — it is shown only once.

> Store the key somewhere secure (for example, a password manager). You will paste it into the Supabase dashboard in Part B. Do not add it to any file in this repository.

### 4. SMTP connection details

Use these values when configuring Supabase:

| Field         | Value                        |
|---------------|------------------------------|
| SMTP Host     | `smtp.resend.com`            |
| SMTP Port     | `465` (TLS) or `587` (STARTTLS) |
| SMTP Username | `resend`                     |
| SMTP Password | Your Resend API key          |

> The username is literally the word `resend`, not your email address.

### 5. Choose a sender address

Use an address at your verified domain. Examples:

```
TutorPortal <noreply@mydomain.com>
TutorPortal <hello@mydomain.com>
```

The local part (`noreply`, `hello`, etc.) does not need to exist as a real mailbox — Resend handles delivery.

---

## Part B — Supabase SMTP Setup

### 1. Open your project settings

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and open your project.
2. In the left sidebar, click **Authentication**.
3. Click **Email** (or **SMTP Settings** depending on your dashboard version). If you do not see it there, go to the left sidebar → **Project Settings** → **Authentication** → scroll to **SMTP Settings**.

### 2. Enable custom SMTP

Toggle **Enable Custom SMTP** to on.

### 3. Enter your SMTP credentials

Fill in each field:

| Supabase Field  | Value                                  |
|-----------------|----------------------------------------|
| Sender Name     | `TutorPortal`                          |
| Sender Email    | `noreply@mydomain.com`                 |
| SMTP Host       | `smtp.resend.com`                      |
| SMTP Port       | `465`                                  |
| SMTP Username   | `resend`                               |
| SMTP Password   | *(paste your Resend API key here)*     |

Replace `noreply@mydomain.com` with the address you chose in Part A Step 5.

### 4. Save and send a test email

1. Click **Save**.
2. Click **Send Test Email**. Supabase will send a test message to the email address of your logged-in Supabase account.
3. Check your inbox. If the test email arrives, your SMTP connection is working.
4. If the test fails, re-check the host, port, username, and that the API key was not truncated.

---

## Part C — Supabase URL Configuration

These settings tell Supabase where it is allowed to redirect users after email confirmation and password reset. Incorrect values here are the most common cause of "redirect not allowed" errors.

### 1. Open URL Configuration

In the Supabase dashboard: **Authentication** → **URL Configuration**.

### 2. Set the Site URL

```
https://tutorportal-xi.vercel.app
```

This is the primary production URL. Supabase uses it as the base for links in emails when no explicit redirect is provided.

### 3. Add Redirect URLs

Add all of the following entries. Each line is a separate entry:

```
https://tutorportal-xi.vercel.app/auth/callback
https://tutorportal-xi.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

The wildcard entries (`/**`) allow Supabase to redirect to any path on those origins, which is needed because our callback passes a `next` query parameter.

### 4. Save

Click **Save** after adding all entries.

---

## Part D — Rate Limits

### Supabase Auth limits

Supabase enforces its own rate limits on authentication emails, separate from your Resend plan. To review them:

1. In your Supabase project, go to **Authentication** → **Rate Limits**.
2. You will see limits for:
   - Email signups
   - Password reset requests
   - Magic links / OTP
3. **Do not disable abuse protection.** The defaults protect your project from being used to spam third parties. Only raise a specific limit if you have a clear operational reason.

### Resend plan limits

Check your current Resend plan at [https://resend.com/settings/billing](https://resend.com/settings/billing). The free tier allows 100 emails per day and 3,000 per month. These limits are separate from and additive with the Supabase Auth rate limits — whichever is more restrictive applies first.

Do not configure the Supabase rate limits to allow unlimited signup attempts. Leaving abuse protection enabled is the correct default.

---

## Part E — Testing Checklist

Complete these steps in order after deploying and configuring both dashboards.

- [ ] Push the latest code to GitHub and confirm Vercel deploys successfully.
- [ ] Open `https://tutorportal-xi.vercel.app/signup` in a private/incognito window.
- [ ] Sign up using a fresh email address you can access.
- [ ] Open your inbox. Confirm the email arrives from your custom domain (not `noreply@mail.app.supabase.io`).
- [ ] Click the confirmation link in the email.
- [ ] Confirm you are redirected to `/dashboard` (not the homepage or `/login`).
- [ ] Open the Supabase dashboard → **Table Editor** → `public.profiles`. Confirm a new row exists with the correct `full_name` and `role = student`.
- [ ] Confirm the dashboard page displays the user's full name and the **Student** role badge.
- [ ] Navigate to `/account`. Confirm email, name, role, and member-since date are displayed.
- [ ] Update the full name in the account form. Confirm the name updates and the page refreshes.
- [ ] Sign out.
- [ ] Go to `/forgot-password`. Request a password reset using the same email.
- [ ] Confirm the reset email arrives from your custom domain.
- [ ] Click the reset link and confirm you can set a new password and are redirected to `/dashboard`.

---

## Troubleshooting

### Email rate limit exceeded

**Symptom:** Supabase returns an error like `Email rate limit exceeded` during signup or password reset.

**Cause:** Supabase Auth enforces a per-email cooldown. By default, a given email address can only receive one confirmation email per 60 minutes.

**Fix:** Wait and retry. If you are testing repeatedly, use a different email address. Do not increase this limit unless you have a specific operational need — it protects against abuse.

---

### Confirmation link redirects to the homepage

**Symptom:** Clicking the confirmation link lands on `/` instead of `/dashboard`.

**Cause:** The `next` query parameter in the redirect URL is being stripped, the `Site URL` in Supabase is set incorrectly, or the `emailRedirectTo` value was not included in the `signUp` call.

**Fix:**
1. Confirm that the `signUp` call in `app/(auth)/signup/page.tsx` includes:
   ```ts
   emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`
   ```
2. In Supabase → Authentication → URL Configuration, confirm **Site URL** is set to `https://tutorportal-xi.vercel.app`.
3. Confirm `https://tutorportal-xi.vercel.app/**` is in the Redirect URLs list.

---

### Redirect URL not allowed

**Symptom:** After clicking the confirmation link, Supabase shows an error page that says the redirect URL is not allowed.

**Cause:** The redirect URL returned in the confirmation email is not in Supabase's Redirect URLs allowlist.

**Fix:** In Supabase → Authentication → URL Configuration → Redirect URLs, add:
```
https://tutorportal-xi.vercel.app/**
http://localhost:3000/**
```

---

### Expired confirmation link

**Symptom:** Clicking the confirmation link shows an error or redirects to `/login?error=confirmation_failed`.

**Cause:** Supabase confirmation links expire. The default is 24 hours (configurable in Authentication → Email → OTP Expiry).

**Fix:** The user must sign up again or request a new confirmation email. You can extend the expiry window in the Supabase dashboard if needed, but do not set it to zero (never expire).

---

### User confirmed but no profile row exists

**Symptom:** The user can log in but `/dashboard` shows a generic name, and the `public.profiles` table has no row for this user.

**Cause:** The `handle_new_user` trigger did not fire, or the migration was not run before the user signed up.

**Fix:**
1. In Supabase → **Database** → **Triggers**, confirm a trigger named `on_auth_user_created` exists on the `auth.users` table.
2. If the trigger is missing, re-run the migration SQL from `supabase/migrations/20240101000000_profiles.sql`.
3. To create a profile for existing users without one, run this query in the Supabase SQL Editor:
   ```sql
   insert into public.profiles (id, full_name, role)
   select
     id,
     coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), 'Student'),
     'student'
   from auth.users
   on conflict (id) do nothing;
   ```

---

### SMTP authentication failure

**Symptom:** The Supabase test email fails. The error mentions authentication or credentials.

**Cause:** The SMTP username or password is wrong. Common mistakes:
- Using your Resend account email as the username instead of the literal string `resend`
- The API key was truncated when copying
- The API key was revoked or rotated in Resend

**Fix:**
1. Go to Resend → API Keys. Confirm the key still exists and has Sending access.
2. Create a new API key if necessary.
3. Re-enter it in Supabase → Authentication → SMTP Settings → SMTP Password.
4. Make sure the username field contains exactly `resend`.

---

### Sender domain not verified

**Symptom:** Resend rejects the email or shows a domain verification error.

**Cause:** One or more DNS records (SPF, DKIM, MX) are missing or have not propagated.

**Fix:**
1. Go to Resend → Domains and check the status of each record.
2. If a record shows **Pending**, it has not propagated yet. Wait up to 48 hours.
3. If a record shows **Failed**, re-add the DNS record from the Resend dashboard and save it at your DNS provider.
4. Do not proceed with sending until all records show **Verified**.

---

### Emails going to spam

**Symptom:** Emails arrive but land in the spam or junk folder.

**Cause:** Missing or misconfigured email authentication records (SPF, DKIM, DMARC), or a newly registered domain with no sending history.

**Fix:**
1. Confirm all DNS records in Resend → Domains show **Verified**.
2. Add a DMARC record if you have not already. A minimal starting record:
   ```
   Type: TXT
   Name: _dmarc.mydomain.com
   Value: v=DMARC1; p=none; rua=mailto:dmarc@mydomain.com
   ```
   Replace `dmarc@mydomain.com` with an address you monitor.
3. Check [https://mxtoolbox.com/emailhealth](https://mxtoolbox.com/emailhealth) for your domain to identify any remaining issues.
4. New domains often have lower sender reputation. This typically improves after a few weeks of legitimate sending.
5. Review Resend's deliverability dashboard for bounce and spam-complaint rates.
