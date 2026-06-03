# Timeline App Design

## Goal

Build a deploy-ready Next.js timeline app for creating shareable-by-hash project timelines. The app should make it fast to inspect dated and timed events, create and edit events in a modal, maintain markdown project context, and track markdown-capable todos with database persistence.

## Product Shape

The first screen is the working application, not a landing page. A compact header contains the project name, hash, date range, mode toggle, todo overlay toggle, and project settings. Below it, an important-info markdown section provides project context. The main surface is a canvas-based horizontal timeline with pan and zoom in view mode and point-to-add behavior in edit mode. The bottom area contains an event table and a todo board.

## Data Model

Project data is stored in Postgres and accessed through Next.js API routes using a key derived from `location.hash`. If no hash exists, the app initializes a new project hash and writes it to the URL. Each project has `name`, `hash`, `startDate`, `endDate`, `infoMarkdown`, `events`, `todos`, and UI settings.

Events include `date`, optional `endDate`, `time`, `what`, `who`, `type`, and `note`. Single-day events render as points. Multi-day events render as spans. Todos include `title`, markdown `body`, `status`, optional `dueDate`, and optional `showOnTimeline`.

## Interaction Design

View mode prioritizes timeline navigation: wheel zooms, drag pans, and event clicks select details. Edit mode changes timeline clicks into event creation at the clicked date and time, opening a modal form seeded with the clicked moment. Todos can be created in view mode from the todo board. Todo markers on the timeline are subtle and can be toggled off.

## Architecture

Use Next.js App Router with client-side state and API routes because the app is hash-addressed but persisted centrally. Keep domain logic in `src/lib/timeline.ts`, database/API persistence in `src/lib/db.ts`, sample/default data in `src/lib/project.ts`, and UI in focused components under `src/components`. Use a native canvas for the timeline to keep panning and zooming responsive without heavy timeline dependencies.

## Deployment

The app builds as a standalone Next.js Docker image and runs with Postgres in Docker Compose. `docker-compose.yml` supports local testing with a database. `docker-compose.traefik.yml` provides labels for a Traefik reverse proxy and expects the host name to be supplied via environment variable.

## Verification

Automated tests cover timeline math, project initialization, date mapping, event span detection, and persistence key behavior. Verification requires `npm test`, `npm run lint`, and `npm run build`.
