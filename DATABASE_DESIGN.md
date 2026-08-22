# BloodConnect — Database Design & Full-Stack Connection

---

## How the Three Layers Connect

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND  (React + Vite)               │
│   Deployed on Vercel — https://blood-connect-rho-ten.vercel.app
│                                                         │
│   What it does:                                         │
│   - Renders UI in the browser (no server rendering)     │
│   - Makes HTTP requests to the backend API              │
│   - Reads/writes data only through the API — it NEVER   │
│     touches MongoDB directly                            │
│                                                         │
│   Key file: client/src/api/axios.js                     │
│   const api = axios.create({                            │
│     baseURL: import.meta.env.VITE_API_URL || "/api"     │
│   });                                                   │
│   Every API call goes through this single axios instance│
└─────────────────────┬───────────────────────────────────┘
                      │  HTTP (JSON over REST)
                      │  Authorization: Bearer <JWT token>
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND  (Node.js + Express)           │
│   Deployed on Render — https://blood-connect-x46x.onrender.com
│                                                         │
│   What it does:                                         │
│   - Receives HTTP requests from the frontend            │
│   - Validates JWT token (checks the user is who they    │
│     say they are)                                       │
│   - Checks role (patient/donor/admin — middleware)      │
│   - Runs business logic (matching, verification, etc.)  │
│   - Reads/writes to MongoDB via Mongoose                │
│   - Sends JSON response back to frontend                │
│                                                         │
│   Entry point: server/server.js                         │
│   Connection: server/config/db.js → mongoose.connect()  │
└─────────────────────┬───────────────────────────────────┘
                      │  Mongoose ODM (over TCP)
                      │  MONGO_URI = mongodb+srv://...atlas
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  DATABASE  (MongoDB Atlas M0)           │
│   Cloud hosted — bloodconnect cluster, Singapore region │
│                                                         │
│   What it does:                                         │
│   - Stores all persistent data in 6 collections         │
│   - Runs geospatial queries ($geoNear) natively         │
│   - Enforces unique constraints and indexes             │
│   - Never accessed directly by the frontend             │
└─────────────────────────────────────────────────────────┘
```

---

## How MongoDB Was Created

- **Tool used: MongoDB Atlas (cloud GUI)** — not Compass, not shell
- Steps:
  1. Created a free M0 cluster named `bloodconnect` on cloud.mongodb.com
  2. Atlas gave a connection string: `mongodb+srv://bloodconnect-app:<password>@bloodconnect.rkc6uuj.mongodb.net/`
  3. That string is stored as `MONGO_URI` in Render's environment variables
  4. At server startup, `db.js` calls `mongoose.connect(process.env.MONGO_URI)`
- **Collections were never created manually.** Mongoose auto-creates a collection the first time a document is saved to it.
- Network Access is set to `0.0.0.0/0` (allow all IPs) because Render's free tier uses dynamic IP addresses.

---

## The 6 Collections — What Each Stores

### 1. `users` — Identity for everyone

```
Field           Type        Notes
─────────────────────────────────────────────────────────
_id             ObjectId    auto-generated primary key
name            String      required
email           String      unique, lowercase — login key
password        String      bcrypt hash, select:false (never returned by default)
phone           String
googleId        String      sparse index — only for Google OAuth users
role            String      enum: "donor" | "patient" | "admin"
isVerified      Boolean     default false
otp.code        String      select:false — for email OTP if added
createdAt       Date        auto (timestamps:true)
updatedAt       Date        auto (timestamps:true)
```

**Indexes:**
- `email` — unique B-tree index (fast login lookup)
- `googleId` — sparse B-tree index (only indexes docs that have it)

**Why separate from Donor/Patient?**
Every user has login info. But not every user has blood-group or location. Splitting avoids half-empty documents and lets us index donor fields without bloating the users table.

---

### 2. `donors` — Donor-specific data

```
Field                   Type        Notes
─────────────────────────────────────────────────────────
_id                     ObjectId    auto-generated
userId                  ObjectId    ref: User — 1-to-1 link
bloodGroup              String      enum: A+/A-/B+/B-/O+/O-/AB+/AB-
isAvailable             Boolean     default true — donor can toggle
lastDonationDate        Date        used to enforce 90-day cooldown
location.type           String      always "Point" (GeoJSON spec)
location.coordinates    [Number]    [longitude, latitude] — stored in this order!
hospitalOrBank          String      where donor is registered
address / city / state  String      address fields
medicalStatus           String      enum: unsubmitted|pending|cleared|rejected
medicalDeclaration      Object      hemoglobin, weight, recentIllness, medications...
medicalReviewHospitalId ObjectId    ref: Hospital — which hospital reviewed
medicalVerifiedBy       ObjectId    ref: User (admin who cleared)
medicalVerifiedAt       Date
medicalRejectionReason  String
```

