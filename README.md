# PH Healthcare System — Backend

REST API for a doctor-appointment platform where patients book online consultations, doctors run them, and admins keep the platform running. Patients register, verify their email with an OTP, book a 20-minute slot on a doctor's published schedule, pay with **bKash**, and receive an invoice PDF plus their digital prescription by email. Doctors apply to join (approved by an admin), publish daily schedules, and run consultations. Admins approve doctors, manage the platform, and view analytics.

This repository contains the **backend only** (the frontend is a separate repo). The full product specification lives in [Project Requirements.md](./Project%20Requirements.md).

---

## Overview

| Attribute | Value |
| --------- | ----- |
| **Name** | PH Healthcare System Backend |
| **Type** | REST API |
| **Roles** | `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `PATIENT` |
| **Auth** | Email/OTP registration, password & Google login, JWT access/refresh tokens |
| **Payments** | bKash tokenized checkout (create, execute, refund) |
| **Base path** | `/api/v1` |

---

## Technologies Used

| Layer       | Technology                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| Language    | TypeScript                                                                  |
| Runtime     | Node.js (Express 5)                                                         |
| ORM         | Prisma 7 with PostgreSQL                                                    |
| Validation  | Zod                                                                         |
| Auth        | JSON Web Tokens (JWT), bcryptjs, Google OAuth 2.0                           |
| Cache/Store | Redis (OTPs + pending registration sessions)                                |
| Email       | Nodemailer with EJS templates                                               |
| Storage     | Cloudinary (profile pictures) / Multer (file uploads)                       |
| PDF         | PDFKit (invoices & prescriptions)                                           |
| Payments    | bKash Tokenized Checkout API                                                |
| Scheduling  | node-cron (auto-cleans unverified doctor applications)                      |
| Dates       | date-fns                                                                    |
| Tooling     | Biome (lint/format), tsx (dev runner)                                       |

---

## Key Features

**Authentication & accounts**
- Patient registration with **OTP email verification** (2-min OTP, 5-min pending session in Redis) with resend support.
- Doctor application with OTP verification (1-hour OTP) and document upload (resume, additional documents).
- Login with email/password or **Google** (`/auth/google`), access + refresh token handling, logout.
- Forgot / reset password via OTP with resend support.
- Forgot-password and resend endpoints return `expiresIn` / `expiresAt` so the frontend can run accurate countdowns — see [OTP-FLOW.md](./OTP-FLOW.md).
- Seeded accounts on startup: a Super Admin, a Tester Admin, and a Tester Doctor (from environment variables).

**Roles & permissions**
- Role-based route guards (`auth(...roles)` middleware) across `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `PATIENT`.
- Admin/Super Admin can approve or reject doctor applications.
- Soft deletes (`isDeleted` / `deletedAt`) are modelled on users and schedules.

**Doctor schedules**
- Doctors create **one schedule per date** (3–8 hours, single calendar day) with a meeting link; slots are auto-computed in **20-minute** increments.
- Schedules start as **draft** and are only visible to patients once **published**.
- Edit, publish, soft-delete, list my/all/today's schedules.

**Appointments & payments**
- Patients can only see and book **today's published schedules** before they start (with an open slot).
- **bKash Tokenized Checkout** payment flow: booking creates a pending appointment + payment, the bKash callback executes the payment and confirms it.
- On successful payment the appointment gets a **serial number**, joining time, and an **invoice PDF emailed** to the patient.
- Cancellation with automatic **refund if cancelled more than 1 hour before** the schedule start (bKash refund API).
- Doctors move appointments `CONFIRMED → ONGOING → COMPLETED`; blocked for pending appointments.
- Role-scoped appointment lists: patient's own, doctor's own, and all (admin) with filters and pagination.

**Prescriptions & emails**
- Doctors write prescriptions only for **completed** appointments; the system generates a **PDF** and emails it to the patient.
- EJS email templates: registration OTP, welcome, forgot/reset password, appointment confirmation, prescription, doctor application approved/rejected, Google sign-in linked.

**Profile & uploads**
- Profile picture upload to Cloudinary (validated image upload via Multer).
- Doctors update their own profile.

**Payments & analytics**
- Payment history for patients, admins (all payments with filters), and single-payment details.
- Analytics dashboards for patients, doctors, and admins.

**Background jobs**
- Cron job every 10 minutes that deletes unverified doctor applications older than 1 hour.

---

## Project Dependencies

Runtime dependencies (`package.json`):

```
@prisma/adapter-pg    @prisma/client       bcryptjs
cloudinary            cookie-parser        cors
date-fns              dotenv               ejs
express (v5)          google-auth-library   http-status
jsonwebtoken          multer               node-cron
nodemailer            pdfkit               pg
redis                 zod
```

Dev dependencies:

```
@biomejs/biome        @types/cookie-parser @types/cors
@types/ejs            @types/express       @types/jsonwebtoken
@types/multer         @types/node          @types/nodemailer
@types/pdfkit         @types/pg            prisma
tsx                   typescript
```

External services you need to be able to reach at runtime:

| Service      | Used for                                             |
| ------------ | ----------------------------------------------------- |
| PostgreSQL   | Primary database (Prisma)                            |
| Redis        | OTP codes & pending registration sessions            |
| SMTP (Gmail) | Transactional email                 |
| bKash API    | Payment gateway (tokenized checkout)                 |
| Cloudinary   | Profile picture uploads                              |
| Google OAuth | Google login                                         |

---

## Running the Project Locally

### Prerequisites

| Tool          | Version | Check with |
| ------------- | ------- | ---------- |
| Node.js       | 20+     | `node -v`  |
| PostgreSQL    | 14+     | `psql -V`  |
| Redis         | 6+      | `redis-cli ping` |

