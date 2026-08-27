# BloodConnect — Professor's Review: Exact Interview Answers

These are the 6 flaws the professor found + the correctness issue + the one thing to say unprompted.
Every answer below is word-for-word what to say if asked.

---

## FLAW 1 — Single Render Instance (No Redundancy)

**Question they'll ask:**
> "What's the single point of failure in this system?"

**Exact answer:**
"The API runs on one Render free-tier instance with no redundancy. Any crash takes it down completely, and after 15 minutes idle it spins down — so the first request after a quiet period has a 30–50 second cold start. The fix is putting a load balancer in front of 2+ Express instances with a health check, so a dead instance drops out of rotation instead of taking the whole API down. The good news is that my JWT auth already makes every instance stateless — I don't need sticky sessions or a session store migration. Horizontal scaling is purely a config change, not a redesign."

---

## FLAW 2 — Nominatim Geocoding (Synchronous, No SLA)

**Question they'll ask:**
> "Nominatim is down. What does the user actually see?"

**Exact answer:**
"Right now the geocode call is synchronous inside request creation — if Nominatim is slow or down, the patient's 'Create Request' button just hangs or errors. Two fixes: first, cache geocoded hospital addresses in Redis since hospitals don't move — on a cache hit, zero external calls needed. Second, add a timeout with a graceful error message: 'Hospital address could not be confirmed — request saved, location will be set once geocoding recovers.' The patient's request shouldn't fail because of a third-party service I don't control."

---

## FLAW 3 — Backup Retrigger Race Condition (No Queue, No Idempotency)

**Question they'll ask:**
> "Two donors withdraw from the same request simultaneously — what happens?"

**Exact answer:**
"This is a real bug today. Both withdrawals fire the matching engine synchronously and in-process, with no idempotency key. They can race and match the same backup donor twice, sending them duplicate notifications. The fix is a message queue — each withdrawal drops a job tagged with the withdrawal event's ID. If the same ID arrives twice, the worker discards the duplicate. The matching engine doesn't run twice, and the backup donor only gets notified once."

---

## FLAW 4 — Hospital Registration Codes (Static, No Expiry, Never Rotated)

**Question they'll ask:**
> "The registration-code system is simple. What's a better design, and why didn't you build it?"

**Exact answer:**
"The current design is a static string — one admin-issued code per hospital, no expiry, no single-use enforcement. The entire fraud gate rests on that string never leaking — a screenshot or a forwarded message compromises it indefinitely. A better design: hash the code at rest so a DB dump doesn't expose it, give it an expiry of say 90 days, and make it single-use or rotatable — similar to an API key rotation flow. I didn't build this because for a v1 prototype with a small admin user base, the operational complexity wasn't worth it. But I'd add code expiry before any real deployment."

---

## FLAW 5 — JWT With No Revocation

**Question they'll ask:**
> "Why JWT over sessions — what did that cost you?"

**Exact answer:**
"The benefit is statelessness — any server instance can verify any token without a shared session store, which is what makes horizontal scaling easy. The cost is revocation: if a token is stolen, I can't invalidate it immediately. I can only wait for it to expire. My tokens today are 7-day lived, which is too long for a security-sensitive app. The proper fix is short-lived access tokens — 15 minutes — paired with a refresh token stored server-side. That gives me revocation capability: I delete the refresh token, and the user is effectively logged out at the next token refresh cycle."

---

## FLAW 6 — No Push Channel (Dashboard Polling Only)

**Question they'll ask:**
> "How do you get a matched donor notified in under 10 seconds?"

**Exact answer:**
"Today a donor only finds out about a match if they have the dashboard open — it polls on page load. That's not acceptable for an emergency app where minutes matter. The real fix is a message queue worker that triggers a push notification — either FCM (Firebase Cloud Messaging) for browser/mobile push, or SMS via Twilio — the moment a match is recorded. The donor gets notified regardless of whether the dashboard is open. WebSockets would give real-time in-dashboard updates, but push notifications solve the harder problem: reaching a donor who isn't actively looking at the app."

---

## CORRECTNESS — Double-Booking a Donor (Race Condition)

**Question they'll ask:**
> "Two patients confirm the same donor a second apart — what happens?"

**Exact answer:**
"This is a race condition in my current code. I do a read-then-write from application code: check if the donor is available, then mark them claimed. There's a window between those two operations where a second request can read the same 'available' state and also claim the donor. The fix is an atomic claim using `findOneAndUpdate` with a status guard: filter `{ _id: donorId, isAvailable: true }`, update `{ $set: { isAvailable: false } }`. If the donor was already claimed by the first request, the second update matches zero documents and returns null — that's my signal to try the next nearest donor. No race window at all."

---

## THE ONE THING TO SAY UNPROMPTED — Before They Ask

The professor called this the **strongest design decision** in the project. Say it yourself before the interviewer brings it up.

**When to say it:** After walking through the matching flow, add:

**Exact words:**
"One design decision I'm proud of: the 90-day donation cooldown and medical clearance check live inside the `$geoNear` query itself — not as an app-layer filter applied after. That means an ineligible donor can never leak into results under concurrent access, because the exclusion happens where the data is read, at the database level. If I filtered in application code after the query, a concurrent write changing a donor's clearance status between the read and the filter could slip an ineligible donor through. Enforcing it in the query eliminates that window entirely."

---

## INTERVIEW QUESTION TIERS — What Order to Expect

### Tier 1 — Walk the system (they start here)
- "Walk me through what happens when a patient submits an emergency request."
- "Why MongoDB instead of a relational database?"

### Tier 2 — The geospatial core
- "What does a 2dsphere index actually do, and what's the cost of a `$geoNear` query?"
- "How do you keep the cooldown and clearance checks correct as the underlying data changes?"

### Tier 3 — Break it
- "What's the single point of failure?" → **Flaw 1 answer**
- "Two patients confirm the same donor simultaneously — what happens?" → **Correctness answer**
- "Nominatim is down. What does the user see?" → **Flaw 2 answer**

### Tier 4 — Scale it
- "This works for one city. Make it work nationwide."
- "How would you get a matched donor notified in under 10 seconds?" → **Flaw 6 answer**

### Tier 5 — Trade-offs
- "Why JWT over sessions — what did that cost you?" → **Flaw 5 answer**
- "The registration-code system is simple. What's a better design?" → **Flaw 4 answer**

---

## THE COACHING NOTE (from professor)

> "He doesn't need to have already fixed any of this. The strongest move is naming the weak point himself before the interviewer gets there — and going straight into the fix, in one or two sentences, without over-apologizing for what isn't built."

**Rule:** Name the problem yourself → state the fix → move on. Never wait for them to catch it.

---

## QUICK REFERENCE — One Line Per Flaw

| # | Flaw | One-line answer |
|---|------|----------------|
| 1 | Single instance | Load balancer + 2 stateless instances; JWT already makes it stateless |
| 2 | Nominatim sync | Cache hospital geocodes in Redis; graceful timeout if Nominatim is down |
| 3 | Backup race condition | Message queue with idempotency key per withdrawal event |
| 4 | Static reg codes | Hash at rest + expiry + rotation — skipped for v1, needed before prod |
| 5 | JWT no revocation | Short-lived tokens (15 min) + server-side refresh token for revocation |
| 6 | No push channel | MQ worker → FCM/SMS push the moment a match is recorded |
| — | Double-booking | Atomic `findOneAndUpdate` with `isAvailable: true` guard — no read-then-write |
| ★ | Best decision | Cooldown + clearance inside `$geoNear` query — ineligible donors excluded at read time |
