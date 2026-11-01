# Contract: `/auth/confirm` invitation activation

**Feature**: `020-team-management` | **Route**: `src/pages/AuthConfirmPage.tsx`

## 1. Route

- Public route `/auth/confirm`, outside `ProtectedRoute`.
- The Supabase Auth Invite e-mail template points to:

  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
  ```

- The link is valid for 24 hours (Supabase Auth `Email OTP Expiration` =
  `86400` seconds) and works once.

## 2. Processing order

1. Read `token_hash` and `type` from `window.location.search`.
2. Immediately call
   `window.history.replaceState({}, document.title, window.location.pathname)`
   so the token disappears from the address bar **before** `verifyOtp`.
3. If `token_hash` is missing or `type !== 'invite'`, show the expired/used
   message and stop.
4. `supabase.auth.verifyOtp({ token_hash, type: 'invite' })`.
5. On success: `supabase.rpc('activate_own_profile')`.
6. On success: `navigate('/reset-password', { replace: true })`.
7. On any error (verify or activation): show the expired/used message with a link
   to `/login`.

## 3. Messages

Expired, used, invalid or wrong type:

> Deze uitnodigingslink is verlopen of al gebruikt. Vraag uw beheerder om een
> nieuwe uitnodiging.

Activation RPC failure (the link was valid but the profile could not be activated):

> Uw account kon niet worden geactiveerd. Neem contact op met uw beheerder.

All text is Dutch in the u-form. The error message is visible, announced to
assistive technology and not conveyed by colour alone.

## 4. Security and privacy

- The `token_hash` is never written to `localStorage`, `sessionStorage`, logs,
  PostHog or any other analytics property.
- `history.replaceState` removes the query before the async auth call.
- PostHog's `before_send` removes the query string and fragment from
  `$current_url`, `$referrer` and `$initial_*` URL properties, covering the
  pageview that may be captured before `replaceState` and the existing
  `/reset-password?code=` leak.
- The route is outside `ProtectedRoute`, so `ProtectedRoute` never stores
  `location.pathname + location.search` (with the token) in `redirectAfterLogin`.
- The resulting Supabase session is stored by the Supabase client as usual; the
  one-time invitation token is not.

## 5. Relation to `/reset-password`

`verifyOtp` establishes a session. The existing `ResetPasswordPage` checks
`supabase.auth.getSession()` and listens for `SIGNED_IN`, so it sees that session
and lets the invitee set a password of at least eight characters. After saving it
signs out and navigates to `/login`. No change to `ResetPasswordPage` is expected;
the implementation must verify this flow.

## 6. Accessibility

- The page is usable with the keyboard and a screen reader.
- The error is rendered as text (not an icon-only or colour-only signal).
- The link to `/login` is a real anchor/button with a Dutch accessible name.