**Indexes:**
- `location: "2dsphere"` — spatial index for $geoNear geo-matching queries
- `{ bloodGroup: 1, isAvailable: 1 }` — compound B-tree for fast pre-filtering

**Key design decision:** `location.coordinates` is `[longitude, latitude]` — NOT `[lat, lng]`. MongoDB/GeoJSON requires longitude first. This trips up many developers.

---

### 3. `patients` — Patient-specific data

```
Field        Type        Notes
──────────────────────────────────────
_id          ObjectId    auto
userId       ObjectId    ref: User — 1-to-1, unique
age          Number
gender       String      enum: male|female|other
defaultCity  String      pre-fills city in blood request form
```

**Why so small?** Patient data is minimal — most of what matters for a patient is in their blood requests, not their profile.

---

### 4. `requests` — A blood request created by a patient

```
Field           Type        Notes
─────────────────────────────────────────────────────────
_id             ObjectId    auto
patientId       ObjectId    ref: Patient — who made the request
bloodGroup      String      what blood type is needed
unitsNeeded     Number      default 1
urgency         String      enum: low|medium|high|critical
hospitalId      ObjectId    ref: Hospital — REQUIRED (anti-fraud)
hospitalName    String      denormalized copy for display speed
description     String      optional notes
location        GeoJSON     [lng, lat] of the hospital
status          String      pending_verification|open|matched|fulfilled|expired|cancelled
expiresAt       Date        optional TTL for the request
```

**Indexes:**
- `location: "2dsphere"` — so donors can search for nearby open requests
- `{ status: 1, bloodGroup: 1 }` — fast filtering in matching service

**Key design decision:** `hospitalId` is required. Without it, anyone could type a fake hospital name to lure donors. A request tied to an unverified hospital gets status `pending_verification` and is never shown to any donor until admin approves the hospital.

---

### 5. `matches` — One donor ↔ request pairing

```
Field           Type        Notes
──────────────────────────────────────────────────────
_id             ObjectId    auto
requestId       ObjectId    ref: Request
donorId         ObjectId    ref: Donor
distanceKm      Number      distance at time of matching (km)
notifiedAt      Date        when donor was first notified
donorResponse   String      enum: pending|accepted|declined|withdrawn
respondedAt     Date        when donor clicked accept/decline/withdraw
```

**Indexes:**
- `{ requestId: 1, donorId: 1 }` — **unique compound index** (prevents duplicate matches)

**Key design decision:** Upsert writes (`findOneAndUpdate` with `upsert:true`) + this unique index = running the matching algorithm twice never creates duplicate records. Safe to re-run any number of times.

**The `withdrawn` status:** When a donor withdraws after accepting, status flips to `withdrawn` and the system automatically runs a new geo-search for backup donors. This is the fix for the gating bug — re-match now checks `Match.exists({ requestId, donorResponse: "accepted" })` instead of trusting the request's status field.

---

### 6. `hospitals` — Verified hospital registry

```
Field               Type        Notes
─────────────────────────────────────────────────────────
_id                 ObjectId    auto
name                String      required
registrationCode    String      unique, sparse — "BH-XXXXXXXX" format, issued on verification
address/city/state  String
contactPhone        String
location            GeoJSON     [lng, lat] — for nearest-hospital lookup
status              String      enum: pending|verified|rejected
submittedBy         ObjectId    ref: User (patient who submitted)
verifiedBy          ObjectId    ref: User (admin who approved)
verifiedAt          Date
rejectionReason     String
isCityVerifier      Boolean     only 1 per city — this hospital reviews donor medical forms
```

**Indexes:**
- `location: "2dsphere"` — find nearest hospital for assigning medical reviewer
- `{ name: "text", city: "text" }` — text index for the hospital search picker

---

## Entity Relationship Diagram

```
┌──────────┐         ┌──────────┐
│   User   │ 1 ───→ 1│  Donor   │
│  (login) │         │ (blood,  │
│          │         │  GPS,    │
│          │ 1 ───→ 1│  medical)│
│          │         └──────────┘
│          │                │ donorId (many)
│          │                ▼
│          │         ┌──────────┐
│          │         │  Match   │◄──── requestId
│          │         │(pairing) │           │
│          │         └──────────┘           │
│          │                                │
│          │ 1 ───→ 1 ┌──────────┐          │
│          │          │ Patient  │ 1 ──→ many
│          │          │(age/city)│ ┌──────────┐
└──────────┘          └──────────┘ │ Request  │
                                   │(blood    │
                                   │ needed)  │
                                   │     │    │
                                   └─────┼────┘
                                         │ hospitalId
                                         ▼
                                   ┌──────────┐
                                   │ Hospital │
                                   │(verified │
                                   │ registry)│
                                   └──────────┘
```

