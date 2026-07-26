# TutorPortal

A modern student portal for SAT and AP tutoring. Built with Next.js, TypeScript, and Tailwind CSS.

## Local setup

**Requirements:** Node.js 18 or later.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Routes

| Path | Description |
|---|---|
| `/` | Public landing page |
| `/dashboard` | Student dashboard |
| `/homework` | Homework list |
| `/schedule` | Lesson schedule |

## Build & lint

```bash
npm run build   # production build
npm run lint    # ESLint
```

## Deploy to GitHub and Vercel

### 1. Create a GitHub repository

Go to [github.com/new](https://github.com/new), create a new repository (e.g. `tutorportal`), and do **not** initialize it with any files.

### 2. Push the project

```bash
cd tutorportal
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tutorportal.git
git push -u origin main
```

### 3. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your GitHub repository
3. Leave all settings at their defaults — no environment variables are needed
4. Click **Deploy**

Vercel will build and deploy the app automatically. Every future `git push` to `main` triggers a new deployment.

## PWA installation

The app includes a web manifest and can be installed as a PWA on mobile devices and Chrome/Edge on desktop. Look for the install prompt in the browser address bar or share sheet.

## What is not included yet

The following features are intentionally postponed for future phases:

- User authentication and accounts
- Database / Supabase
- Teacher dashboard
- Homework file uploads
- Video lesson integration
- Push notifications
- Offline support beyond basic installation
- Payments
- AI features
