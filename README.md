# 🍿 Popcorn

A full-stack movie tracking and social platform. Rate movies the right way — no arbitrary stars. Pick Liked, Fine, or Disliked, then rank films head-to-head so your true preferences emerge.

## Features

- **Tier-based rating + head-to-head ranking** — categorize movies into Liked / Fine / Disliked, then compare them pairwise via a binary search algorithm to assign precise numeric scores
- **AI recommendations** — GPT-4o-mini analyzes your taste profile and generates personalized picks with natural-language explanations for each suggestion
- **"Watch tonight" matcher** — enter a friend's username and get movies you'd both enjoy based on shared genre preferences and unrated overlap
- **Streaming availability** — see which services (Netflix, Disney+, Max, Hulu, etc.) carry each film, pulled from TMDB
- **Showtime lookup** — geolocation-based theater showtimes for now-playing films with format badges (IMAX, Dolby, 4DX)
- **Social feed** — follow friends, browse their ratings in an infinite-scroll activity feed, and compare taste profiles side-by-side
- **Viewing stats** — watch time, genre breakdowns, top directors, monthly bar charts, and a generated personality label

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Database:** SQLite via `better-sqlite3`
- **Auth:** NextAuth (credentials)
- **AI:** OpenAI API (GPT-4o-mini)
- **Movie data:** TMDB API
- **Styling:** Tailwind CSS v4

## Getting Started

Copy `.env.example` to `.env.local` and fill in your API keys:

```
TMDB_API_KEY=...
OPENAI_API_KEY=...
NEXTAUTH_SECRET=...
```

Then run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.