A Gmail account (or any SMTP server) is also required so the app can send OTP/email templates.

### Steps

**1. Install dependencies**

```bash
npm install
```

**2. Set up your environment**

```bash
cp .env.example .env
```

Open `.env` and fill in every value. At minimum `DATABASE_URL`, the JWT secrets/expirations, `BCRYPT_SALT_ROUNDS`, the Super Admin / Tester Admin / Tester Doctor credentials, Redis settings, SMTP settings, and the bKash credentials are required — the server connects to all of these on startup.

**3. Generate the Prisma client**

```bash
npx prisma generate
```

Prisma writes a typed client into `src/generated/prisma` (git-ignored). Almost every file under `src/` imports from there — skip this step and nothing compiles. Re-run whenever you change a file in `prisma/schema/`.

**4. Apply the migrations**

```bash
npx prisma migrate dev
```

**5. Start the server**

```bash
npm run dev
```

You should see:

```
Connected to the database successfully.
Redis Connected Successfully.
Nodemailer Connected Successfully.
Server is running on port 5000
```

The Super Admin, Tester Admin, and Tester Doctor are seeded automatically from your `.env` on first boot (each only if no such user exists yet).

**6. Verify it's up**

```bash
curl http://localhost:5000/
# {"success":true,"message":"Welcome to PH Healthcare Management System Backend"}
```

### Useful scripts

```bash
npm run dev          # start with auto-reload (tsx watch)
npm run build        # typecheck with tsc and emit to dist/
npm run start        # run the server once, no watching
npm run lint:check   # Biome lint on ./src
npm run lint:fix     # Biome lint + autofix
npm run format:check # Biome format check
npm run format:fix   # Biome format + write
```

Prisma CLI shortcuts (no npm wrappers exist):

```bash
npx prisma generate     # regenerate the client after schema changes
npx prisma migrate dev  # create + apply migrations
npx prisma studio       # browser GUI for your data at http://localhost:5555
```

> **Note:** `npm run build` emits to `dist/`, but the output isn't directly runnable with Node because the codebase uses extensionless relative imports. `npm run start` therefore runs the TypeScript source through `tsx` instead of `dist/`.

---

## API Overview

Base URL: `http://localhost:5000`

| Module        | Prefix            | Highlights |
| ------------- | ----------------- | ---------- |
| Auth          | `/api/v1/auth`    | `register`, `verify-email`, `resend-otp`, `login`, `google`, `me`, `refresh-token`, `forgot-password`, `resend-forgot-password-otp`, `reset-password`, `logout` |
| User          | `/api/v1/user`    | `upload-profile-picture` (multipart) |
| Doctor        | `/api/v1/doctor`  | `apply-as-doctor` (multipart), `apply-as-doctor/verify-email`, `approve-doctor`, `all-doctors`, `all-doctors-public`, `available-doctors-today`, `public/:doctorId`, `update-my-profile` |
| Schedule      | `/api/v1/schedule`| `create-schedule`, `my-schedules`, `all-schedules`, `todays-schedules`, `update-schedule/:id`, `publish-schedule/:id`, `delete-schedule/:id` |
| Appointment   | `/api/v1/appointment` | `book-appointment`, `pay-appointment`, `book-appointment/payment/callback`, `cancel-appointment`, `update-appointment-status/:id`, `my-appointments`, `doctor-appointments`, `all-appointments`, `:appointmentId` |
| Payment       | `/api/v1/payment` | `my-payments`, `all-payments`, `:paymentId` |
| Prescription  | `/api/v1/prescription` | `POST /` (doctor), `GET /:appointmentId` |
| Analytics     | `/api/v1/analytics` | `patient-analytics`, `doctor-analytics`, `admin-analytics` |

Every response from `sendResponse` uses a consistent envelope:

```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```

Authentication is required via `Authorization: Bearer <accessToken>` (or an `accessToken` cookie).

---

## Links

| Link                                   | Description |
| -------------------------------------- | ----------- |
| **Live API** (placeholder)             | `https://your-backend-deployment-url` |
| **Frontend** (placeholder)             | `https://your-frontend-url` |
| GitHub repository                      | https://github.com/mdashraful24/L02-m6-ph-healthcare-backend |
| Product specification                  | [Project Requirements.md](./Project%20Requirements.md) |
| OTP flows documentation                | [OTP-FLOW.md](./OTP-FLOW.md) |
| Postman collection                     | [PH Healthcare System.postman_collection.json](./PH%20Healthcare%20System.postman_collection.json) |

---

## Project Structure

```
src/
├── server.ts                     # boot: connect DB/Redis/SMTP, seed accounts, start cron, listen
├── app.ts                        # express app: cors, body parsing, route mounting, error handling
└── app/
    ├── config/index.ts           # reads every environment variable
    ├── lib/                      # prisma, redis, nodemailer, cloudinary, multer, bkash, googleAuth, cron
    ├── utils/                    # catchAsync, jwt, sendResponse, AppError, seed
    ├── middleware/               # checkAuth (role guard), validateRequest, globalErrorHandler, notFound
    ├── templates/                # EJS email templates
    └── module/<name>/            # one folder per feature (auth, user, doctor, schedule,
                                  # appointment, payment, prescription, analytics)

prisma/
├── schema/                       # split schema (schema, user, patient, doctor, schedule,
│                                 # appointment, payment, enums)
└── migrations/                   # generated SQL, committed to git
```

New features follow a strict pattern under `src/app/module/<name>/` with four files: `<name>.route.ts`, `<name>.controller.ts`, `<name>.service.ts`, and `<name>.interface.ts` (plus `<name>.validation.ts` where applicable). Controllers never call Prisma directly; services never touch `req`/`res`.