---

## How a Single Request Flows Through All Three Layers

**Example: Patient creates a blood request**

```
FRONTEND
  PatientDashboard.jsx
    → user fills form, selects hospital from search picker
    → calls api.post("/requests", { bloodGroup, hospitalId, urgency, ... })
    → axios adds JWT token in Authorization header automatically

        │  POST /api/requests
        │  Authorization: Bearer eyJhbGci...
        ▼

BACKEND
  server.js → /api/requests → request.routes.js
    → auth middleware: verifies JWT, attaches req.user
    → role middleware: confirms req.user.role === "patient"
    → request.controller.js → createRequest()
        → fetches Hospital by hospitalId
        → if hospital.status !== "verified": set status = "pending_verification", skip matching
        → if hospital.status === "verified": save request, call findAndRecordMatches()
        → matching.service.js runs $geoNear on donors collection
        → Match documents written to MongoDB
        → returns { success: true, request, matchesFound }

        │  200 OK  { success: true, request: {...}, matchesFound: 3 }
        ▼

FRONTEND
  PatientDashboard.jsx
    → receives response
    → updates local state with new request
    → shows "3 donors notified" banner
```

---

## All Indexes — One-Glance Reference

| Collection  | Index                              | Type           | Purpose                                      |
|-------------|------------------------------------|----------------|----------------------------------------------|
| users       | `email`                            | Unique B-tree  | Fast login lookup, prevents duplicate emails |
| users       | `googleId`                         | Sparse B-tree  | Google OAuth lookup (skips null docs)         |
| donors      | `location`                         | 2dsphere       | $geoNear geo-matching queries                |
| donors      | `{ bloodGroup, isAvailable }`      | Compound B-tree| Pre-filter before distance calculation       |
| requests    | `location`                         | 2dsphere       | Donor can search nearby open requests        |
| requests    | `{ status, bloodGroup }`           | Compound B-tree| Fast status+blood-group filter in matching   |
| matches     | `{ requestId, donorId }`           | Unique compound| Prevents duplicate match records             |
| hospitals   | `location`                         | 2dsphere       | Find nearest hospital for city-verifier      |
| hospitals   | `{ name, city }` (text)            | Text index     | Hospital search picker (regex search)        |
| hospitals   | `registrationCode`                 | Unique sparse  | Code lookup, skips unverified hospitals      |

---

## What Mongoose Does (the glue between backend and MongoDB)

Mongoose is a Node.js library (ODM — Object Document Mapper). It sits between Express and MongoDB and does four things:

1. **Schema enforcement** — defines what fields a document must/can have and their types. MongoDB itself is schema-less; Mongoose adds the rules at the application layer.

2. **Auto-creates collections** — the first time you save a `new Donor({...})`, Mongoose creates the `donors` collection automatically if it doesn't exist.

3. **Model methods** — e.g., `User.comparePassword()` is a custom method defined on the schema that runs bcrypt comparison. Keeps the logic close to the data.

4. **Populate (virtual joins)** — `Match.find().populate("donorId")` replaces the raw ObjectId with the full Donor document. MongoDB has no native JOIN; populate does it with a second query under the hood.

---

## Interview One-Liners

**"How does the frontend talk to the backend?"**
> "React makes HTTP requests via axios to the Express API. Every request carries a JWT in the Authorization header. The server verifies the token, checks the role, runs the logic, and returns JSON. The frontend never touches MongoDB directly."

**"How does the backend talk to MongoDB?"**
> "Through Mongoose, an ODM library. I define schemas in model files — Mongoose handles the connection, enforces types, and translates JavaScript objects into MongoDB documents and back."

**"Why 6 collections instead of just one users table?"**
> "I split shared identity (User) from role-specific data (Donor, Patient) so each collection stays clean and I can put a 2dsphere spatial index on donors without wasting it on the users table. Mixing them would mean half the fields are empty for every document."

**"How do you prevent duplicate matches?"**
> "Unique compound index on {requestId, donorId} in the matches collection plus upsert writes — update if it exists, insert if it doesn't. Running the matching algorithm twice is always safe."

**"Where is MongoDB hosted and how did you create it?"**
> "MongoDB Atlas, the managed cloud service. I created a free M0 cluster on the Atlas dashboard — no terminal or Compass needed. I pasted the connection string into Render's environment variables as MONGO_URI. Collections were never manually created; Mongoose auto-creates them on first write."
