# Timeline App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functioning local-first Next.js timeline app with hash-addressed projects, editable canvas timeline events, markdown project info, markdown todos, and Docker deployment.

**Architecture:** The app is a client-side App Router application backed by `localStorage` using the URL hash as the project key. Timeline rendering uses a canvas component with shared date/coordinate utilities tested separately. Deployment uses Next.js standalone output in Docker.

**Tech Stack:** Next.js, React, TypeScript, Vitest, ESLint, CSS modules/global CSS, Docker, Docker Compose, Traefik labels.

---

### Task 1: Scaffold App and Test Harness

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [x] Write a smoke test target into `package.json` scripts: `test`, `lint`, `build`, and `dev`.
- [x] Configure Next.js standalone output for Docker.
- [x] Create the base App Router files.

### Task 2: Domain Model and Timeline Math

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/timeline.ts`
- Create: `src/lib/project.ts`
- Create: `src/lib/storage.ts`
- Create: `src/lib/timeline.test.ts`
- Create: `src/lib/project.test.ts`

- [x] Write failing Vitest coverage for hash normalization, default project creation, day-to-pixel mapping, pixel-to-day mapping, and event span checks.
- [x] Implement the domain model and helpers.
- [x] Run tests and keep them green.

### Task 3: Timeline Application UI

**Files:**
- Create: `src/components/TimelineApp.tsx`
- Create: `src/components/TimelineCanvas.tsx`
- Create: `src/components/EventEditor.tsx`
- Create: `src/components/EventList.tsx`
- Create: `src/components/ProjectHeader.tsx`
- Create: `src/components/MarkdownBlock.tsx`
- Create: `src/components/TodoBoard.tsx`

- [x] Implement project header editing, view/edit mode, important info markdown editing, canvas timeline, event editor, event list, and todo board.
- [x] Keep todos creatable in view mode.
- [x] Render todos on the timeline only when the overlay is enabled.

### Task 4: Styling and Usability

**Files:**
- Modify: `src/app/globals.css`

- [x] Apply a minimal, dense, work-focused UI.
- [x] Ensure controls fit on mobile and desktop.
- [x] Avoid decorative card nesting and keep the timeline prominent.

### Task 5: Deployment

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yml`
- Create: `docker-compose.traefik.yml`
- Create: `README.md`

- [x] Add standalone Dockerfile.
- [x] Add local compose testing.
- [x] Add Traefik compose labels with configurable host.
- [x] Document local dev, local Docker, and VPS deployment.

### Task 6: Verification

**Files:**
- All created files.

- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start the dev server and provide the local URL.
