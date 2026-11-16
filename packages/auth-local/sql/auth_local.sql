-- Accounts, external identities and sessions of @quatrain/auth-local.
-- Idempotent: safe to run at every start.

create table if not exists auth_account (
   id uuid primary key,
   -- Sign-in name, stored lower-cased. Null for an account that only signs in through an external identity.
   login text unique,
   email text,
   name text,
   -- Self-describing scrypt hash. Null when the account has no password.
   password_hash text,
   claims jsonb not null default '{}'::jsonb,
   disabled boolean not null default false,
   created_at timestamp with time zone not null default now(),
   updated_at timestamp with time zone not null default now()
);

-- An identity at an external provider, owned by exactly one account.
create table if not exists auth_identity (
   issuer text not null,
   subject text not null,
   account uuid not null references auth_account (id) on delete cascade,
   created_at timestamp with time zone not null default now(),
   primary key (issuer, subject)
);

create index if not exists auth_identity_account_idx on auth_identity (account);

-- A session. Only the SHA-256 digest of its token is stored.
create table if not exists auth_session (
   id uuid primary key,
   account uuid not null references auth_account (id) on delete cascade,
   token_hash text not null unique,
   created_at timestamp with time zone not null default now(),
   last_seen_at timestamp with time zone not null default now(),
   -- Absolute end of the session, whatever its activity.
   expires_at timestamp with time zone not null
);

create index if not exists auth_session_account_idx on auth_session (account);
create index if not exists auth_session_expires_at_idx on auth_session (expires_at);
