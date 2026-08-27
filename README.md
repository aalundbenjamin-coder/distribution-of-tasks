# Distribution of Tasks

Work goes into a folder and comes out with the right name on it.

A head of distribution drops a task into a folder. The system checks it against
what every coworker can actually do — recorded capability levels, certifications
and their expiry dates, languages, position, availability, remaining capacity —
removes everyone who does not qualify, ranks the ones who do, and hands the work
to the strongest match. Every decision is kept, including the rejections and the
reason for each one.

The point is not that a computer picks a name. The point is that **an unqualified
coworker can never receive a task**, and that weeks later you can still show
exactly why a particular task went to a particular person.

---

## Running it

You need a PostgreSQL database. Any one will do — here is a throwaway:

```bash
docker run --name dot-db -e POSTGRES_PASSWORD=dot -p 5432:5432 -d postgres:16
```

Then:

```bash
npm install
cp .env.example .env      # the default DATABASE_URL matches the container above
npm run setup             # generate the client, run migrations, seed
npm run dev               # http://localhost:3000
```

`npm run setup` seeds a small organisation you can sign into straight away.
Every demo account uses the password **`distribute-2026`**:

| E-mail | Role | Why they are interesting |
| --- | --- | --- |
| `mette@example.com` | Head of distribution | Sees folders, tasks, everyone's capabilities |
| `jonas@example.com` | Platform administrator | Also sees the audit trail |
| `anna@example.com` | Coworker | Capabilities **identical** to Bo's — the tie case |
| `bo@example.com` | Coworker | Capabilities identical to Anna's |
| `david@example.com` | Coworker | Strongest on paper, but his permit lapsed |

Five tasks are queued. Open **Tasks → Intermittent trip on the packing line
feeder** and press *Run distribution again* to watch the engine work, or create
a task of your own.

Other scripts:

```bash
npm test           # 143 tests: the gate, the ranking, validation, and end-to-end
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run db:seed    # replace all data with the demo organisation (destructive)
npm run db:demo    # add any missing demo data, deleting nothing (safe anywhere)
npm run db:migrate # create a migration after changing the schema
npm run db:deploy  # apply pending migrations (what production runs)
```

