# Setup guide

This takes about 20 minutes. All three services are free at this size.

## 1. Supabase (login, database and file storage)

1. Go to https://supabase.com and click **Start your project**. Sign up (signing up with a GitHub account from step 2 works too).
2. Click **New project**. Name it `jobsite`, choose a strong database password (save it somewhere), pick the region closest to you, and click **Create**. Wait a minute or two for it to finish.
3. In the left menu, open **SQL Editor** and click **New query**.
4. Open `supabase/schema.sql`, copy all of it, paste it in, and click **Run**. It should say "Success".
5. Still in the SQL Editor, run this once with your team's real emails (lowercase):
   ```sql
   insert into public.members (email, name) values
     ('you@example.com', 'Aaron'),
     ('manager2@example.com', 'Name'),
     ('manager3@example.com', 'Name');
   ```
6. Turn off public sign-ups: **Authentication > Sign In / Providers**, then turn **off** "Allow new users to sign up" and click Save.
7. Create each person's login: **Authentication > Users > Add user > Create new user**. Enter their email and a temporary password, and tick **Auto Confirm User**. Each person can change their password later on the app's Account screen.
8. Get the two connection values: **Project Settings > Data API** (or **API**). Copy the **Project URL** and the **anon public** key. The anon key is meant to be public, so it's safe to send in chat. Never share the `service_role` key.

## 2. GitHub (stores the code)

1. Sign up at https://github.com/signup.
2. Create a new **private**, empty repository named `jobsite-app` at https://github.com/new. Don't add a README.
3. Connect GitHub to Claude at https://claude.ai/connect-github so Claude can upload the code.

## 3. Vercel (puts the app online)

1. Go to https://vercel.com/signup and choose **Continue with GitHub**.
2. Click **Add New > Project**, then **Import** the `jobsite-app` repository.
3. Open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy**. You'll get a web address like `jobsite-app.vercel.app`.

## 4. Put it on your iPhone

1. Open the web address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. It now opens full-screen from its own icon, like an app.

## Adding or removing a person later
- **Add:** do steps 1.5 (insert their email) and 1.7 (create their login).
- **Remove:** in Supabase, delete them under Authentication > Users and run
  `delete from public.members where email = 'their@email.com';`
