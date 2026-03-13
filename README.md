# Sluglines 🚗

> HOV-3 carpool coordination for Northern Virginia commuters

Sluglines helps commuters coordinate informal carpools ("slug lines") at designated pickup spots to leverage HOV-3 express lanes on I-95, I-395, and I-66.

## What is Slugging?

Slugging is a unique form of commuter carpooling unique to Northern Virginia where strangers share rides to use HOV-3 lanes. No money changes hands — drivers get HOV access, riders get a free commute. It's been happening for decades.

## Features

- 🟢 **Real-time board** — Live driver & rider counts at each spot, powered by Supabase real-time subscriptions
- 📍 **Spot directory** — All major pickup locations with directions, peak hours, and Google Maps links
- ℹ️ **How It Works** — Full guide for new sluggers (riders & drivers)
- 👤 **User accounts** — Sign up to save your home spot and commute preferences
- 📱 **Mobile app** — iOS and Android apps sharing the same Supabase backend

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Hosting | Vercel |
| Mobile | React Native + Expo (separate repo) |

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/cybersecurity-cell/sluglines.git
cd sluglines
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Database > Replication** and enable real-time for `spot_status` table
4. Copy your project URL and anon key from **Settings > API**

### 3. Configure Environment

```bash
cp .env.example .env.local
# Fill in your Supabase URL and anon key
```

### 4. Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

1. Push to GitHub (already done!)
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import `cybersecurity-cell/sluglines`
4. Add environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy** — done! 🎉
6. Point `sluglines.com` DNS to Vercel from GoDaddy dashboard

## Project Structure

```
sluglines/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with Navbar + Footer
│   │   ├── page.tsx            # Home page
│   │   ├── dashboard/page.tsx  # Live real-time board
│   │   ├── spots/page.tsx      # Pickup spots directory
│   │   ├── how-it-works/       # Slugging guide & FAQ
│   │   └── globals.css         # Global styles + Tailwind
│   ├── components/
│   │   ├── Navbar.tsx          # Responsive navigation
│   │   └── RealTimeBoard.tsx   # Live driver/rider counter
│   └── lib/
│       └── supabase/
│           ├── client.ts       # Browser Supabase client
│           └── server.ts       # Server Supabase client
├── supabase/
│   └── schema.sql              # Full database schema + seed data
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Database Schema

### `spot_status` (real-time)
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| spot_name | text | e.g. "Pentagon City" |
| location | text | Street address |
| destination | text | e.g. "Pentagon / DC" |
| drivers_waiting | integer | Current driver count |
| riders_waiting | integer | Current rider count |
| last_updated | timestamptz | Last count update |
| is_active | boolean | Show/hide the spot |

Counts reset daily at 6 AM via the `reset_daily_counts()` Supabase function (schedule with pg_cron or a Vercel cron job).

## Roadmap

- [ ] Push notifications when counts reach a threshold
- [ ] Commute history & analytics
- [ ] Estimated wait time prediction
- [ ] React Native mobile app (Expo)
- [ ] Admin dashboard for spot management

## License

MIT — feel free to use this for your own commuter community!
