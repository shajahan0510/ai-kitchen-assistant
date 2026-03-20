# 🍽️ AI Kitchen Assistant

A production-ready full-stack web app with AI-powered recipe suggestions, a smart fridge scanner, meal planning, grocery list generation, an AI chatbot, and a full admin portal.

**Stack:** Node.js · Express.js · Supabase (PostgreSQL + Auth + Storage) · Groq (Llama 3 AI) · Imagga (Computer Vision) · Vanilla JS

---

## ⚡ Quick Start

### 1. Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Supabase](https://supabase.com/) project (free tier works)
- [Groq API Key](https://console.groq.com/keys) (for recipe generation)
- [Imagga API Key](https://imagga.com/profile/dashboard) (for fridge scanning)

### 2. Install dependencies
```bash
cd ai-kitchen-assistant
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials. We use **Groq** for high-speed recipe suggestions and **Imagga** for fridge image scanning.

```env
GROQ_API_KEY=your_groq_key
IMAGGA_API_KEY=your_imagga_key
IMAGGA_API_SECRET=your_imagga_secret
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```
Then open `.env` and fill in your keys:

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com/keys) |
| `IMAGGA_API_KEY` | [Imagga Dashboard](https://imagga.com/dashboard/settings) |
| `IMAGGA_API_SECRET` | [Imagga Dashboard](https://imagga.com/dashboard/settings) |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon key |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `JWT_SECRET` | Any long random string |

### 4. Set up the database
1. Go to your **Supabase Dashboard → SQL Editor**
2. Paste the entire contents of `database/schema.sql`
3. Click **Run**

### 5. Create Supabase Storage bucket
In Supabase Dashboard → **Storage**:
- Create a bucket named `recipe-images`
- Set it to **Public**

### 6. Create an admin user
By default, you can sign up through the app. To use the requested default admin:
1. Run the SQL script provided in Step 4.
2. Default credentials:
   - **Username/Email**: `admin@kitchen.ai`
   - **Password**: `admin123`

To promote any existing user to admin via SQL:
```sql
UPDATE public.profiles SET role = 'admin' WHERE username = 'your_username';
```

### 7. Start the server
```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

### 8. Open in browser
```
http://localhost:3000
```

---

## 📁 Project Structure
```
ai-kitchen-assistant/
├── backend/
│   ├── config/supabase.js       # Supabase client
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── adminAuth.js         # Admin-only guard
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── validate.js          # Input validation
│   ├── routes/
│   │   ├── auth.js              # /api/auth/*
│   │   ├── recipes.js           # /api/recipes/*
│   │   ├── ai.js                # /api/ai/*
│   │   ├── planner.js           # /api/planner/*
│   │   ├── grocery.js           # /api/grocery/*
│   │   └── admin.js             # /api/admin/*
│   ├── services/gemini.js       # Gemini AI wrapper
│   ├── app.js                   # Express setup
│   └── server.js                # Entry point
├── frontend/
│   ├── index.html               # Login / signup
│   ├── dashboard.html           # User dashboard
│   ├── admin.html               # Admin portal
│   ├── css/styles.css           # Full stylesheet
│   └── js/
│       ├── auth.js              # Auth + API helper
│       ├── dashboard.js         # Dashboard logic
│       ├── chatbot.js           # AI chatbot
│       ├── planner.js           # Meal planner
│       ├── grocery.js           # Grocery list
│       └── admin.js             # Admin panel
└── database/schema.sql          # Full DB schema + RLS
```

---

## 🔗 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| POST | `/api/auth/admin-login` | — | Admin-only login |
| POST | `/api/auth/logout` | ✅ | Logout |
| GET | `/api/recipes` | — | List recipes |
| POST | `/api/recipes` | ✅ | Upload recipe |
| POST | `/api/recipes/:id/like` | ✅ | Like/unlike |
| POST | `/api/ai/suggest` | ✅ | AI recipe suggest |
| POST | `/api/ai/scan-fridge` | ✅ | Image ingredient detect |
| POST | `/api/ai/chat` | ✅ | Chatbot |
| GET/POST | `/api/planner` | ✅ | Meal plans |
| GET/POST | `/api/grocery` | ✅ | Grocery list |
| POST | `/api/grocery/generate` | ✅ | Auto-generate from plan |
| GET | `/api/admin/users` | 🛡️ Admin | List users |
| POST | `/api/admin/users` | 🛡️ Admin | Add user |
| DELETE | `/api/admin/users/:id` | 🛡️ Admin | Delete user |
| GET | `/api/admin/analytics` | 🛡️ Admin | Platform stats |

---

## 🧪 Testing Guide

### Test auth flow
```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","username":"chef1"}'

# Login — copy the token from the response
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}'
```

### Test AI suggest
```bash
curl -X POST http://localhost:3000/api/ai/suggest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredients":["chicken","garlic","lemon","spinach"]}'
```

### Test health
```bash
curl http://localhost:3000/api/health
```

---

## 🚀 Deployment

### Option A — Railway (recommended)
1. Push to GitHub
2. Connect repo to [Railway](https://railway.app/)
3. Add all env variables in Railway dashboard
4. Railway auto-detects Node.js and deploys

### Option B — Render
1. Create a **Web Service** on [Render](https://render.com/)
2. Build command: `npm install`
3. Start command: `npm start`
4. Add env variables

### Option C — VPS (Ubuntu)
```bash
npm install -g pm2
pm2 start backend/server.js --name kitchen-ai
pm2 save && pm2 startup
```
Use nginx as reverse proxy pointing to port 3000.

---

## 🔒 Security Features
- Helmet.js security headers
- CORS whitelist
- Rate limiting (AI: 20/15min, Auth: 10/15min)
- Input validation on all endpoints
- Supabase Row Level Security (RLS)
- Admin role enforcement
- Tokens never stored in frontend code
