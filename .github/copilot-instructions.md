# Calday Workspace Instructions

- This is a Next.js 16 App Router, TypeScript, Tailwind, Supabase SSR application deployed on Vercel.
- Use `proxy.ts` for Supabase session refresh; verify user identity with `auth.getUser()` or verified claims on server paths.
- Treat Supabase Row Level Security and database functions as the authorization boundary. Never trust client role state.
- Do not expose or add service-role/secret keys to browser code. Invitation tokens are random, single-use, hashed in the database, and expire.
- Keep workspace data scoped by workspace ID and preserve admin, contributor, and viewer permissions.
- Run `npm run lint` and `npm run build` after meaningful changes.
- Keep secrets in local/Vercel environment variables, never in source control.
