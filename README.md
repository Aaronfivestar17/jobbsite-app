# Jobsite

A phone-friendly web app for a construction business, with three tabs:

1. **To-do**: a simple checklist. Tap the box to check an item off.
2. **Finances**
   - **Bill**: client invoices you still need to send. Tap "Mark sent" when it goes out.
   - **Collect**: sent invoices waiting on payment, with overdue ones flagged. Tap "Paid" when the money comes in.
3. **Projects**: each project has two folders.
   - **Submittals**: documents with a title, date, review status and the file.
   - **Photos**: site photos grouped by date, each with a short description.

Only people on the approved list can sign in. See `SETUP.md` for setup.

## Tech
- React + Vite, hosted on Vercel
- Supabase for login, database (Postgres) and private file storage
- Database setup: `supabase/schema.sql`

## Run locally
```
cp .env.example .env   # fill in your Supabase URL and anon key
npm install
npm run dev
```
