# BSHS QR Attendance & Class Calendar (Prototype)

Front-end prototype for the research project **“Development and Performance Evaluation of a QR Code-Based Digital Attendance Monitoring System for Learners of Bagong Silang High School.”**

Teachers take attendance with QR codes and record what happened in class each day. Students see their attendance and an interactive class calendar. When a student was absent, the calendar automatically lists the lessons, work, and announcements they missed.

> **This is a demonstration prototype.** It ships with clearly labeled **sample data** (every ID starts with `SAMPLE`, and the section is named “Sample Section”). It contains no real school records. Data is saved only in the browser's `localStorage`. There is no server, shared database, or real authentication yet; see [Limitations](#limitations-what-is-simulated).

## Running it

Requires Node.js 20+.

```bash
npm install        # .npmrc sets legacy-peer-deps (works around an npm peer-resolution bug)
npm run dev        # http://localhost:5173
npm test           # unit tests for attendance/activity logic
npm run build      # static build in dist/ (works on GitHub Pages or any static host)
```

The camera scanner requires **HTTPS or localhost**, because browsers block camera access on plain HTTP. To test on a phone over your LAN, deploy the build to an HTTPS host (e.g. GitHub Pages or Netlify), or use the “Upload a photo” option.

## Demo walkthrough

1. **Sign in as the student “Juan Dela Cruz”.** The dashboard shows attendance, missed activities, deadlines, and announcements.
2. Open **Class Calendar** and click a red (absent) date. The day expands into **“Activities You Missed”**: lessons discussed, class activities, assignments and assessments, and announcements. Set each item to *Not Started / In Progress / Completed*.
3. Sign out and **sign in as the teacher**. On **Class Calendar**, pick a date, then **Add record** (e.g. an assignment with a deadline). Edit or delete it, and the student calendar follows.
4. Open **QR Scanner / Session**, then **Start session**:
   - *Display session QR*: students scan it from **QR Check-in** in their account.
   - *Scan student IDs*: scan the QR on a student's **Profile** page (or a printed copy) with the camera, an uploaded photo, or the labeled *Simulated scan* option.
   - Duplicate scans, expired codes, wrong code types, and non-attendance QR codes are rejected with clear messages.
   - **Close session** to mark every student who did not scan as absent. Their calendars then show that day's activities as missed.
5. Open the student and teacher views in **two tabs of the same browser** to watch check-ins and new records appear live.
6. **Reset demo data** (on the teacher dashboard or the student profile) to restore a fresh sample dataset dated around today.

## Features

| Area | What works |
| --- | --- |
| Interactive calendar | Month grid with previous/next/today and keyboard navigation (arrows, PgUp/PgDn, Home); today highlighted; color- and icon-coded markers for lessons, class activities, assignments, quizzes, exams, performance tasks, announcements, and events; deadline markers; attendance badges; category filter; selected date kept in the URL (`?date=`) for deep links |
| Day details | Animated expansion into four groups: lessons (subject, topic, description, notes, materials), class activities (group/individual/seatwork/lab/practical), assignments and assessments (instructions, deadlines, materials), and events and announcements (including schedule changes). Absent days are wrapped in a highlighted **“Activities You Missed”** section. |
| Student dashboard | Profile, days present/absent, attendance %, recent records, this-week strip, upcoming deadlines, announcements, missed-activity summary |
| Missed-learning tracking | Finds absences, then pulls the activities recorded on those dates, grouped per day. Overdue and due-soon items are flagged under “Needs attention”. Progress is tracked per student and survives refreshes. |
| QR attendance | Session QR generation and rotation, camera scanning (jsQR), photo-upload decoding, manual code entry, labeled simulation; present/late via a grace period; duplicate prevention per student per session; auto-absent on close |
| Teacher tools | Attendance management per session with status overrides (e.g. excused); add/edit/delete classroom records with validation; assignments and announcements views; student records and individual history |
| UX | Responsive layout (sidebar on desktop; drawer and bottom tab bar on mobile); loading, empty, and error states; confirmation dialogs; toasts; accessible labels and focus handling |

## Architecture

**Stack:** Vite + React 19 + TypeScript + React Router (HashRouter, so no server routing is needed), plain CSS with design tokens, `qrcode` (generation), `jsqr` (decoding), and `lucide-react` (icons). It was chosen because the repository was empty, a static single-page app can be hosted for free for the research demo, and its typed components keep the code maintainable.

```
src/
  data/
    types.ts        Domain model (sections, students, teachers, sessions, records, activities, progress)
    db.ts           Repository: every write op + role checks + QR scan validation (pure functions)
    selectors.ts    Read queries: attendance summaries, missed days/items, deadlines, upcoming
    store.tsx       localStorage persistence, cross-tab sync, React context
    seed.ts         Labeled SAMPLE dataset generated relative to today
    db.test.ts      Unit tests (Vitest)
  auth/             Demo account picker + role-based route guards
  components/
    calendar/       MonthCalendar, DayDetail, CalendarView
    activities/     ActivityCard (expandable), ActivityForm, useActivityEditor
    qr/             QrImage, QrScanner (camera / upload / manual / simulated)
    attendance/     ScanResultPanel, AttendanceHistory
    layout/, ui/    App shell and shared primitives
  pages/student/, pages/teacher/
```

The connection between attendance and activities is one query: `missedDays()` takes the student's `absent`/`excused` records and looks up the activities whose `date` matches. Teacher edits change the same `activities` list, so the calendar, missed list, and dashboards all update at once.

QR payloads: `BSHS-ATT:S:<sessionId>:<token>` (session, shown by the teacher) and `BSHS-ATT:ID:<studentId>` (student ID card).

## Limitations (what is simulated)

- **No backend or shared database.** Records live in one browser's `localStorage`, and a student's phone and a teacher's laptop do **not** share data. Tabs in the same browser do sync.
- **No real authentication.** Sign-in is a sample-account picker. Role checks run in `db.ts`, but anyone with browser developer tools can change local data. **Do not use with real student information.**
- **QR tokens are not cryptographically signed.** “New code” rotates a random token, but validation happens on the client.
- **“Simulated scan”** buttons (clearly labeled) send a code through the same validation as a camera scan, for testing without a camera.
- **Learning materials** are names and optional links; file upload needs storage on a server.
- Assignment completion is **self-reported** by students.

## Backend integration (next step)

`src/data/db.ts` already has the shape of an API: each function takes `(db, actor, input)` and returns `{ ok, value } | { ok: false, error, code }`. To go to production:

1. Implement the same operations as server endpoints (e.g. Node/Express or Laravel with PostgreSQL/MySQL, or Firebase/Supabase with row-level security). Example endpoints: `POST /sessions`, `POST /sessions/:id/close`, `POST /scans`, `PUT /records/:id`, `CRUD /activities`, `PUT /progress/:activityId`.
2. Enforce the role checks from `db.ts` on the server, behind real sign-in (school-issued accounts), with HTTPS and audit logs for attendance edits.
3. Sign session QR tokens on the server (HMAC with a short expiry), and add a unique constraint on `(session_id, student_id)` so duplicates are rejected by the database.
4. Replace `store.tsx`'s `run()` with API calls (optimistic updates or refetch). The pages and components can stay unchanged.
5. Follow the Data Privacy Act of 2012 (RA 10173): collect only necessary data, obtain consent, and restrict access to advisers and authorized staff.
