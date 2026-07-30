# CLAUDE.md

# Project

TutorPortal is a tutoring management platform built with:

- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

The primary goal is to build a production-quality tutoring platform that is simple, maintainable, scalable, and reliable.

Long-term, TutorPortal's competitive advantage is AI, not feature bloat.

Whenever making implementation decisions, prefer simple solutions that create high-quality data for future AI features.

---

# Development Philosophy

Always:

- understand the existing implementation before changing it;
- find the root cause instead of patching symptoms;
- reuse existing components, utilities, hooks, helpers, RPCs, and database logic;
- keep the codebase consistent;
- avoid duplicate logic;
- preserve existing behavior unless explicitly requested otherwise;
- prefer small, incremental improvements over large rewrites.

Never redesign unrelated parts of the project.

Never over-engineer.

If two solutions are equally good, choose the simpler one.

---

# Database Rules

Supabase is the source of truth.

Database migrations are immutable.

Never modify an already-applied migration.

Always create a new migration.

Never silently change existing schemas.

Prefer extending existing tables, RPCs, triggers, and policies instead of duplicating functionality.

Respect Row Level Security.

Important workflows must happen in the database whenever possible.

Examples:

- notifications
- attendance
- audit history
- status transitions

Avoid frontend-only writes for critical business logic.

When adding data, prefer storing raw information instead of only derived values.

Example:

Store:

- joined_at

instead of only:

- attendance = present

This allows future AI features to analyze behavior.

---

# UI Rules

Reuse existing:

- buttons
- cards
- modals
- StatusBadge
- typography
- spacing
- loading states
- empty states
- toast notifications

Keep the UI visually consistent.

Avoid introducing new visual styles unless necessary.

If an item represents a meeting or homework assignment, it should generally be clickable using the project's reusable clickable-card pattern.

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
- preserve audit information;
- never lose previous meeting relationships.

---

# Homework

Homework should remain simple.

Avoid unnecessary grading complexity.

Reuse existing assignment flows.

Any notifications related to homework should originate from the database.

---

# Attendance

Attendance should be automatic whenever possible.

Teacher intervention should be the exception.

Automatic attendance is based only on actions TutorPortal can observe.

Teachers must always be able to override automatic attendance.

Store both:

- raw attendance data
- calculated attendance status

Future AI features will rely on attendance history.

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

Notifications must always originate from the backend/database.

Always verify:

- correct recipient
- unread badge
- mark as read
- persistence after refresh

Never implement notification logic only in frontend state.

---

# Dates & Timezones

TutorPortal uses:

America/Panama

Reuse existing helpers.

Never introduce duplicate date formatting utilities.

Do not break DatePicker navigation.

Keep all displayed dates and stored timestamps consistent.

---

# TypeScript

Avoid any.

Prefer existing shared types.

Keep components focused.

Extract repeated logic into shared helpers.

Favor composition over duplication.

---

# Routing

Never duplicate pages that already exist.

Reuse existing:

- meeting detail views
- homework pages
- dashboards
- modals

If multiple cards represent the same resource, they should navigate consistently.

---

# AI Philosophy

TutorPortal's uniqueness comes from AI.

Current features should collect clean, reliable data instead of implementing complex business logic.

Whenever possible, preserve information that could later improve AI analysis.

Examples:

- join timestamps
- attendance history
- homework completion
- grades
- meeting history
- notification history

Do not build speculative AI features.

Instead, build clean infrastructure that future AI systems can leverage.

---

# Git

Never run:

- git reset --hard
- git clean -fd
- force push

unless explicitly requested.

Do not commit unless asked.

Do not delete files unless requested.

---

# Verification

After every implementation run:

npx tsc --noEmit

npm run lint

npm run build

If user interaction changed:

Provide manual testing steps.

Do not claim something is fixed without explaining:

- how it was implemented;
- how it was verified;
- any remaining limitations.

---

# Response Format

At the end of every implementation include:

## Root Cause

Explain why the issue existed.

## Solution

Explain the implementation.

## Files Changed

List modified files.

## Database Migrations

Explain schema changes.

## Manual Testing

Explain exactly what should be tested.

## Remaining Limitations

Be honest about anything intentionally left for future work.