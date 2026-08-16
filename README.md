# Binance Wallet Admin Site

This project keeps the uploaded wallet HTML as the main page design and connects it to a real backend, PostgreSQL database, and secure admin dashboard.

## What it includes

- Main page served from the original uploaded HTML template
- Dynamic wallet overview values loaded from `GET /api/settings`
- Dynamic recent transactions loaded from `GET /api/transactions`
- Secure admin login at `/admin`
- Admin editing for:
  - Estimated total value
  - Estimated total currency
  - Estimated total USD value
  - Assets section title/button label
  - Recent transactions title/button label
  - Asset rows and all displayed asset values
  - Recent transactions with add/edit/delete/reorder/enable-disable
- PostgreSQL as the source of truth
- Password hashing with `bcryptjs`
- JWT auth stored in an HTTP-only cookie

## Project structure

- `server.js`: Express app, API routes, auth, and DB bootstrap
- `public/index.template.html`: copied original uploaded HTML page
- `public/main.js`: minimal runtime script that injects live data into the existing UI
- `public/admin/index.html`: admin page
- `public/admin/app.js`: admin dashboard logic
- `public/admin/styles.css`: admin dashboard styles
- `.env.example`: required environment variables
- `render.yaml`: Render blueprint for web service + PostgreSQL

## Environment variables

Copy `.env.example` to `.env` and update the values.

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_PASSWORD`

Recommended:

- `ADMIN_USERNAME`
- `DATABASE_SSL`
- `NODE_ENV`

## Local run

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_PASSWORD`.
4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm start
```

6. Open:
   - Main page: `http://localhost:3000/`
   - Admin page: `http://localhost:3000/admin`

## Database setup

No separate migration command is required. On startup the server automatically:

- creates `admin_users`
- creates `site_settings`
- creates `assets`
- creates `transactions`
- inserts the initial wallet settings row
- seeds the original asset rows found in the uploaded HTML
- creates the first admin user from `ADMIN_USERNAME` and `ADMIN_PASSWORD` if no admin user exists yet

## API endpoints

Public:

- `GET /api/settings`
- `GET /api/transactions`

Admin auth:

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`

Admin content:

- `GET /api/admin/dashboard`
- `PUT /api/admin/settings`
- `GET /api/admin/assets`
- `POST /api/admin/assets`
- `PUT /api/admin/assets/:id`
- `PUT /api/admin/assets/reorder`
- `DELETE /api/admin/assets/:id`
- `GET /api/admin/transactions`
- `POST /api/admin/transactions`
- `PUT /api/admin/transactions/:id`
- `PUT /api/admin/transactions/reorder`
- `DELETE /api/admin/transactions/:id`
- `PUT /api/admin/account/password`

## Render deployment

### Option 1: Blueprint

1. Push this project to GitHub.
2. In Render, create a new Blueprint instance.
3. Select the repository.
4. Render will read `render.yaml`.
5. Set the missing `ADMIN_PASSWORD` value in the Render dashboard.

### Option 2: Manual

1. Create a PostgreSQL database in Render.
2. Create a Node web service.
3. Use:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=<render postgres connection string>`
   - `DATABASE_SSL=true`
   - `JWT_SECRET=<random long secret>`
   - `ADMIN_USERNAME=admin`
   - `ADMIN_PASSWORD=<strong password>`

## How the design is preserved

- The original uploaded HTML is copied into `public/index.template.html`.
- The server serves that file as the main page.
- `public/main.js` is appended after the original markup and only updates the dynamic data nodes.
- Existing layout, styles, colors, fonts, spacing, and core structure remain untouched.

## Live update behavior

The main page refreshes live content from the API on load and then polls every 15 seconds. After an admin saves changes, the public page updates automatically on the next refresh cycle.
