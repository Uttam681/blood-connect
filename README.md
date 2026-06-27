# 🩸 BloodConnect

**BloodConnect** is a community-driven, location-based **Blood/Plasma Donor Finder**
web application. It connects patients in urgent need of blood with verified, nearby,
available donors — using real-time geolocation matching, a searchable donor map, and
role-based dashboards for donors, patients, and admins.

Built as a full **MERN-stack** application: MongoDB, Express, React, Node.js — with
**Passport.js (JWT + Google OAuth)** authentication, **Leaflet/OpenStreetMap** for maps,
and a full **Admin dashboard** for platform management.

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
  request that automatically finds and notifies nearby compatible donors.
- **Admins** manage all users, donor availability, and requests from a central dashboard.

---

## Key Features

### For Donors
- Register with blood group, hospital/blood bank location (auto-geocoded from address)
- Toggle availability (`Available` / `Not Available`)
- View incoming blood requests near them, sorted by distance
- Accept or decline a match request

### For Patients
- Register with email/password **or sign in with Google** (one click)
- Register with profile details (age, gender, city)
- Search donors by blood group + location, in **list** or **interactive map** view
- Raise an urgent blood request (blood group, units needed, urgency level, hospital)
- Hospital name auto-appended with city to prevent wrong-city geocoding
- Confirm geocoded location before submitting (prevents ambiguous results)
- Automatically matched with nearby available donors via geospatial query
- Track request status (`open` → `matched` → `fulfilled` / `cancelled`)
- View matched donor details + "View on Map"

### For Admins
- Dedicated **Admin Dashboard** with 3 tabs: Users, Donors, Requests
- View all registered users with name, email, phone, role, join date
- Change any user's role inline (donor / patient / admin)
- Delete any user and cascade-delete all their associated data
- Toggle any donor's availability directly
- View all blood requests across the platform with status

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
        DD --> DN[View Nearby Requests\nFiltered by blood group + geo]
        DN --> RESP{Respond}
        RESP -->|Accept| ACC[✅ Accepted\ndistance + contact shown to patient]
        RESP -->|Decline| DEC[❌ Declined]
    end

    %% ─── PATIENT FLOW ──────────────────────────────────────────
    subgraph PATIENT [" 🏥  Patient "]
        PD([Patient Dashboard])
        PD --> RF[Raise Blood Request\nBlood Group · Units · Urgency · Hospital]
        RF --> GEO[Geocode Hospital Address\ncity auto-appended · confirm location]
        GEO --> MATCH{Geo-Match\n$geoNear within radius}
        MATCH -->|Donor found| MS[Status: Matched\nView donors · distance · contact]
        MATCH -->|No donor| OS[Status: Open\nWiden radius or wait]
        MS --> ACT{Update Request}
        ACT --> FUL[Mark Fulfilled]
        ACT --> CAN[Cancel]
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
        AD --> UT[Users Tab\nAll users · role badges]
        UT --> CR[Change Role\ndonor / patient / admin]
        UT --> DEL[Delete User\nCascades: profile + requests + matches]
        AD --> DT[Donors Tab\nBlood group · hospital · city]
        DT --> TOG[Toggle Availability\nOverride donor status]
        AD --> RT[Requests Tab\nAll requests · status · patient info]
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
│   │   │   ├── AdminDashboard.jsx  # Users · Donors · Requests tabs
│   │   │   ├── DonorDashboard.jsx  # Availability toggle + nearby requests
│   │   │   ├── PatientDashboard.jsx# Create requests + my requests
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
│   │   ├── Donor.js
│   │   ├── Patient.js
│   │   ├── Request.js
│   │   └── Match.js
│   ├── controllers/
│   │   ├── auth.controller.js      # register · login · getMe · googleCallback
│   │   ├── admin.controller.js     # CRUD for users, donors, requests (admin only)
│   │   ├── donor.controller.js
│   │   ├── patient.controller.js
│   │   └── request.controller.js
│   ├── routes/
│   │   ├── auth.routes.js          # /register · /login · /me · /google · /google/callback
│   │   ├── admin.routes.js         # All routes protected: protect + authorize("admin")
│   │   ├── donor.routes.js
│   │   ├── patient.routes.js
│   │   └── request.routes.js
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

