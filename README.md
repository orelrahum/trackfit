# TrackFit

AI-powered nutrition tracker for Israeli food products. Analyze meals via text, photo, or voice using Google Gemini AI.

## Features

- 🤖 AI food recognition (text, image, voice)
- 📊 Daily calorie & macro tracking
- 🔍 18,000+ Israeli food products database
- 🎯 Personalized nutrition goals
- 🔐 Google & email authentication (Supabase)
- 📱 Mobile-friendly PWA design

## Setup

```bash
npm run install:all
cp .env.example .env         # fill in Supabase + Gemini keys
cp client/.env.example client/.env
npm run migrate              # seed products into Supabase
npm run dev
```

Open http://localhost:5173

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Google OAuth + email)
- **AI:** Google Gemini 2.0 Flash
