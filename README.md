# Telegram AI Business Assistant

A production-grade full-stack SaaS application for managing business contacts, companies, tasks, and reminders — with Telegram Bot integration and an AI-ready architecture.

![Dashboard Screenshot](./docs/screenshots/dashboard.png)
![Telegram Integration](./docs/screenshots/telegram.png)

## Overview

**BizAssistant** is a modern business CRM that combines a web dashboard with a Telegram bot. Users can manage their business data through a polished SaaS interface or directly from Telegram. Built with enterprise patterns: modular NestJS backend, Next.js 15 frontend, JWT authentication, and PostgreSQL persistence.

### Key Features

- **Authentication** — Register, login, JWT access tokens, refresh token rotation
- **CRM** — Contacts, companies, tasks (with statuses/priorities), notes, reminders
- **Telegram Bot** — Webhook mode with 10 commands (`/start`, `/connect`, `/tasks`, etc.)
- **Dashboard** — Statistics, recent activity, search, filtering, pagination
- **API** — RESTful endpoints with Swagger documentation
- **Security** — Helmet, rate limiting, CORS, input validation, password hashing

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js 15     │────▶│  NestJS API      │────▶│  Neon PostgreSQL│
│  (Vercel)       │     │  (Render/Docker) │     │                 │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │  Telegram Bot API │
                          │  (Webhook mode)   │
                          └──────────────────┘
```

### Backend Modules

| Module | Description |
|--------|-------------|
| `auth` | JWT login, register, refresh |
| `users` | Profile management |
| `contacts` | CRUD with search & pagination |
| `companies` | CRUD with relations |
| `tasks` | Status workflow, priorities, due dates |
| `notes` | Standalone and task-linked notes |
| `reminders` | Scheduled reminders |
| `telegram` | Webhook handler, bot commands |
| `activity` | Audit log for all actions |
| `statistics` | Dashboard aggregates |
| `health` | Health check endpoint |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS |
| Backend | NestJS 11, TypeScript, Prisma ORM |
| Database | PostgreSQL (Neon) |
| Bot | Telegram Bot API (webhook) |
| Auth | JWT + Refresh Tokens, bcrypt |
| Docs | Swagger/OpenAPI |
| Deploy | Vercel (frontend), Render (backend), Neon (DB) |

## Folder Structure

```
telegram-ai-business-assistant/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   ├── seed.ts            # Demo data seeder
│   │   └── migrations/        # Prisma migrations
│   ├── src/
│   │   ├── auth/              # Authentication module
│   │   ├── contacts/          # Contacts CRUD
│   │   ├── companies/         # Companies CRUD
│   │   ├── tasks/             # Tasks module
│   │   ├── notes/             # Notes module
│   │   ├── reminders/         # Reminders module
│   │   ├── telegram/          # Bot webhook & commands
│   │   ├── activity/          # Activity logging
│   │   ├── statistics/        # Dashboard stats
│   │   ├── health/            # Health check
│   │   ├── common/            # Guards, filters, DTOs
│   │   ├── config/            # Environment validation
│   │   └── prisma/            # Prisma service
│   ├── Dockerfile             # Render deployment
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # UI components & layout
│   │   ├── context/           # Auth provider
│   │   └── lib/               # API client, types, utils
│   └── .env.example
├── render.yaml                # Render Blueprint
├── .env.example               # Root environment template
└── README.md
```

## Environment Variables

Copy `.env.example` to configure your environment:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `WEBHOOK_URL` | Backend public URL (e.g. `https://api.example.com/api`) |
| `FRONTEND_URL` | Frontend URL for CORS |
| `BACKEND_URL` | Backend public URL |
| `NEXT_PUBLIC_API_URL` | API URL for frontend (e.g. `https://api.example.com/api`) |

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon free tier works)
- No Docker required locally

### 1. Database Setup (Neon)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and secrets

npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API runs at `http://localhost:3001`  
Swagger docs at `http://localhost:3001/api/docs`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001/api

npm install
npm run dev
```

App runs at `http://localhost:3000`

### Demo Account

After seeding:
- **Email:** `demo@businessassistant.app`
- **Password:** `Demo1234!`

## Deploy to Render (Backend)

1. Push repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your repository
4. Set **Root Directory** to `backend` or use `render.yaml` Blueprint
5. Select **Docker** as runtime (uses `backend/Dockerfile`)
6. Add environment variables from `.env.example`
7. Set `WEBHOOK_URL` to `https://your-service.onrender.com/api`
8. Deploy — migrations and seed run automatically on startup

## Deploy to Vercel (Frontend)

1. Import the GitHub repo on [Vercel](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.onrender.com/api`
4. Deploy

Update backend `FRONTEND_URL` to your Vercel URL after deployment.

## Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Copy the token to `TELEGRAM_BOT_TOKEN`
3. Set `WEBHOOK_URL` to your backend URL + `/api` (webhook registers at `/api/telegram/webhook`)
4. In Telegram, send `/connect your@email.com` to link your account

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/connect <email>` | Link dashboard account |
| `/help` | List commands |
| `/newtask <title>` | Create task |
| `/tasks` | List open tasks |
| `/remind <title> \| <datetime>` | Set reminder |
| `/contact <name>` | Add contact |
| `/company <name>` | Add company |
| `/search <query>` | Search all data |
| `/stats` | View statistics |

## API Overview

Base URL: `/api`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Create account |
| `/auth/login` | POST | No | Login |
| `/auth/refresh` | POST | Refresh | Refresh tokens |
| `/users/me` | GET/PATCH | Yes | Profile |
| `/contacts` | CRUD | Yes | Contacts |
| `/companies` | CRUD | Yes | Companies |
| `/tasks` | CRUD | Yes | Tasks |
| `/notes` | CRUD | Yes | Notes |
| `/reminders` | CRUD | Yes | Reminders |
| `/activity` | GET | Yes | Activity log |
| `/statistics` | GET | Yes | Dashboard stats |
| `/telegram/webhook` | POST | No | Bot webhook |
| `/telegram/connection` | GET | Yes | Connection status |
| `/health` | GET | No | Health check |

Full documentation: `/api/docs` (Swagger)

## Database Schema

```
User ──┬── TelegramConnection
       ├── Contact ── Company
       ├── Company ──┬── Contact
       │             └── Task
       ├── Task ──┬── Note
       │          └── Reminder
       ├── Note
       ├── Message
       ├── Reminder
       ├── AIRequest
       └── ActivityLog
```

### Entities

- **Users** — Authentication and ownership
- **TelegramConnections** — Bot account linking
- **Contacts** — People with company relations
- **Companies** — Organizations
- **Tasks** — TODO/IN_PROGRESS/COMPLETED/CANCELLED with priorities
- **Notes** — Text notes (optional task link)
- **Messages** — Telegram message log
- **Reminders** — Scheduled notifications
- **AIRequests** — AI-ready request queue (architecture placeholder)
- **ActivityLogs** — Full audit trail

## Future Improvements

- [ ] OpenAI/GPT integration for `/ai` command and smart suggestions
- [ ] Email notifications for reminders
- [ ] Team workspaces with role-based access
- [ ] Calendar view for tasks and reminders
- [ ] CSV import/export for contacts
- [ ] Real-time updates via WebSockets
- [ ] Mobile PWA with offline support
- [ ] Multi-language Telegram bot responses

## License

MIT
