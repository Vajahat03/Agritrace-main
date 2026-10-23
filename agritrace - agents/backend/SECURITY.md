# Authentication and workspace security

The application runtime requires Supabase-hosted PostgreSQL through `SUPABASE_DATABASE_URL`; SQLite connection strings are rejected. Use the Session Pooler connection string from Supabase's Connect panel for local IPv4 networks. The backend validates the connection and creates application tables at startup. Scan images are stored in the private `agritrace-scans` Supabase Storage bucket.

Set `SUPABASE_URL`, `SUPABASE_DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the server-side `.env`. The service-role key must never be exposed in a browser environment or committed. `requirements.txt` installs the PostgreSQL driver; install `requirements-vision.txt` to run image inference.

## Identity and sessions

- Roles are constrained to `admin`, `farmer`, `vendor`, and `customer`. Self-service registration may create only farmer, vendor, or customer accounts; admin must be provisioned out-of-band.
- Emails are trimmed and case-normalized; phone numbers are stored in normalized international form and must include a country code.
- Passwords use per-password salted scrypt hashes. The API never returns password hashes.
- Login creates a 256-bit opaque token. Only an HMAC-SHA256 digest is stored in `sessions`; the raw token is sent only in the HttpOnly, SameSite=Lax cookie. Production must enable Secure cookies and supply a random `AUTH_TOKEN_PEPPER` of at least 32 bytes.
- Each login creates a separate session. Logout revokes only the presented session.

## Workspace authorization

The server creates a workspace during registration and records the user's membership and role. Protected routes derive user/workspace identity from the session. Farmer farm operations also check `owner_user_id`; client-supplied IDs never establish ownership. Workspace and owner foreign keys constrain inserts. Legacy global in-memory sample routes without ownership metadata are admin-only; public batch traceability remains intentionally public.

User-scoped farms, produce, scans, predictions, and agent runs are persisted in Supabase PostgreSQL. Scan image bytes are stored in private Supabase Storage and fetched by the backend for inference. Application reads and writes continue to pass through FastAPI membership and ownership checks. Backend database and service-role credentials are never sent to the browser. If direct browser access to tables is added later, enable and test RLS policies before exposing the Data API.

Cookie-authenticated state-changing requests are restricted to configured `FRONTEND_ORIGINS`; SameSite=Lax is also set.

## Migration and operational notes

- `scripts/migrate_sqlite_to_supabase.py` copies existing SQLite records and scan images without modifying the source SQLite database. Retain the original file as a backup until the Supabase deployment is verified.
- The repository's legacy seeded analytics and batches remain prototype data and are not tenant-owned business records; they are not available to regular users.
- Admin-wide access is intentionally privileged and must be assigned only through trusted database provisioning.
