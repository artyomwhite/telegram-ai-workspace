# Telegram AI Business Assistant

Full-stack CRM with Telegram bot integration.  
The project includes a Next.js frontend, a NestJS API, and PostgreSQL persistence via Prisma.

## Project Overview

The application provides account-based business management with:
- contacts and companies
- task and reminder workflows
- activity tracking
- Telegram bot command handling through webhook mode

## Features

- JWT authentication (register, login, refresh)
- Contacts, companies, tasks, notes, reminders CRUD
- Search, filtering, pagination, and dashboard statistics
- Telegram commands: `/start`, `/connect`, `/help`, `/newtask`, `/tasks`, `/remind`, `/contact`, `/company`, `/search`, `/stats`
- API documentation with Swagger (`/api/docs`)
- Health endpoint (`/api/health`)

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: NestJS 11, TypeScript, Prisma ORM
- Database: PostgreSQL (Neon)
- Deployment: Vercel (frontend), Render (backend, Docker)

## Architecture

```
Frontend (Next.js, Vercel)
        |
        v
Backend API (NestJS, Render, Docker)
        |
        v
PostgreSQL (Neon)
        ^
        |
Telegram Bot API (Webhook -> Backend /api/telegram/webhook)
```

## Folder Structure

```
telegram-ai-workspace/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── vercel.json
│   └── .env.example
├── .env.example
├── render.yaml
└── README.md
```

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon or local Postgres)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Backend runs on `http://localhost:3001` with Swagger at `http://localhost:3001/api/docs`.

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Environment Variables

Required variables are documented in:
- root: `.env.example`
- backend: `backend/.env.example`
- frontend: `frontend/.env.example`

Core variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `TELEGRAM_BOT_TOKEN`
- `WEBHOOK_URL`
- `FRONTEND_URL`
- `BACKEND_URL`
- `NEXT_PUBLIC_API_URL`
- `PORT`
- `NODE_ENV`

## Deployment

### Render (Backend)

- Uses `backend/Dockerfile`
- Blueprint file: `render.yaml`
- Health check path: `/api/health`
- Start command in container runs:
  - `prisma migrate deploy`
  - `prisma db seed`
  - `node dist/main`

### Vercel (Frontend)

- Root directory: `frontend`
- Build command: `npm run build`
- Required env:
  - `NEXT_PUBLIC_API_URL=https://<your-render-backend>/api`

### Neon (Database)

- Create PostgreSQL database and copy connection string to:
  - `DATABASE_URL` (backend)

## API Endpoints

Base path: `/api`

- Auth: `/auth/register`, `/auth/login`, `/auth/refresh`
- Users: `/users/me`
- Contacts: `/contacts`
- Companies: `/companies`
- Tasks: `/tasks`
- Notes: `/notes`
- Reminders: `/reminders`
- Activity: `/activity`, `/activity/recent`
- Statistics: `/statistics`
- Telegram: `/telegram/webhook`, `/telegram/connection`, `/telegram/webhook/info`, `/telegram/disconnect`
- Health: `/health`

## Telegram Integration

1. Create bot in BotFather and get `TELEGRAM_BOT_TOKEN`.
2. Set `WEBHOOK_URL` to your backend public API base, e.g.:
   `https://<render-service>.onrender.com/api`
3. Webhook endpoint used by Telegram:
   `https://<render-service>.onrender.com/api/telegram/webhook`
4. Connect user account in Telegram with:
   `/connect your@email.com`

## License

MIT
