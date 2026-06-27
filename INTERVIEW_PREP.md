# BloodConnect — Backend & Database Interview Prep

Based on the actual implementation in `server/`. Each question includes a project-specific
answer you can give, referencing real files/decisions you made.

---

## 1. Project Walkthrough Questions

### Q: Walk me through your project architecture.
**A:** It's a MERN-stack app. React frontend talks to an Express REST API
(`server/server.js`), which connects to MongoDB via Mongoose. Auth uses Passport.js
(local strategy for login, JWT strategy for protecting routes). There are 5 collections:
`users`, `donors`, `patients`, `requests`, `matches`. The core feature is geo-based
donor-patient matching using MongoDB's `$geoNear` aggregation with `2dsphere` indexes.

### Q: Why did you separate User, Donor, and Patient into different collections instead of one?
**A:** `users` holds shared identity (name, email, password hash, role). `donors` and
`patients` hold role-specific data. This avoids a huge collection with mostly-null fields,
keeps the schema clean (donor has `bloodGroup`/`location`/`hospitalOrBank`; patient has
`age`/`gender`), and lets me index donor-specific fields (`2dsphere`, `bloodGroup`)
without bloating the users collection. The tradeoff is an extra lookup/join
(`$lookup`/`populate`) when I need combined data — acceptable since reads on donors
already need the geo index anyway.

### Q: Why MongoDB over a relational DB (e.g. PostgreSQL/MySQL) for this project?
**A:** Two reasons: (1) native **geospatial queries** — `2dsphere` index + `$geoNear`
let me find nearest donors in one aggregation without PostGIS setup; (2) the schema is
naturally document-shaped — a donor record (location, blood group, availability,
hospital) maps cleanly to one document, and there's no need for complex multi-table joins
for the core read path (donor search). If I needed strong relational guarantees (e.g.
financial transactions across donors/requests), I'd lean Postgres + PostGIS instead.

---

## 2. Authentication & Security (Passport + JWT)

### Q: Explain your authentication flow.
**A:**
1. `POST /api/auth/register` — creates a `User` doc; password is hashed via a Mongoose
   `pre("save")` hook using `bcrypt.hash(password, 10)`. Depending on `role`, it also
   creates a `Donor` or `Patient` profile document.
2. `POST /api/auth/login` — uses Passport's **local strategy**
   (`config/passport.js`): looks up user by email (`select("+password")` since password
   has `select: false`), compares with `bcrypt.compare`, and on success issues a JWT via
   `generateToken()`.
3. Protected routes use `protect` middleware = `passport.authenticate("jwt", {session:false})`.
   The **JWT strategy** extracts the bearer token, verifies signature with `JWT_SECRET`,
   decodes `{id, role}`, and loads the user from DB into `req.user`.

### Q: Why `select: false` on the password field?
**A:** So that `User.find()` / `findById()` never accidentally returns the password hash
in API responses. I explicitly opt in with `.select("+password")` only in the login
controller where I need to compare it.

### Q: Why JWT instead of sessions?
**A:** Stateless — no server-side session store needed, scales horizontally easily, and
works cleanly for a SPA frontend calling a separate API. Token carries `id` and `role`,
so authorization checks don't need a DB hit for the role (though I do reload the user in
the JWT strategy to make sure they still exist / aren't deleted).

### Q: How do you handle role-based access control (RBAC)?
**A:** `middleware/auth.js` exports `authorize(...roles)` — a middleware factory that
checks `req.user.role` against allowed roles and returns 403 if it doesn't match. E.g.
`router.post("/", authorize("patient"), createRequest)` — only patients can create
requests; `authorize("donor")` guards `respondToMatch` and availability updates.

### Q: What security issues did you consider / what would you add for production?
**A:**
- Passwords hashed with bcrypt (cost factor 10) — never stored/returned in plaintext.
- `.env` for secrets (`JWT_SECRET`, `MONGO_URI`), `.gitignore`'d.
- Would add: rate limiting on `/login` and `/register` (brute-force protection),
  input validation/sanitization with `express-validator` (already installed but not
  yet wired everywhere), HTTPS termination, refresh tokens (currently single
  long-lived JWT, 7d expiry), helmet for security headers.

---

## 3. MongoDB / Mongoose Schema Questions

