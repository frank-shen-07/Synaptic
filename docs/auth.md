# Supabase Auth Setup

This app now uses Supabase Auth for:

- email + password login
- Google OAuth
- email verification
- forgot password / password reset

## Environment

Set these in `.env.local`:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Use:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser
- `SUPABASE_SERVICE_ROLE_KEY` only on the server

## Migrations

Run the single setup file in the Supabase SQL editor:

1. [0000_synaptic_full_setup.sql](/Users/frankshen/Documents/GitHub/Synaptic/supabase/migrations/0000_synaptic_full_setup.sql)

That setup file includes:

- `user_id` ownership fields
- RLS on `sessions`, `ideas`, and `idea_edges`
- per-user select / insert / update / delete policies
- async node hydration fields on `ideas`

## Dashboard configuration

Open `Authentication`.

### URL Configuration

Set:

- `Site URL`
  - local: `http://localhost:3000`
  - production: your deployed app URL
- `Redirect URLs`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/reset-password`
  - your production equivalents

Add preview URLs too if you use them.

### Email auth

Enable email/password auth.

Keep email confirmation enabled so sign-up requires verification.

### Password reset

The app sends recovery emails through:

- `/auth/callback?next=/auth/reset-password`

That callback exchanges the auth code, then forwards the user to the reset screen.

### Google login

Enable `Google` under `Authentication -> Providers`.

In Google Cloud, configure:

- your app origin as an allowed origin
- `/auth/callback` as the redirect path on your deployed domain

Then paste the Google client ID and secret into Supabase.

## Flow summary

1. User opens `/auth`
2. User signs in, registers, uses Google, or requests a password reset
3. Supabase redirects back to `/auth/callback`
4. The callback exchanges the auth code for a session
5. The app stores and reads sessions using that user’s `auth.users.id`

## Auth files

- [app/auth/page.tsx](/Users/frankshen/Documents/GitHub/Synaptic/app/auth/page.tsx)
- [app/auth/callback/route.ts](/Users/frankshen/Documents/GitHub/Synaptic/app/auth/callback/route.ts)
- [app/auth/reset-password/page.tsx](/Users/frankshen/Documents/GitHub/Synaptic/app/auth/reset-password/page.tsx)
- [lib/integrations/supabase-browser.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/integrations/supabase-browser.ts)
- [lib/integrations/supabase-server.ts](/Users/frankshen/Documents/GitHub/Synaptic/lib/integrations/supabase-server.ts)
- [proxy.ts](/Users/frankshen/Documents/GitHub/Synaptic/proxy.ts)
