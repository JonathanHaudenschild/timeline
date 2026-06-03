# Timeline

Next.js app for project timelines. Each project is addressed by the URL hash, for example `/#launch-plan`, and stored in Postgres.

## Features

- Hash-addressed projects with name, share hash, start date, and end date.
- Postgres-backed project persistence through Next.js API routes.
- Canvas timeline with view mode pan/zoom and edit mode click-to-create modal.
- Edit mode is protected by a project-level PIN. The first switch to edit mode creates the PIN; later switches require it.
- Projects can also have a view PIN. When configured, the API returns a locked response until the PIN is supplied.
- Time-aware event placement inside each day.
- Events include date, optional end date, time, what, who, type, and note.
- Markdown important-info header.
- Todo board with custom draggable status columns, markdown body, due dates, and optional subtle timeline markers.
- Docker-ready Next.js standalone build.

## Local Development

```bash
npm install
npm run dev
```

For local app development without Docker, run a Postgres database and set `DATABASE_URL`.

```bash
export DATABASE_URL=postgres://timeline:timeline@localhost:5433/timeline
```

Open `http://localhost:3000` for `npm run dev`.

## Verify

```bash
npm test
npm run lint
npm run build
```

## Local Docker Test

```bash
docker compose up --build
```

This starts both Postgres and the app. Open `http://localhost:3002`.

pgAdmin is also available at `http://localhost:5050` by default.

- Login: `admin@example.com` / `admin`
- The `Timeline Postgres` server is pre-registered with host `postgres`, port `5432`, database `timeline`, user `timeline`.
- If pgAdmin asks for the database password, use `timeline` unless you changed `POSTGRES_PASSWORD`.

## VPS Deployment With Traefik

Set the host and run the Traefik compose file on a server where the external `traefik` network already exists.

```bash
export TIMELINE_HOST=timeline.example.com
export POSTGRES_PASSWORD=change-this-long-random-password
export TRAEFIK_CERT_RESOLVER=letsencrypt
docker compose -f docker-compose.traefik.yml up -d --build
```

The app persists project data in the `timeline_postgres` Docker volume. Back that volume up before server migrations.