### Q: How is geolocation stored and indexed?
**A:** Both `Donor.location` and `Request.location` use **GeoJSON Point** format:
```js
location: {
  type: { type: String, enum: ["Point"], default: "Point" },
  coordinates: [Number] // [longitude, latitude] — note: lng FIRST, not lat
}
```
Each schema has `schema.index({ location: "2dsphere" })`. This is what enables
`$geoNear` and `$near` queries.

### Q: Walk me through your geo-matching query (`matching.service.js`).
**A:**
```js
Donor.aggregate([
  { $geoNear: {
      near: request.location,
      distanceField: "distanceMeters",
      maxDistance: radiusKm * 1000,   // meters
      spherical: true,
      query: { bloodGroup: request.bloodGroup, isAvailable: true }
  }},
  { $limit: 20 }
])
```
- `$geoNear` **must be the first stage** in the pipeline.
- It requires a `2dsphere` index on the queried field.
- `spherical: true` means distances are computed on a sphere (real-world Earth
  distances), not a flat plane.
- The `query` filter inside `$geoNear` pre-filters by blood group + availability so we
  don't waste distance calculations on irrelevant donors.
- Results are written into the `matches` collection via `findOneAndUpdate` with
  `upsert: true` so re-running matching for the same request doesn't create duplicates
  (enforced by the compound unique index `{requestId, donorId}`).

### Q: Why `$geoNear` instead of `$near`/`$nearSphere` in `find()`?
**A:** `$geoNear` is an aggregation stage that (a) returns a `distanceField` I can store
(`distanceKm`) and sort by, and (b) lets me chain further stages like `$lookup` (to join
user info) and `$project`. `find().near()` can't easily give me the computed distance or
do joins in one round trip.