Five collections, connected via `userId` / `patientId` / `donorId` / `requestId`
references:

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
  hospitalOrBank, address, city, state, pincode
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

### `requests`
```js
{
  _id, patientId (ref Patient),
  bloodGroup, unitsNeeded, urgency: "low"|"medium"|"high"|"critical",
  hospitalName, description,
  location: { type: "Point", coordinates: [lng, lat] },  // 2dsphere indexed
  status: "open" | "matched" | "fulfilled" | "expired" | "cancelled",
  expiresAt
}
```
Indexes: `{ location: "2dsphere" }`, `{ status: 1, bloodGroup: 1 }`

### `matches`
```js
{
  _id, requestId (ref Request), donorId (ref Donor),
  distanceKm, notifiedAt,
  donorResponse: "pending" | "accepted" | "declined",
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
| GET    | `/requests/nearby`        | JWT (donor)   | Blood requests near this donor |

### Patients (`/api/patients`)
| Method | Endpoint | Auth           | Description |
|--------|----------|----------------|-------------|
| GET    | `/me`    | JWT (patient)  | Get own profile |
| PATCH  | `/me`    | JWT (patient)  | Update profile (age, gender, city) |

### Requests (`/api/requests`)
| Method | Endpoint            | Auth          | Description |
|--------|---------------------|---------------|-------------|
| POST   | `/`                 | JWT (patient) | Create a blood request → triggers geo-matching |
| GET    | `/me`               | JWT (patient) | List own requests |
| GET    | `/:id`              | JWT           | Request details + matched donors |
| PATCH  | `/:id/status`       | JWT (patient) | Update status (`fulfilled`/`cancelled`) |
| POST   | `/:id/respond`      | JWT (donor)   | Accept/decline a match |

### Admin (`/api/admin`) — JWT + admin role required
| Method | Endpoint                       | Description |
|--------|--------------------------------|-------------|
| GET    | `/users`                       | List all users |
| GET    | `/donors`                      | List all donor profiles |
| GET    | `/patients`                    | List all patient profiles |
| GET    | `/requests`                    | List all blood requests |
| PATCH  | `/users/:id/role`              | Change a user's role |
| PATCH  | `/donors/:id/availability`     | Toggle donor availability |
| DELETE | `/users/:id`                   | Delete user + cascade all associated data |

---

## Geo-Matching Logic

When a patient creates a request, `services/matching.service.js` runs:

```js
Donor.aggregate([
  { $geoNear: {
      near: request.location,
      distanceField: "distanceMeters",
      maxDistance: radiusKm * 1000,
      spherical: true,
      query: { bloodGroup: request.bloodGroup, isAvailable: true }
  }},
  { $limit: 20 }
]);
```

Matching donors are upserted into the `matches` collection (idempotent via the unique
`{requestId, donorId}` index), and the request status flips to `matched` if any donors
are found.

**Geocoding disambiguation:** when a patient types a hospital name without a city (e.g.
`"Apollo Hospital"`), the frontend automatically appends their `defaultCity` before
geocoding (`"Apollo Hospital, Hyderabad"`) and shows the resolved full address for
confirmation — preventing wrong-city matches.

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
2. **Donors** land on their dashboard: toggle availability and view nearby blood
   requests matching their blood group, with the option to Accept / Decline.
3. **Patients** land on their dashboard: fill the "Raise a Blood Request" form
   (blood group, units, urgency, hospital name). The hospital is geocoded and the
   resolved address shown for confirmation before the request is submitted. The backend
   runs a `$geoNear` query and immediately reports how many donors matched.
4. From "My Requests", patients open **Request Details** to see matched donors, their
   distance, contact info, and a **"View on Map"** link.
5. Anyone (logged in or not) can use **Find Donors** to search by blood group and
   location, switching between card **list view** and interactive **Leaflet map**.
6. **Admins** log in to the **Admin Dashboard** to manage users (change roles, delete
   accounts), toggle donor availability, and monitor all blood requests platform-wide.

---

## Roadmap / Stretch Goals

- [ ] OTP verification on registration (Twilio Verify)
- [ ] SMS / Email notifications to matched donors (Twilio + Nodemailer)
- [ ] Push notifications (Firebase)
- [x] Admin role + moderation dashboard
- [x] Google OAuth sign-in / sign-up
- [ ] Request expiry automation (scheduled job / TTL handling)
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
