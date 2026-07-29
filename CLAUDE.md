# CLAUDE.md

## Project

TutorPortal is a tutoring management platform built with:

- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

The goal is to build a production-quality tutoring platform that is clean, maintainable, and scalable.

---

# Development Philosophy

Always:

- understand the existing implementation before changing it;
- find the root cause instead of patching symptoms;
- reuse existing components, utilities, hooks and RPCs;
- keep the codebase consistent;
- avoid duplicate logic;
- preserve existing behavior unless explicitly requested otherwise.

Never redesign unrelated parts of the project.

---

# Database Rules

Supabase is the source of truth.

Never edit an already-applied migration.

Always create a new migration.

Prefer extending existing RPCs instead of creating duplicate logic.

Respect Row Level Security.

Never use frontend-only writes for important workflows.

---

# UI Rules

Reuse existing:

- buttons
- cards
- modals
- StatusBadge
- spacing
- typography
- loading states

Keep the application visually consistent.

---

# Meeting Workflow

The meeting workflow is one of the most important parts of TutorPortal.

Never simplify it.

Current behavior:

- students submit up to 3 proposed makeup times;
- majority requests become group_pending_reschedule;
- teacher can still see every proposal;
- teacher manually chooses the final meeting;
- replacement meetings remain linked to the original.

When improving this workflow:

- preserve history;
- preserve submitted proposals;
- never lose audit information.

---

# Notifications

Notifications are in-site notifications.

Current supported events include:

Teacher:
- makeup requested
- group reschedule required
- homework submitted

Student:
- homework assigned
- homework graded
- makeup approved
- makeup rejected
- meeting rescheduled

Notifications must be created from the server/database, not only in frontend state.

Always verify:

- recipient
- unread badge
- mark as read
- persistence after refresh

---

# Dates & Timezones

TutorPortal uses:

America/Panama

Reuse existing helpers.

Never introduce new date formatting unless necessary.

Do not break month navigation in DatePicker.

---

# TypeScript

Avoid `any`.

Prefer existing shared types.

Keep components small.

Move repeated logic into helpers.

---

# Git

Never run:

- git reset --hard
- git clean -fd
- force push

unless explicitly requested.

Do not commit unless asked.

---

# Verification

After every implementation run:

npx tsc --noEmit

npm run lint

npm run build

If user interaction changed, provide manual testing steps.

Do not claim something is fixed without explaining how it was verified.

---

# Response Format

At the end of every task report:

- Root cause
- Files changed
- Database migrations
- Manual testing
- Remaining limitations