### Q: Explain the `donors` collection compound index `{ bloodGroup: 1, isAvailable: 1 }`.
**A:** Most donor queries filter by blood group + availability (e.g. "all available O+
donors"). A compound index on these two fields lets MongoDB satisfy that filter via
index scan instead of a collection scan, before/alongside the geo filter.

### Q: How do you prevent duplicate matches for the same request/donor pair?
**A:** `Match` schema has `matchSchema.index({ requestId: 1, donorId: 1 }, { unique: true })`.
Combined with `findOneAndUpdate(..., { upsert: true })` in the matching service, this
makes recording matches idempotent.

### Q: What's the difference between `$lookup` and Mongoose `populate()`? Where did you use each?
**A:** `populate()` is a Mongoose convenience that runs a separate query and stitches
results client-side (used in `getDonorById`, `getRequestById` for matches → donor →
user). `$lookup` is a native aggregation-pipeline join, used in `getDonors` because
that whole donor search is already an aggregation pipeline (`$geoNear` → `$lookup` →
`$unwind` → `$project`) — mixing `populate()` into an aggregate result isn't possible
since aggregation bypasses the Mongoose query layer.

### Q: Why store `hospitalOrBank` instead of donor's home address?
**A:** Trust/privacy design decision from the project plan — donors register a
hospital/blood-bank location rather than a home address, so patients see a public,
verifiable meeting point rather than a personal address.

### Q: How would you handle a donor changing their location?
**A:** `PATCH /api/donors/me` accepts `coordinates` and rebuilds the `location` GeoJSON
object (`{ type: "Point", coordinates }`). Because the field is indexed, MongoDB
automatically updates the `2dsphere` index on write — no manual reindexing needed.

---

## 4. API Design Questions

### Q: Describe your request-creation flow end to end.
**A:** `POST /api/requests` (patient-only via `authorize("patient")`):
1. Look up the patient's profile by `req.user._id`.
2. Validate required fields (`bloodGroup`, `hospitalName`, `coordinates`).
3. Create a `Request` document with status `"open"`.
4. Call `findAndRecordMatches(request, radiusKm)` — runs the `$geoNear` aggregation,
   upserts `Match` docs.
5. If matches found, flip request status to `"matched"` and save.
6. Return the request + `matchesFound` count.

### Q: How does a donor respond to a match?
**A:** `POST /api/requests/:id/respond` (donor-only). Looks up the donor's profile,
finds the `Match` doc by `{requestId, donorId}`, updates `donorResponse` to
`"accepted"`/`"declined"` and sets `respondedAt`.

### Q: How is error handling centralized?
**A:** `middleware/errorHandler.js` is registered last with Express's 4-arg error
signature `(err, req, res, next)`. Every controller wraps logic in try/catch and calls
`next(err)` on failure; the handler logs the stack and responds with
`{success:false, message}` and `err.statusCode || 500`.

### Q: Why did you put role-restriction (`router.use(protect, authorize(...))`) at the
router level for `patient.routes.js` but per-route in `request.routes.js`?
**A:** All patient routes need the same restriction (every action is patient-only), so
applying `protect`+`authorize("patient")` once via `router.use()` is cleaner. In
`request.routes.js`, different routes need different roles (`createRequest`/
`getMyRequests` → patient, `respondToMatch` → donor, `getRequestById` → either), so
`protect` is global but `authorize` is applied per-route.

### Q: Any route-ordering gotchas you ran into?
**A:** Yes — in `donor.routes.js`, `/me/availability`, `/me`, and `/requests/nearby`
must be declared **before** `/:id`, otherwise Express would match `"me"` or `"requests"`
as an `:id` param and route to `getDonorById` instead.

---

## 5. Data Modeling / Schema Design Trade-offs

### Q: How would this schema scale to thousands of donors? Any concerns with `$geoNear`?
**A:** `$geoNear` with a `2dsphere` index scales well (logarithmic-ish lookup vs. full
scan) but it can only use one geo index per query and must be the first pipeline stage,
limiting how it composes with other heavy aggregations. For very high write volume
(frequent donor location updates), I'd consider capping how often `isAvailable`/location
updates trigger re-indexing, and possibly cache "available donors per city" in Redis.

### Q: How do you handle request expiry (`expiresAt`)?
**A:** Currently stored as a field; for production I'd add a MongoDB **TTL index**
(`expireAfterSeconds`) on `expiresAt`, or a scheduled job that flips `status` to
`"expired"` for requests past their expiry — TTL index would actually delete the doc,
so a scheduled status-update job is more appropriate here since we want to keep history.

### Q: Why `unitsNeeded` default 1 and `min: 1`?
**A:** Domain constraint — a request always needs at least one unit; Mongoose schema
validation rejects invalid values at the model layer before they hit the DB.

---

## 6. General Backend Concepts (likely generic follow-ups)

- **Middleware order**: `cors` → `express.json()` → `morgan` → `passport.initialize()`
  → routes → 404 handler → error handler. Order matters — error handler must be last.
- **Environment config**: `dotenv` loads `.env` (`MONGO_URI`, `JWT_SECRET`,
  `JWT_EXPIRES`, `CLIENT_ORIGIN`, `PORT`) — keeps secrets out of source control.
- **CORS**: configured with `origin: process.env.CLIENT_ORIGIN` to only allow the React
  dev server.
- **Mongoose connection**: `connectDB()` in `config/db.js`, called once at startup;
  exits process on failure (`process.exit(1)`) since the app can't function without DB.
- **Idempotency**: matching uses `upsert` to avoid duplicate matches if triggered twice.
- **Timestamps**: every schema uses `{ timestamps: true }` for automatic
  `createdAt`/`updatedAt`.

---

## 7. Google OAuth Implementation

### Q: How did you implement Google OAuth?
**A:** Used `passport-google-oauth20` strategy with `passReqToCallback: true`. The
strategy receives the Google profile and runs a **find-or-create** pattern:

```js
let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
if (user) {
  if (!user.googleId) { user.googleId = profile.id; await user.save(); }
  return done(null, { user, isNew: false });
}
user = await User.create({ name: profile.displayName, email, googleId: profile.id, role: "patient" });
await Patient.create({ userId: user._id });
return done(null, { user, isNew: true });
```

- Looks up by `googleId` OR `email` — so if a user registered with email/password and
  then signs in with Google using the same email, we **link the accounts** (attach the
  `googleId`) rather than creating a duplicate.
- First-time Google users automatically get a `patient` role and an empty Patient profile.

### Q: Why `sparse: true` on the `googleId` index?
**A:** A unique index on `googleId` would fail when multiple documents have `googleId: null`
(all email/password users). A **sparse index** only indexes documents where the field exists,
so null values are excluded — allowing unlimited email/password users while still
enforcing uniqueness across Google-linked accounts.

### Q: How is the JWT handed off after OAuth?
**A:** Google's callback goes to `GET /api/auth/google/callback`. The `googleCallback`
controller generates a JWT and redirects the browser to:
```
http://localhost:5173/oauth/callback?token=JWT&name=...&role=...&isNew=...
```
The React `OAuthCallback.jsx` reads the query params, calls `loginWithToken()` on
`AuthContext` (saves token to localStorage, sets user state), then navigates to
`/admin` or `/dashboard` based on role.

### Q: What happens if a Google-only user tries to log in with email/password?
**A:** The Passport local strategy checks `if (!user.password)` and returns a clear
message: *"This account uses Google sign-in. Please use 'Continue with Google'."*
This prevents confusing "Invalid credentials" errors.

---

## 8. Admin Dashboard & Aggregation Stats

### Q: How do the stats cards work?
**A:** `GET /api/admin/stats` runs **three parallel aggregations** with `Promise.all`:
```js
const [usersByRole, requestsByStatus, donorsByBloodGroup] = await Promise.all([
  User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  Request.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  Donor.aggregate([{ $group: { _id: "$bloodGroup", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
]);
```
The frontend derives "Total Donors", "Total Patients", "Open Requests", "Fulfilled" by
looking up the relevant `_id` in each result array. Running all three in parallel keeps
the endpoint fast (one network round-trip, three concurrent DB ops).

### Q: How does cascade delete work?
**A:** `DELETE /api/admin/users/:id` checks the user's role, then:
- **Donor**: deletes `Donor` profile + all `Match` records where `donorId` matches
- **Patient**: deletes `Patient` profile + all `Request` docs + all `Match` docs for those requests
- Finally deletes the `User` doc itself
This prevents orphaned documents and referential inconsistency without relying on
MongoDB transactions (which would require a replica set).

### Q: What is the admin Re-run Matching for?
**A:** When a request was created and initially found zero donors (or only donors who
declined), the patient or admin can trigger `POST /api/admin/requests/:id/rematch`.
It validates the request is still `"open"`, then calls the same `findAndRecordMatches`
service used during request creation — with a wider 30 km radius. This is useful when
new donors register after the request was posted.

---

## 9. Donor Dashboard — New Features

### Q: How does the "Already Responded" badge work?
**A:** On dashboard load, `GET /donors/me/responses` returns all the donor's `Match`
records. The frontend builds a `{ requestId → donorResponse }` map from this list.
When rendering the Nearby Requests tab, each request card checks this map — if a match
exists for that `requestId`, it shows the badge and hides the Accept/Decline buttons.
No extra DB query per card; it's all derived from the single response-history fetch.

### Q: How does Edit Profile re-geocode the location?
**A:** The Edit Profile form collects hospital/bank name + address + city + state, joins
them with commas, calls `geocodeAddress()` (Nominatim, India-scoped), and gets back
`{coordinates, displayName}`. The `PATCH /api/donors/me` handler receives `coordinates`
and rebuilds the GeoJSON: `location: { type: "Point", coordinates }`. MongoDB
automatically updates the `2dsphere` index on write.

---

## 10. Patient Dashboard — New Features

### Q: How does the Re-match button work?
**A:** `POST /api/requests/:id/rematch` (patient-only). The controller:
1. Verifies the request belongs to this patient (`patientId` check)
2. Confirms status is `"open"` (fulfilled/cancelled requests can't be re-matched)
3. Calls `findAndRecordMatches(request, radiusKm)` — same service as request creation
4. Returns `{ newMatchesFound }` count

The frontend shows the count in a success toast. Useful when the first match radius was
too small or all initial donors declined.

### Q: How does the status filter work on the frontend?
**A:** `GET /requests/me` fetches all requests once. The status filter pills
(All / Open / Matched / Fulfilled / Cancelled) are client-side — they just filter
the already-loaded `requests` array by `r.status`. No extra API calls on tab switch,
which keeps it snappy.

---

## 11. Possible "What would you improve?" Answers

- Add `express-validator` validation chains on all POST/PATCH bodies (currently manual checks).
- Add refresh tokens / token blacklist for logout.
- Add pagination to `GET /api/donors` and `GET /api/requests/me`.
- Add notification service (SMS/email/push) — stubbed in plan, not yet implemented.
- Add OTP verification on registration.
- Move from local MongoDB to Atlas with proper connection pooling for production.
- Add unit/integration tests (Jest + Supertest + mongodb-memory-server).
- Use MongoDB transactions for cascade delete (currently sequential async ops — a crash
  mid-delete could leave orphaned documents; transactions + replica set would make it atomic).
- Add a Redis cache for `GET /admin/stats` (recomputed from scratch on every request;
  fine for low traffic, but would benefit from a short TTL cache under load).
