# Contract delta: `create-tenant` (bestaande functie)

**Feature**: `019-platform-assistant-catalog` | **Basis**: `supabase/functions/create-tenant/index.ts`

Request (`organization_name`, `user_email`, `user_full_name`, `user_password`, `user_role`) en
de succesresponse (`{ success, organization, user }`) blijven ongewijzigd.

## Autorisatie

Vervangen: `callerProfile.role === 'admin'` → `is_platform_admin()`.

1. JWT valideren (bestaand).
2. User-context client maken (anon key + `Authorization: Bearer <jwt>`).
3. `userClient.rpc('is_platform_admin')` aanroepen.
4. Alles anders dan `true` → `403` met
   `{ "error": "Alleen de platformbeheerder kan nieuwe organisaties aanmaken." }`.

De bestaande `profiles`-lookup voor de rol is niet meer nodig.

## Seeding

Na het aanmaken van de organisatie en het profiel:

```ts
await supabase.rpc('platform_seed_org_assistants', {
  p_org: org.id,
  p_actor: user.id,
});
```

- `p_actor` = `auth.uid()` van de aanroeper (moet een bestaande `profiles`-rij zijn).
- Elke catalogusassistent krijgt een `ai_assistants`-rij met `is_active = true`.
- Mislukt de seed, dan ruimt de functie best-effort op (profiel, auth-gebruiker, organisatie) en
  geeft `500` met "De organisatie kon niet volledig worden aangemaakt. Probeer het opnieuw."
  Zo bestaat er nooit een organisatie zonder assistenten.

## Ongewijzigd

- Validatie van verplichte velden, wachtwoordlengte en `user_role` (`admin`/`member`).
- Foutafhandeling bij het aanmaken van organisatie, gebruiker en profiel.
- Geen wachtwoorden of tokens in logs.
