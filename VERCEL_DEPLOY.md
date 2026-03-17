# Deploying Falcon Backend on Vercel

## Why "API not working" / 500 on login?

If Swagger loads but **POST /f1/auth/login** returns **500** with:

```text
Can't reach database server at "localhost:5432"
```

then the app on Vercel has **no valid database**. Vercel runs in the cloud; there is no PostgreSQL on `localhost`. You must use a **hosted PostgreSQL** and set **`DATABASE_URL`** in Vercel.

## Fix: set DATABASE_URL on Vercel

1. **Have a hosted PostgreSQL**
   - Examples: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app), [Render](https://render.com), or any Postgres host.
   - Create a database and copy the **connection string** (e.g. `postgresql://user:password@host:5432/dbname?sslmode=require`).

2. **Add env var in Vercel**
   - Open your project on [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**.
   - Add:
     - **Name:** `DATABASE_URL`
     - **Value:** your full Postgres connection string (from step 1).
   - Choose **Production** (and **Preview** if you want it for PRs), then **Save**.

3. **Create tables in the database (required before register/login)**
   - The Neon DB starts empty. Run **migrations** once from your machine so the `roles`, `users`, etc. tables exist.
   - In your project folder, set `DATABASE_URL` to your Neon URL (e.g. in `.env`), then run:
     ```bash
     pnpm run migrate:deploy
     ```
   - This applies all migrations and creates the tables. Optional: run `pnpm run seed` to create an admin user (or use **POST /f1/auth/register** with `role: "admin"` after this).

4. **Redeploy**
   - **Deployments** → open the **⋯** on the latest deployment → **Redeploy** (or push a new commit).
   - New deployments use the updated `DATABASE_URL`.

## Swagger "Servers" dropdown

In Swagger UI, pick **"Current (Vercel / same origin)"** or the option that points to:

```text
https://falcon-backend-github.vercel.app
```

so "Try it out" calls your deployed API, not localhost.

## Optional: other env vars

If your app uses Redis, JWT secret, Cloudinary, etc., add those in **Settings → Environment Variables** as well (same names as in your `.env`).
