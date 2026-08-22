import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { LogoMark } from '@/components/TopBar';
import {
  ArrowRightIcon,
  BellIcon,
  FolderIcon,
  PeopleIcon,
  ScaleIcon,
  ShieldIcon,
  SparkIcon,
} from '@/components/icons';

export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
        <div className="shell row" style={{ height: 60, gap: 9 }}>
          <Link href="/" className="row" style={{ gap: 9 }}>
            <LogoMark size={28} />
            <span style={{ fontWeight: 680, letterSpacing: '-0.02em', fontSize: 16 }}>
              Distribution<span className="subtle" style={{ fontWeight: 500 }}> of Tasks</span>
            </span>
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/login" className="btn btn-sm btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-sm btn-primary">Create an account</Link>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero ------------------------------------------------------------ */}
        <section className="shell" style={{ padding: '76px 24px 56px', textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 18 }}>
            <SparkIcon size={13} /> Capability-matched work distribution
          </div>
          <h1
            style={{
              fontSize: 'clamp(32px, 5.2vw, 52px)',
              fontWeight: 680,
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
              maxWidth: '18ch',
              margin: '0 auto',
            }}
          >
            Work goes in a folder. The right name comes out.
          </h1>
          <p
            className="page-lede"
            style={{ margin: '20px auto 0', fontSize: 17, maxWidth: '58ch', textAlign: 'center' }}
          >
            A head of distribution drops a task into a folder. The system checks it against what
            every coworker can actually do — recorded levels, certifications, availability,
            capacity — and hands it to the person best qualified to take it. Nobody unqualified is
            ever in the running.
          </p>

          <div className="row" style={{ gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              Create an account <ArrowRightIcon size={16} />
            </Link>
            <Link href="/login" className="btn btn-lg">Sign in</Link>
          </div>
          <p className="tiny subtle" style={{ marginTop: 14 }}>
            Sign up with an e-mail address, a Google account or a phone number.
          </p>
        </section>

        {/* The flow -------------------------------------------------------- */}
        <section className="shell" style={{ padding: '10px 24px 60px' }}>
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <Step
              n="1"
              icon={<FolderIcon size={19} />}
              title="A task lands in a folder"
              body="The folder holds the routing rules for its kind of work: which position may take it, how ties are settled, and whether the system may assign on its own or must ask first."
            />
            <Step
              n="2"
              icon={<ShieldIcon size={19} />}
              title="Unqualified people are removed"
              body="Every mandatory capability, certification expiry, language, position, department and remaining capacity is checked. Failing one is disqualifying — no score can rescue it."
            />
            <Step
              n="3"
              icon={<ScaleIcon size={19} />}
              title="The rest are ranked"
              body="Seven weighted factors decide who is strongest: how far they clear each bar, whether a lead verified it, experience, headroom, workload balance, the deadline, and context."
            />
            <Step
              n="4"
              icon={<PeopleIcon size={19} />}
              title="One person gets it — and it is on the record"
              body="Every candidate's score, every rejection reason and the rule that broke a tie are stored. Weeks later you can still show exactly why this task went to this person."
            />
          </div>
        </section>

        {/* Precision ------------------------------------------------------- */}
        <section style={{ background: 'var(--bg-raised)', borderBlock: '1px solid var(--border)' }}>
          <div className="shell" style={{ padding: '56px 24px' }}>
            <div style={{ maxWidth: '62ch' }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>When two people are equally qualified</div>
              <h2 style={{ fontSize: 26, letterSpacing: '-0.025em' }}>
                The hardest case is a tie, so it is the one we designed for first.
              </h2>
              <p className="page-lede" style={{ marginTop: 12 }}>
                Two coworkers with the same capabilities must not be separated by whoever the
                database happened to list first. Ties fall through a fixed cascade — score, then
                the folder&rsquo;s fairness rule, then verified capabilities, then combined level,
                then a stable identifier — and the rule that decided is written into the
                assignment in plain language.
              </p>
            </div>

            <div className="grid-auto" style={{ marginTop: 28 }}>
              <Point
                title="Same inputs, same answer"
                body="No randomness anywhere in the engine. Run the same distribution a hundred times and it picks the same person a hundred times, in the same order."
              />
              <Point
                title="Or it refuses to choose"
                body="Set a folder to strict and a genuine tie is escalated to a human instead of guessed at. Refusing to pick is a legitimate outcome, not a failure."
              />
              <Point
                title="Work spreads instead of piling up"
                body="Load balancing and round-robin are tie-break rules, so the strongest coworker does not quietly absorb every task in the queue."
              />
              <Point
                title="Overrides are allowed, and recorded"
                body="A head of distribution can assign past a failed requirement — but only by writing down why, and the override is kept in the audit trail."
              />
            </div>
          </div>
        </section>

        {/* Notifications --------------------------------------------------- */}
        <section className="shell" style={{ padding: '56px 24px 70px' }}>
          <div
            style={{
              display: 'grid',
              gap: 30,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              alignItems: 'start',
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Notifications</div>
              <h2 style={{ fontSize: 24, letterSpacing: '-0.025em' }}>
                Say no to everything and you still miss nothing.
              </h2>
              <p className="page-lede" style={{ marginTop: 12 }}>
                At sign-up you can read the terms of service and the privacy policy in full without
                leaving the form, and decide separately whether we may e-mail or text you — about
                your work, about the product, or neither.
              </p>
              <p className="page-lede" style={{ marginTop: 10 }}>
                If you say no, nothing is withheld. The bell in the top-right corner of the app is
                where every assignment, every decision waiting on you and every new feature turns
                up. Consent decides where a message goes, never whether it exists.
              </p>
            </div>

            <div className="card card-pad">
              <div className="row" style={{ gap: 10, marginBottom: 14 }}>
                <span style={{ position: 'relative', color: 'var(--text-muted)' }}>
                  <BellIcon size={22} />
                  <span
                    className="bell-count"
                    style={{ top: -4, right: -6, borderColor: 'var(--bg-raised)' }}
                  >
                    3
                  </span>
                </span>
                <strong style={{ fontSize: 14 }}>Your bell, always on</strong>
              </div>
              <ul className="stack" style={{ gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
                {[
                  ['New task: replace pump seal, line 3', 'Assigned to you — you meet every requirement.'],
                  ['TSK-1043 needs your decision', 'Two coworkers are equally qualified.'],
                  ['New: capability expiry warnings', 'Product news, shown here whatever you consented to.'],
                ].map(([title, body]) => (
                  <li key={title} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 11 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
                    <div className="tiny muted">{body}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '22px 0' }}>
        <div className="shell row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <span className="tiny subtle">Distribution of Tasks</span>
          <div style={{ flex: 1 }} />
          <Link href="/legal/terms" className="tiny subtle">Terms of service</Link>
          <Link href="/legal/privacy" className="tiny subtle">Privacy policy</Link>
        </div>
      </footer>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card card-pad">
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-border)',
            flex: 'none',
          }}
        >
          {icon}
        </span>
        <span className="eyebrow">Step {n}</span>
      </div>
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>{title}</h3>
      <p className="small muted">{body}</p>
    </div>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 style={{ fontSize: 14.5, marginBottom: 5 }}>{title}</h3>
      <p className="small muted">{body}</p>
    </div>
  );
}
