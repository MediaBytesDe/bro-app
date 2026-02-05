# Supabase Connection Pooling Configuration

## Client Configuration (Code)

The Supabase client code in this project includes:
- HTTP keepalive for fetch requests (prevents connection drops during navigation)
- PKCE auth flow
- Explicit schema setting

## Database Connection Pooling (Supabase Dashboard)

**IMPORTANT:** For 30+ concurrent users, you MUST configure actual database connection pooling in the Supabase Dashboard:

### Steps:
1. Go to Supabase Dashboard: https://app.supabase.com
2. Navigate to: Database → Connection Pooling
3. Enable connection pooling (Supavisor)
4. Configuration:
   - Pool mode: Transaction (recommended for most apps)
   - Pool size: 15-20 for 30+ users
   - Statement timeout: 30s

### Connection Strings:
- **Direct connection** (port 5432): For migrations, backups
- **Pooled connection** (port 6543): For application queries

The application automatically uses pooled connections when configured in your Supabase project.

### Verification:
Check Database → Logs to see connection counts and pool usage.