Postgres is the only thing you have to provide. Google sign-in, e-mail and SMS
all fall back to clearly-labelled local stand-ins when no credentials are
configured — see [Configuration](#configuration).

---

## How distribution works

Four steps, in this order, every time:

```
   gate  ──►  score  ──►  rank  ──►  decide
```

### 1. The gate — who is even allowed

`src/lib/matching/eligibility.ts`

A coworker is removed from consideration entirely if **any** of these fails:

- a **mandatory capability** is missing, or held below the level the task asks for
- a **required certification** is missing, or has expired
- the task is **restricted to a position** or **department** they are not in
- a **required language** is not one they speak
- they are **on leave, unavailable, or offboarded**, or their account is suspended
- their **availability window** does not cover the deadline
- an **explicit exclusion** exists for this pairing (conflict of interest, and so on)
- they have **no capacity left** in the week for the task's estimate

There is no score in this step. A failed requirement is disqualifying and cannot
be outweighed by anything. Every failure is collected — not just the first — so
the interface can say *everything* standing in someone's way rather than making
you fix problems one at a time.

Capacity is a hard gate on purpose: someone with no room left is not a qualified
recipient of more work. The interface reads "3 qualified coworkers are at full
capacity" differently from "nobody is qualified", because those call for
different responses.

### 2. The score — who is strongest

`src/lib/matching/scoring.ts`

Only the survivors are scored. Seven factors, each 0–1, combined by weight:

| Factor | Weight | What it measures |
| --- | ---: | --- |
| Capability fit | 40% | How far they clear each required level, plus credit for preferred capabilities |
| Workload balance | 14% | Their open workload against the rest of the shortlist |
| Verified capabilities | 12% | Share of required capabilities a lead has signed off |
| Capacity headroom | 12% | How much of the week is still free after taking this task |
| Experience | 10% | Years in the required capabilities |
| Deadline feasibility | 7% | Whether the free hours before the deadline cover the estimate |
| Position & department fit | 5% | Whether their role lines up with the work |

Meeting a requirement exactly already scores 0.75; the remaining quarter rewards
surplus, with diminishing returns — an expert should beat an adequate colleague
on a demanding job, but not so decisively that they absorb every routine one.

Factors that cannot be judged for a given task (no deadline set, no capability
requirements) are marked inapplicable and their weight is redistributed, so a
sparsely-specified task is not systematically scored lower than a detailed one.

### 3. The rank — and what happens when two people are equal

`src/lib/matching/engine.ts`

This is the case the system was designed around, because it is the one where
sloppiness turns into misdirected work.

**There is no randomness anywhere in the engine, and no reliance on database row
order.** Ties fall through a fixed cascade, and every step is total:

1. **Score**, quantised to six decimals so float noise never decides anything
2. **The folder's fairness rule**, which consults both available signals:
   - `BALANCED_LOAD` — open task count, committed hours, then rotation history
   - `ROUND_ROBIN` — longest wait since their last task, lifetime count, then load
3. **Verified capabilities** — more lead sign-offs on the required skills
4. **Combined capability level** across the required skills
5. **A stable identifier** — a genuine last resort, reached only when every
   real signal above is exhausted

The rule that separated the top two is written into the assignment in plain
language:

> *Same score as Anna Holm; chosen because they have waited longer since their
> last task (21 days, against 2).*

A folder set to `STRICT` ambiguity with `BEST_MATCH` tie-breaking has no fairness
rule to separate equals, so a near-tie has no defensible winner — the engine
**refuses to choose** and sends the task to a human. That refusal is the feature.

### 4. The decision

| Outcome | When | What happens |
| --- | --- | --- |
| `ASSIGNED` | Auto-assign folder, clear winner above the minimum | Assignment created, assignee notified |
| `PROPOSED` | Propose-only folder | Shortlist shown, a person confirms |
| `AMBIGUOUS_TIE` | Strict folder, genuine tie | Sent to the review queue |
| `BELOW_MINIMUM` | Best match under the folder's threshold | Held back for a person |
| `NO_ELIGIBLE_CANDIDATE` | Nobody clears the gate | Task blocked, distributors notified |

Every run writes a `MatchRun` with a verdict for **every** coworker considered —
their score, the full factor breakdown, and for the rejected ones the exact
requirement they failed. The routing policy in force is snapshotted onto the run,
so changing a folder's settings later cannot silently rewrite the story of an old
assignment.

A head of distribution can override the ranking by hand. Overriding the
*requirements* — assigning to someone the gate rejected — additionally requires
a written reason, which is stored on the assignment and in the audit trail.

---

## Signing up, and notifications

Three doors, one account: **e-mail and password**, **Google**, or a **phone
number** with a one-time code. Adding a second method later links to the same
profile rather than creating a duplicate.

The terms of service and the privacy policy can be read **in full inside the
sign-up form**, without navigating away and losing what you have typed. Both must
be accepted before an account exists, and the acceptance is recorded against the
document version that was on screen. If the documents change, the version is
bumped and everyone is asked again — an old acceptance never silently carries
over.

Notification consent is separate, optional, and off by default, split into four
independent decisions: work notifications by e-mail, work notifications by SMS,
product news by e-mail, product news by SMS.

**Declining all of it costs you nothing.** The bell in the top-right corner
always receives every notification — assignments, decisions waiting on you, and
new features alike. Consent decides whether a *copy* also reaches your inbox or
your phone. It never decides whether you are told.

Consent rows are append-only. Withdrawing writes a new row rather than editing
the old one, so the question "what had this person agreed to on the day we sent
that message?" always has an answer. The full history is on the settings page.

---

## Roles

| Role | Can |
| --- | --- |
| **Coworker** | See their own tasks, edit their own capabilities (but not verify them), see every run they were considered in — including the ones they lost, and why |
| **Head of distribution** | Everything above, plus folders, tasks, all capability profiles, verifying capabilities, and manual assignment |
| **Platform administrator** | Everything, plus the audit trail |

The first account created on an empty database is made a platform
administrator, so a new deployment has someone who can set it up. Everyone
after that is a coworker, because the ability to hand out work should be
granted deliberately rather than claimed by signing up.

Navigation is built from the role, but the pages themselves are the real guard —
every page and every server action checks independently and fails closed.

---

## Configuration

Everything below is optional. Without it the product runs complete, with
stand-ins that say what they are.

| Variable | Without it |
| --- | --- |
| `DATABASE_URL` | **Required.** A PostgreSQL connection string; prefer the pooled one when deployed |
| `APP_ORIGIN` | Falls back to the request origin |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | The Google button opens a local stand-in page, clearly labelled as not being Google, and refused entirely when `NODE_ENV=production` |
| `RESEND_API_KEY` / `MAIL_FROM` | E-mails are logged to the server console; the interface marks them "simulated" |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS are logged, and sign-up codes are shown in the form so the flow stays walkable in development |

Google's redirect URI is `<APP_ORIGIN>/api/auth/google/callback`.

---

## Deploying

The app is a normal Next.js project and needs exactly two things: a PostgreSQL
database, and `DATABASE_URL` pointing at it.

### On Vercel

1. Import the repository. Next.js is detected automatically.
2. Add a Postgres database under **Storage** — Neon and Prisma Postgres are both
   one click, and both set `DATABASE_URL` on the project for you.
3. Redeploy.

That is the whole setup. The build runs
`prisma generate && node scripts/migrate-if-configured.mjs && next build`, so
the client is generated fresh and the schema is applied on the way through.

Then open the site and **sign up**. The first account to exist becomes the
platform administrator — otherwise a new deployment would have nobody able to
create a folder, and no way to appoint one without opening the database by
hand. Every account after it is an ordinary coworker.

Optionally set `APP_ORIGIN` to the deployed URL, so links inside e-mails and
SMS point somewhere real.

#### About migrations in the build

Running migrations during a build is normally poor practice — a build that
mutates state is one you cannot freely re-run. It is done here deliberately,
because the alternative is that attaching a database leaves the app still
broken until someone clones the repository and runs a migration by hand, and
that step is where a deployment stalls.

The step is written to be safe about it:

- **No `DATABASE_URL`** → skipped with a clear notice. The build still
  succeeds and the public pages still render, so a half-configured project is
  not a failed project.
- **Schema already current** → `prisma migrate deploy` applies only what is
  pending, and takes an advisory lock, so concurrent preview builds cannot race.
- **Migration fails** → the build stops. The previous deployment keeps serving
  and the reason is in the build log, rather than hidden behind runtime errors.

If your provider's pooled URL refuses migration statements, point
`DATABASE_URL` at the direct (unpooled) connection string.

#### Seeding a deployed instance

Nothing to do: every deployed build fills in the demo organisation after
migrating, and later builds change nothing because the data is already there.
Set `SEED_DEMO=0` on the deployment to switch that off.

You can also run it by hand against the deployed database:

```bash
DATABASE_URL="<the deployed connection string>" npm run db:demo
```

That fills in whatever is missing — the thirteen coworkers, their profiles and
portraits, and the work already behind them — and deletes nothing. Accounts
that signed up keep their sessions, their consents and their administrator
role, and running it twice changes nothing the first run did.

`npm run db:seed` is the other one, and it is destructive: it empties every
table before writing, which on a deployed database also takes the first
account, and with it the administrator role the bootstrap only ever grants
once. It refuses to run when it finds an account it did not create; `--force`
overrides that, and means what it says.

### Anywhere else

`npm run build && npm run start` behind any Node 20+ runtime. The only
requirement is that `DATABASE_URL` is reachable.

---

## Security

- Passwords are salted **scrypt** hashes; nothing reversible is stored
- Session cookies carry a random secret, and only its **SHA-256 digest** is in
  the database — a database leak cannot be replayed as a login
- One-time codes are stored as digests, expire in ten minutes, allow five
  attempts, and issuing a new one burns the previous one
- Google sign-in uses **PKCE** with a state parameter compared in constant time
- Sign-in failures spend the same time whether or not the account exists, and
  return the same message, so the form cannot be used to enumerate addresses
- Every consequential action lands in an append-only audit trail

---

## Layout

```
prisma/
  schema.prisma           the whole data model, commented
  seed.ts                 a small organisation set up to show the hard cases
src/
  lib/
    matching/             the engine — pure, no database, no clock
      types.ts            inputs and outputs
      eligibility.ts      the hard gate
      scoring.ts          the seven ranking factors
      engine.ts           ranking, tie-breaking, and the decision
    auth/                 crypto, sessions, OTP, Google, consent, validation
    notifications/        transports and consent-gated dispatch
    server/               database-facing services: distribution, accounts, audit
    domain/enums.ts       every string enum, declared once
    content/legal.ts      the terms and the privacy policy, as data
  app/
    (auth)/               sign up, sign in
    (app)/                the signed-in application
    actions/              server actions
    api/auth/             Google OAuth and sign-out
  components/             the interface
tests/                    89 tests
```

The engine takes plain data, returns plain data, and touches neither the database
nor the clock — `now` is passed in. That is what makes every routing decision
reproducible, and it is why the interesting behaviour can be tested exhaustively
without any fixtures.
