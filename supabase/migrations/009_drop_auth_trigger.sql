-- Darwin Migration 009: Drop on_auth_user_created trigger
-- The trigger conflicts with edge functions (create-tenant, invite-user)
-- that handle profile creation manually. The trigger causes
-- "Database error creating new user" when admin.createUser() is called
-- because both the trigger and the edge function try to insert into profiles.

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

COMMIT;
