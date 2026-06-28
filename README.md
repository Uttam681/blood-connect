# 🩸 BloodConnect

**BloodConnect** is a community-driven, location-based **Blood/Plasma Donor Finder**
web application. It connects patients in urgent need of blood with verified, nearby,
available donors — using real-time geolocation matching, a searchable donor map, and
role-based dashboards for donors, patients, and admins.

Built as a full **MERN-stack** application: MongoDB, Express, React, Node.js — with
**Passport.js (JWT + Google OAuth)** authentication, **Leaflet/OpenStreetMap** for maps,
a verified **Hospital registry** to prevent fraudulent requests, donor **medical
clearance review**, and a full **Admin dashboard** for platform management.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Key Features](#key-features)
- [Platform Flow](#platform-flow)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design (MongoDB)](#database-design-mongodb)
- [API Reference](#api-reference)
- [Geo-Matching Logic](#geo-matching-logic)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Default Admin Account](#default-admin-account)
- [Application Walkthrough](#application-walkthrough)
- [Roadmap / Stretch Goals](#roadmap--stretch-goals)
- [Interview Prep](#interview-prep)

---

## Problem Statement

Patients often face delays finding suitable blood/plasma donors during emergencies.
Existing methods — social media posts, phone calls, manual searching — are slow and
unreliable. **BloodConnect** solves this by letting:

- **Donors** register their blood group, availability, and a trusted location
  (hospital/blood bank — never a home address).
- **Patients** search for donors by blood group and location, or raise an urgent
  request — tied to a **verified hospital**, not free text — that automatically finds
  and notifies nearby compatible donors.
- **Admins** manage all users, donor availability, hospital verification, donor medical
  clearance, and requests from a central dashboard.

A platform like this is also an easy vector for **blood trafficking or fraudulent
requests** if requests aren't tied to a real, verifiable location, and for **patient
risk** if a donor backs out at the last minute with no fallback. BloodConnect addresses
both directly — see the Trust & Safety features below.

---

## Key Features

### For Donors
- Register with blood group, hospital/blood bank location (auto-geocoded from address)
- Toggle availability (`Available` / `Not Available`) directly from the dashboard header
- **Nearby Requests tab** — view blood requests within 25 km, filtered by urgency (All / Critical / High / Medium / Low)
- "Already Responded" badge on requests already acted on; Accept / Decline buttons for new ones
- **Withdraw a previously accepted match** if you can no longer donate — immediately triggers a backup search so the patient isn't left stranded
- **My Responses tab** — full response history: each match with your response badge, request status badge, distance, and response date
- **Edit Profile tab** — update blood group, hospital/bank, address, city, state, pincode, last donation date (re-geocodes location on save)
- **90-day donation cooldown** automatically enforced server-side — you won't be matched again until it clears, with the eligible-again date shown on your dashboard
- **Medical Declaration** — submit hemoglobin, weight, recent illness, medications, and notes for admin/hospital review; rejected donors are automatically excluded from matching (final clearance always still happens in person at the blood bank)

### For Patients
- Register with email/password **or sign in with Google** (one click, creates patient account automatically)
- Profile details: age, gender, default city — editable any time via collapsible Edit Profile section
- Search donors by blood group + location, in **list** or **interactive map** view
- Raise an urgent blood request (blood group, units needed, urgency level) tied to a **verified hospital** picked from a live search — no more free-typing a hospital name
- Can't find your hospital? Submit it for admin verification — the request stays queued and invisible to donors until the hospital clears review
- Automatically matched with nearby, eligible, available donors via geospatial query
- **Status filter tabs** on My Requests: All / Pending Verification / Open / Matched / Fulfilled / Cancelled
- **Re-match button** — re-runs geo matching with a wider radius whenever there's no *confirmed* donor yet (works even after a donor candidate was found but never accepted, or backed out)
- Track request status (`pending_verification` → `open` → `matched` → `fulfilled` / `cancelled`)
- View matched donor details with distance, contact, response status, and "View on Map"

### For Admins
- Dedicated **Admin Dashboard** with stats cards, blood-group breakdown, and 5 tabs
- **Stats row**: Total Donors, Total Patients, Open Requests, Fulfilled, Pending Hospitals, Pending Medical Reviews — all from live aggregation
- **Blood Group breakdown** — donor count per blood group across the platform
- **Search bar** in every tab (name, email, blood group, hospital — client-side instant filter)
- **Users tab**: all users with role dropdown (change inline), Verified/Unverified toggle, join date, delete
- **Donors tab**: blood group badge, hospital, city, medical status, availability toggle
- **Requests tab**: patient name+email, blood group, urgency badge, status badge, **Re-run Matching** button
- **Hospitals tab**: approve/reject submitted hospitals (assigns a unique registration code on approval, auto-activates any requests that were waiting on it), designate one hospital per city as the **medical verifier**
- **Medical Reviews tab**: review donor health declarations (hemoglobin, weight, illness, medications, notes) and Clear/Reject — rejected donors stop appearing in matching immediately
- Delete any user and cascade-delete all their associated data (profile + requests + matches)

### Trust & Safety
- **Hospital verification registry** — every blood request must be tied to a hospital/blood bank that's either already verified or submitted for one-time admin review, closing the most direct path for fraudulent or trafficking-related requests
- **Backup donor safety net** — withdrawing from an accepted match auto-searches for a replacement donor instead of silently leaving the patient stuck; re-match is only blocked once a donor has actually *confirmed*, not merely been found nearby
- **Donor medical clearance pipeline** — self-declared health checks reviewed by admin (on behalf of a designated city hospital), plus an automatic 90-day post-donation cooldown enforced at the matching-query level, not just the UI

### Platform
- JWT-based authentication with role-based access control (donor / patient / admin)
- **Google OAuth 2.0** sign-in / sign-up (one click, no password needed)
- Passwords hashed with bcrypt
- MongoDB `2dsphere` geospatial indexes for fast "donors near me" queries
- Leaflet + OpenStreetMap for maps (no API key required)
- Free geocoding via OpenStreetMap Nominatim (India-scoped, with city disambiguation)

---

## Platform Flow

> What each role can do — from registration to final action.

```mermaid
flowchart TD
    A([🌐 BloodConnect]) --> B{New user?}
    B -->|Yes| C[Register Page]
    B -->|No| D[Login Page]
    D --> G1[Google OAuth\nContinue with Google]
    C --> G1

    G1 -->|First time| AUTO[Auto-created as Patient]
    AUTO --> PD

    C --> ROLE{Choose Role}
    D --> LOGIN[Email + Password Login]
    LOGIN --> ROLE

    ROLE -->|Donor| DR[Fill Donor Profile\nBlood Group · Hospital · City]
    ROLE -->|Patient| PR[Fill Patient Profile\nAge · Gender · City]

    DR --> DD
    PR --> PD

    %% ─── DONOR FLOW ───────────────────────────────────────────
    subgraph DONOR [" 🩺  Donor "]
        DD([Donor Dashboard])
        DD --> DA[Toggle Availability\nAvailable / Unavailable]
        DD --> TAB1[Nearby Requests Tab\nUrgency filter: All·Critical·High·Medium·Low]
        TAB1 --> RESP{Respond}
        RESP -->|Accept| ACC[✅ Accepted\ndistance + contact shown to patient]
        RESP -->|Decline| DEC[❌ Declined]
        RESP -->|Already responded| BADGE[Already Responded badge]
        ACC --> WD{Can still donate?}
        WD -->|No| WITHDRAW[Withdraw\nauto-finds backup donor]
        WD -->|Yes| DONE[Donation completed]
        DD --> TAB2[My Responses Tab\nHistory: response + request status + date]
        DD --> TAB3[Edit Profile Tab\nBlood group · hospital · city · last donation]
        TAB3 --> COOLDOWN{Last donation\n< 90 days ago?}
        COOLDOWN -->|Yes| EXCLUDED[Excluded from matching\nuntil cooldown clears]
        COOLDOWN -->|No| ELIGIBLE[Eligible for matching]
        TAB3 --> MEDFORM[Medical Declaration\nHb · weight · illness · meds · notes]
        MEDFORM --> MEDREVIEW{Admin / City\nHospital Review}
        MEDREVIEW -->|Cleared| ELIGIBLE
        MEDREVIEW -->|Rejected| EXCLUDED
    end

    %% ─── PATIENT FLOW ──────────────────────────────────────────
    subgraph PATIENT [" 🏥  Patient "]
        PD([Patient Dashboard])
        PD --> EP[Edit Profile\nAge · Gender · Default City]
        PD --> HSEARCH[Search Verified Hospitals\nby name or city]
        HSEARCH -->|Found| HPICK[Pick Hospital\nshows registration code]
        HSEARCH -->|Not found| HSUB[Submit New Hospital\nfor admin verification]
        HSUB --> HPENDING[Request created as\nPending Verification]
        HPICK --> RF[Raise Blood Request\nBlood Group · Units · Urgency]
        RF --> MATCH{Geo-Match\n$geoNear within radius\nexcludes cooldown/rejected donors}
        MATCH -->|Donor found| MS[Status: Matched\nView donors · distance · contact]
        MATCH -->|No donor| OS[Status: Open]
        HPENDING -.->|hospital verified| MATCH
        OS --> RM[Re-match button\nworks until a donor confirms]
        MS -->|donor withdraws| OS
        RM --> MATCH
        MS --> ACT{Update Request}
        ACT --> FUL[Mark Fulfilled]
        ACT --> CAN[Cancel]
        PD --> SF[Status Filter\nincl. Pending Verification]
        PD --> SD[Search Donors\nBlood Group + Location]
        SD --> LM{View Mode}
        LM --> LIST[📋 List View\nCards with distance]
        LM --> MAP[🗺️ Map View\nLeaflet pins]
        LIST --> DET[Donor Details Page\nContact · Map Pin]
        MAP --> DET
    end

    %% ─── ADMIN FLOW ────────────────────────────────────────────
    subgraph ADMIN [" 🔐  Admin "]
        AD([Admin Dashboard])
        AD --> STATS[Stats Cards\nDonors · Patients · Open · Fulfilled · Pending Hospitals · Pending Medical]
        AD --> BG[Blood Group Breakdown\nDonor count per group]
        AD --> SRCH[Search Bar\nFilter any tab by name·email·blood group]
        AD --> UT[Users Tab]
        UT --> CR[Change Role\ndonor / patient / admin]
        UT --> VER[Toggle Verified\nVerified / Unverified]
        UT --> DEL[Delete User\nCascades: profile + requests + matches]
        AD --> DT[Donors Tab]
        DT --> TOG[Toggle Availability\nOverride donor status]
        AD --> RT[Requests Tab]
        RT --> RRM[Re-run Matching\nworks until a donor confirms]
        AD --> HT[Hospitals Tab]
        HT --> HAPP[Approve\nissues registration code · activates pending requests]
        HT --> HREJ[Reject\ncancels pending requests, with reason]
        HT --> HCV[Set as City Medical Verifier\none per city]
        AD --> MT[Medical Reviews Tab]
        MT --> MCLEAR[Clear\ndonor eligible for matching]
        MT --> MREJ[Reject\ndonor excluded from matching]
    end

    LOGIN -->|role = admin| AD

    style DONOR fill:#fff0f0,stroke:#e53e3e,color:#000
    style PATIENT fill:#f0f7ff,stroke:#3182ce,color:#000
    style ADMIN fill:#f0fff4,stroke:#38a169,color:#000
    style G1 fill:#4285F4,color:#fff,stroke:#4285F4
```

---

## Tech Stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Frontend     | React 19 (Vite), React Router, Tailwind CSS v4, Leaflet/react-leaflet |
| Backend      | Node.js, Express 5                                                |
| Database     | MongoDB + Mongoose (geospatial `2dsphere` indexes)                |
| Auth         | Passport.js (Local + JWT + Google OAuth 2.0), bcrypt, jsonwebtoken |
| Maps/Geocode | Leaflet, OpenStreetMap tiles, Nominatim geocoding API (free)      |

---

## Project Structure

```
BloodConnect/
├── client/                         # React frontend (Vite)
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js            # Axios instance with JWT interceptor
│   │   │   └── endpoints.js        # All API call wrappers (auth, donors, patients, requests, admin)
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Role-aware nav (Admin link for admins)
│   │   │   ├── MapView.jsx         # Leaflet map component
│   │   │   └── ProtectedRoute.jsx  # JWT guard + role guard
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Auth state: login / register / loginWithToken / logout
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx           # Email/password + Google OAuth button
│   │   │   ├── Register.jsx        # Role selector + Google OAuth button (patient)
│   │   │   ├── OAuthCallback.jsx   # Handles ?token= redirect after Google auth
│   │   │   ├── Dashboard.jsx       # Routes to Donor/Patient/Admin dashboard by role
│   │   │   ├── AdminDashboard.jsx  # Stats · search · Users/Donors/Requests/Hospitals/Medical Reviews tabs
│   │   │   ├── DonorDashboard.jsx  # Nearby Requests · My Responses (+ Withdraw) · Edit Profile (+ Medical Declaration)
│   │   │   ├── PatientDashboard.jsx# Edit Profile · Hospital picker · My Requests (status filter + re-match)
│   │   │   ├── DonorList.jsx       # Search donors (list/map)
│   │   │   ├── DonorDetails.jsx    # Donor profile + map pin
│   │   │   └── RequestDetails.jsx  # Request + matched donors
│   │   └── utils/
│   │       └── geocode.js          # Address → {coordinates, displayName} via Nominatim (India-scoped)
│   └── vite.config.js              # Tailwind plugin + /api proxy to backend
│
├── server/                         # Express REST API
│   ├── config/
│   │   ├── db.js                   # MongoDB connection
│   │   └── passport.js             # Local + JWT + Google OAuth strategies
│   ├── models/
│   │   ├── User.js                 # googleId field + optional password/phone for OAuth users
│   │   ├── Donor.js                 # + medicalStatus/medicalDeclaration/medicalReviewHospitalId
│   │   ├── Patient.js
│   │   ├── Request.js               # + hospitalId ref · "pending_verification" status
│   │   ├── Match.js                 # donorResponse: pending|accepted|declined|withdrawn
│   │   └── Hospital.js              # registry: status, registrationCode, isCityVerifier
│   ├── controllers/
│   │   ├── auth.controller.js      # register · login · getMe · googleCallback
│   │   ├── admin.controller.js     # getStats · CRUD · hospital verify/reject/cityVerifier · medical reviews
│   │   ├── donor.controller.js     # getMyProfile · getMyResponses · updateMyProfile · submitMedicalDeclaration
│   │   ├── hospital.controller.js  # searchHospitals (verified only) · submitHospital (patient)
│   │   ├── patient.controller.js
│   │   └── request.controller.js   # createRequest · rematchRequest · respondToMatch · withdrawMatch
│   ├── routes/
│   │   ├── auth.routes.js          # /register · /login · /me · /google · /google/callback
│   │   ├── admin.routes.js         # All routes protected: protect + authorize("admin")
│   │   ├── donor.routes.js         # /me · /me/responses · /me/availability · /me/medical · /requests/nearby
│   │   ├── hospital.routes.js      # GET / (search) · POST / (submit, patient only)
│   │   ├── patient.routes.js
│   │   └── request.routes.js       # POST /:id/rematch · /:id/respond · /:id/withdraw
│   ├── middleware/
│   │   ├── auth.js                 # protect (JWT) + authorize (RBAC)
│   │   └── errorHandler.js
│   ├── services/
│   │   └── matching.service.js     # $geoNear donor matching
│   ├── utils/
│   │   └── generateToken.js
│   └── server.js                   # App entrypoint
│
├── RUNNING_LOCALLY.md              # Step-by-step VS Code setup guide
├── INTERVIEW_PREP.md               # Backend/DB interview Q&A for this project
└── README.md
```

---

## Database Design (MongoDB)

Six collections, connected via `userId` / `patientId` / `donorId` / `requestId` /
`hospitalId` references:

### `users`
Shared identity for all roles.
```js
{
  _id, name, email (unique), password (hashed, select:false, optional for Google users),
  phone (optional for Google users), googleId (sparse index),
  role: "donor" | "patient" | "admin",
  isVerified, otp: { code, expiresAt },
  createdAt, updatedAt
}
```

### `donors`
```js
{
  _id, userId (ref User, unique),
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
  isAvailable: Boolean,
  lastDonationDate,
  location: { type: "Point", coordinates: [lng, lat] },  // 2dsphere indexed
  hospitalOrBank, address, city, state, pincode,
  medicalStatus: "unsubmitted" | "pending" | "cleared" | "rejected",
  medicalDeclaration: { hemoglobin, weight, recentIllness, illnessDetails, medications, reportNotes, submittedAt },
  medicalReviewHospitalId (ref Hospital), medicalVerifiedBy (ref User), medicalVerifiedAt, medicalRejectionReason
}
```
Indexes: `{ location: "2dsphere" }`, `{ bloodGroup: 1, isAvailable: 1 }`

### `patients`
```js
{
  _id, userId (ref User, unique),
  age, gender, defaultCity
}
```

### `hospitals`
```js
{
  _id, name, registrationCode (unique, assigned on verification, e.g. "BH-A1B2C3D4"),
  address, city, state, pincode, contactPhone,
  location: { type: "Point", coordinates: [lng, lat] },  // 2dsphere indexed
  status: "pending" | "verified" | "rejected",
  isCityVerifier: Boolean,  // at most one true per city — the designated medical reviewer
  submittedBy (ref User), verifiedBy (ref User), verifiedAt, rejectionReason
}
```
Indexes: `{ location: "2dsphere" }`, text index on `{ name, city }`

### `requests`
```js
{
  _id, patientId (ref Patient), hospitalId (ref Hospital),
  bloodGroup, unitsNeeded, urgency: "low"|"medium"|"high"|"critical",
  hospitalName, description,
  location: { type: "Point", coordinates: [lng, lat] },  // 2dsphere indexed, copied from hospital
  status: "pending_verification" | "open" | "matched" | "fulfilled" | "expired" | "cancelled",
  expiresAt
}
```
Indexes: `{ location: "2dsphere" }`, `{ status: 1, bloodGroup: 1 }`

### `matches`
```js
{
  _id, requestId (ref Request), donorId (ref Donor),
  distanceKm, notifiedAt,
  donorResponse: "pending" | "accepted" | "declined" | "withdrawn",
  respondedAt
}
```
Index: unique compound `{ requestId: 1, donorId: 1 }` — prevents duplicate matches.

---

## API Reference

Base URL: `/api`

### Auth (`/api/auth`)
| Method | Endpoint              | Auth | Description |
|--------|-----------------------|------|-------------|
| POST   | `/register`           | —    | Register as donor or patient |
| POST   | `/login`              | —    | Login with email + password, returns JWT |
| GET    | `/me`                 | JWT  | Get current user |
| GET    | `/google`             | —    | Redirect to Google OAuth consent screen |
| GET    | `/google/callback`    | —    | Google OAuth callback → redirects to frontend with JWT |

### Donors (`/api/donors`)
| Method | Endpoint                  | Auth          | Description |
|--------|---------------------------|---------------|-------------|
| GET    | `/`                       | —             | Search/filter donors: `?bloodGroup=O+&lat=&lng=&radiusKm=&available=true` |
| GET    | `/:id`                    | —             | Donor details |
| PATCH  | `/me/availability`        | JWT (donor)   | Toggle `isAvailable` |
| PATCH  | `/me`                     | JWT (donor)   | Update donor profile/location |
| PATCH  | `/me/medical`             | JWT (donor)   | Submit health declaration for admin/hospital review |
| GET    | `/me`                     | JWT (donor)   | Own donor profile |
| GET    | `/me/responses`           | JWT (donor)   | Response history (all matches for this donor) |
| GET    | `/requests/nearby`        | JWT (donor)   | Blood requests near this donor |

### Hospitals (`/api/hospitals`)
| Method | Endpoint | Auth           | Description |
|--------|----------|----------------|-------------|
| GET    | `/`      | JWT            | Search verified hospitals: `?search=name-or-city` |
| POST   | `/`      | JWT (patient)  | Submit a new hospital for admin verification |

### Patients (`/api/patients`)
| Method | Endpoint | Auth           | Description |
|--------|----------|----------------|-------------|
| GET    | `/me`    | JWT (patient)  | Get own profile |
| PATCH  | `/me`    | JWT (patient)  | Update profile (age, gender, city) |

### Requests (`/api/requests`)
| Method | Endpoint            | Auth          | Description |
|--------|---------------------|---------------|-------------|
| POST   | `/`                 | JWT (patient) | Create a blood request against a hospitalId → triggers geo-matching if verified, else queues as `pending_verification` |
| GET    | `/me`               | JWT (patient) | List own requests |
| GET    | `/:id`              | JWT           | Request details + matched donors |
| PATCH  | `/:id/status`       | JWT (patient) | Update status (`fulfilled`/`cancelled`) |
| POST   | `/:id/respond`      | JWT (donor)   | Accept/decline a match |
| POST   | `/:id/withdraw`     | JWT (donor)   | Back out of an accepted match → auto re-matches for a backup donor |
| POST   | `/:id/rematch`      | JWT (patient) | Re-run geo matching — allowed any time there's no *confirmed* donor yet |

### Admin (`/api/admin`) — JWT + admin role required
| Method | Endpoint                          | Description |
|--------|-----------------------------------|-------------|
| GET    | `/stats`                          | Live aggregation: users by role, requests by status, donors by blood group, pending hospitals, pending medical reviews |
| GET    | `/users`                          | List all users |
| GET    | `/donors`                         | List all donor profiles |
| GET    | `/donors/medical-reviews`         | List donor medical declarations: `?status=pending\|cleared\|rejected\|all` |
| GET    | `/patients`                       | List all patient profiles |
| GET    | `/requests`                       | List all blood requests |
| GET    | `/hospitals`                      | List all hospitals (any status) |
| PATCH  | `/users/:id/role`                 | Change a user's role |
| PATCH  | `/users/:id/verify`               | Toggle user's `isVerified` flag |
| PATCH  | `/donors/:id/availability`        | Toggle donor availability |
| PATCH  | `/donors/:id/medical-review`      | Clear or reject a donor's medical declaration (`{decision, reason}`) |
| PATCH  | `/hospitals/:id/verify`           | Approve a hospital — issues a registration code, activates any requests waiting on it |
| PATCH  | `/hospitals/:id/reject`           | Reject a hospital (`{reason}`) — cancels any requests waiting on it |
| PATCH  | `/hospitals/:id/city-verifier`    | Toggle this hospital as the city's designated medical verifier (unsets any sibling in the same city) |
| POST   | `/requests/:id/rematch`           | Re-run geo matching — allowed any time there's no confirmed donor (30 km radius) |
| DELETE | `/users/:id`                      | Delete user + cascade all associated data |

---

## Geo-Matching Logic

When a patient creates a request (against a **verified** hospital), `services/matching.service.js` runs:

```js
const cooldownCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

Donor.aggregate([
  { $geoNear: {
      near: request.location,
      distanceField: "distanceMeters",
      maxDistance: radiusKm * 1000,
      spherical: true,
      query: {
        bloodGroup: request.bloodGroup,
        isAvailable: true,
        medicalStatus: { $ne: "rejected" },
        $or: [
          { lastDonationDate: { $exists: false } },
          { lastDonationDate: null },
          { lastDonationDate: { $lte: cooldownCutoff } },
        ],
      },
  }},
  { $limit: 20 }
]);
```

Matching donors are upserted into the `matches` collection (idempotent via the unique
`{requestId, donorId}` index), and the request status flips to `matched` if any donors
are found.

**Eligibility filters baked into the query, not just the UI:**
- Donors inside the **90-day post-donation cooldown** are excluded automatically — this
  is enforced at the database query level, so it can't be bypassed by any client.
- Donors whose **medical declaration was rejected** by admin/hospital review are excluded
  the same way.

**Re-match vs. confirmed donor:** a request's status flips to `matched` the moment
*any* donor is found nearby — before anyone has actually accepted. Re-match (by patient
or admin) is only blocked once a donor has truly **confirmed** (`donorResponse: "accepted"`
on a `Match` doc) — checked via `Match.exists({ requestId, donorResponse: "accepted" })` —
not merely when the status says "matched". This is what lets a patient recover when a
candidate donor never responds, or withdraws.

**Hospital verification gate:** requests against an unverified hospital are created with
status `pending_verification` and **never enter this matching pipeline** until an admin
approves the hospital — at which point `findAndRecordMatches` runs automatically for any
requests that were waiting on it.

**Geocoding disambiguation:** when a patient submits a *new* hospital for verification
(rather than picking an already-verified one), the frontend automatically appends their
`defaultCity` before geocoding (`"Apollo Hospital, Hyderabad"`) and shows the resolved
full address for confirmation — preventing wrong-city matches.

---

## Getting Started

> See [RUNNING_LOCALLY.md](RUNNING_LOCALLY.md) for the full step-by-step VS Code guide.

### Prerequisites
- Node.js v18+
- MongoDB running locally (`brew services start mongodb-community`) or a MongoDB Atlas URI

### 1. Backend
```bash
cd server
npm install
npm run dev      # http://localhost:5000
```

### 2. Frontend
```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:5000`
(see `client/vite.config.js`), so no CORS configuration is needed in development.

---

## Environment Variables

`server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/bloodconnect
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173

# Google OAuth — get these from console.cloud.google.com
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

**Setting up Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:5000/api/auth/google/callback` to **Authorized redirect URIs**
4. Copy the Client ID and Secret into `server/.env`

> ⚠️ `.env` is gitignored — never commit real secrets.

---

## Default Admin Account

A seed admin account is included for local development:

| Field    | Value                      |
|----------|----------------------------|
| Email    | `admin@bloodconnect.app`   |
| Password | `admin@123`                |
| Role     | `admin`                    |

To create it in your local MongoDB:
```bash
cd server
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('./models/User');
  const hash = await bcrypt.hash('admin@123', 10);
  await User.collection.insertOne({
    name: 'Admin', email: 'admin@bloodconnect.app',
    password: hash, phone: '0000000000',
    role: 'admin', isVerified: true,
    createdAt: new Date(), updatedAt: new Date()
  });
  console.log('Admin created');
  await mongoose.disconnect();
})();
"
```

---

## Application Walkthrough

1. **Register** as a Donor (blood group + hospital address — auto-geocoded) or as a
   Patient (age, gender, city) — or click **Continue with Google** for a one-click
   patient account.
2. **Donors** land on a three-tab dashboard:
   - **Nearby Requests** — filter by urgency, see "Already Responded" badge, accept or decline
   - **My Responses** — full history of every match with response badge and request status; **Withdraw** if you accepted but can no longer donate (auto-triggers a backup search)
   - **Edit Profile** — update blood group, location, last donation date, and submit a **Medical Declaration** for review
3. **Patients** land on their dashboard:
   - **Edit Profile** (collapsible) — update age, gender, default city
   - **Raise a Blood Request** — search and pick a **verified hospital** (or submit a new one for review if it's not listed yet); backend runs `$geoNear` (excluding donors in cooldown or medically rejected) and reports match count
   - **My Requests** — filter by status (All / Pending Verification / Open / Matched / Fulfilled / Cancelled), re-match whenever there's no confirmed donor, mark fulfilled or cancel
4. From **My Requests**, patients open **Request Details** to see matched donors, their distance, contact info, and response status (pending/accepted/declined/withdrawn), plus a **"View on Map"** link.
5. Anyone (logged in or not) can use **Find Donors** to search by blood group and location, switching between card **list view** and interactive **Leaflet map**.
6. **Admins** log in to the **Admin Dashboard**:
   - Stats cards (including pending hospitals / pending medical reviews) and blood-group breakdown at the top
   - Search bar filtering any tab instantly
   - Change user roles, toggle verified status, delete users with cascade
   - Toggle donor availability, re-run matching on requests without a confirmed donor
   - **Approve/reject submitted hospitals**, designate one **city medical verifier** hospital per city
   - **Clear or reject donor medical declarations** — rejected donors stop appearing in matching immediately

---

## Roadmap / Stretch Goals

- [ ] OTP verification on registration (Twilio Verify)
- [ ] SMS / Email notifications to matched donors (Twilio + Nodemailer)
- [ ] Push notifications (Firebase)
- [x] Admin role + moderation dashboard
- [x] Admin stats cards + blood group breakdown
- [x] Admin search, verified toggle, re-run matching
- [x] Google OAuth sign-in / sign-up
- [x] Donor — urgency filter, already-responded badge, response history tab, edit profile tab
- [x] Patient — status filter, re-match button, edit profile section
- [x] Hospital verification registry — anti-fraud/trafficking gate on every request
- [x] Backup donor safety net — withdraw action + confirmed-donor-aware re-match gating
- [x] Donor medical clearance — health declaration review + 90-day cooldown enforcement
- [ ] Request expiry automation (scheduled job / TTL handling)
- [ ] Response-deadline auto-skip-to-next-donor (currently manual re-match only)
- [ ] ABO/Rh compatibility matrix instead of exact blood-group match
- [ ] Pagination on donor/request lists
- [ ] Automated tests (Jest + Supertest + mongodb-memory-server)

---

## Interview Prep

See [INTERVIEW_PREP.md](INTERVIEW_PREP.md) for a detailed Q&A covering backend
architecture, Passport/JWT authentication, MongoDB schema design, geospatial
queries (`$geoNear`, `2dsphere`), and API design decisions — all tied directly to
this codebase.

---

## Author

**Saikiran Maruri** ([@marurisaikiran](https://github.com/marurisaikiran))
