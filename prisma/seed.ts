/**
 * Demonstration data.
 *
 * The seed is not just filler: it sets up the situations the product is
 * supposed to handle well, so they can be seen working immediately.
 *
 *  * Two coworkers with *identical* capabilities, so the tie-break can be
 *    watched resolving in the open.
 *  * Someone one level short of a requirement, to show the gate refusing.
 *  * A lapsed certification, to show an expiry taking someone out.
 *  * A coworker at full capacity, so "qualified but no room" reads differently
 *    from "not qualified".
 *  * A task nobody qualifies for, so the blocked state is visible.
 *
 * Run with `npm run db:seed` (or `npm run setup` from scratch).
 */

import { PrismaClient } from '../src/generated/prisma';
import { randomBytes, scryptSync } from 'node:crypto';

// Load .env before constructing the client. Prisma loads it implicitly in some
// setups and not others — with a custom generator `output` path it is not
// reliable — and a seed that silently connects to nothing is worse than one
// that refuses to start.
try {
  process.loadEnvFile();
} catch {
  // No .env file. Expected in CI and in production, where the environment
  // already carries DATABASE_URL.
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    'DATABASE_URL is not set, so there is no database to seed.\n' +
      'Copy .env.example to .env, or export DATABASE_URL before running this.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const DEMO_PASSWORD = 'distribute-2026';
const PASSWORD_HASH = hashPassword(DEMO_PASSWORD);

const AVATAR_COLOURS = ['#2563eb', '#7c3aed', '#0d9488', '#ea580c', '#be123c', '#4d7c0f', '#0369a1', '#a16207'];
function colourFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length]!;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function main() {
  console.info('Seeding…');

  // Destructive and deliberate: this removes *all* data, not just rows this
  // script wrote, so that re-running gives an identical starting point. Never
  // point it at a database anyone depends on.
  await prisma.$transaction([
    prisma.matchCandidate.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.matchRun.deleteMany(),
    prisma.taskExclusion.deleteMany(),
    prisma.taskRequirement.deleteMany(),
    prisma.task.deleteMany(),
    prisma.taskFolder.deleteMany(),
    prisma.coworkerSkill.deleteMany(),
    prisma.coworker.deleteMany(),
    prisma.positionRequirement.deleteMany(),
    prisma.position.deleteMany(),
    prisma.skill.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.consent.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.authIdentity.deleteMany(),
    prisma.auditEvent.deleteMany(),
    prisma.user.deleteMany(),
    prisma.counter.deleteMany(),
  ]);

  // --- Capabilities --------------------------------------------------------

  const skillSpecs = [
    { slug: 'electrical-fault-finding', name: 'Electrical fault-finding', category: 'Electrical' },
    { slug: 'hv-switching', name: 'High-voltage switching', category: 'Electrical' },
    { slug: 'plc-programming', name: 'PLC programming', category: 'Automation' },
    { slug: 'hydraulics', name: 'Hydraulics', category: 'Mechanical' },
    { slug: 'welding-mig', name: 'MIG welding', category: 'Mechanical' },
    { slug: 'customer-handover', name: 'Customer handover', category: 'Service' },
    { slug: 'report-writing', name: 'Technical report writing', category: 'Service' },
  ] as const;

  const certSpecs = [
    { slug: 'lv-permit', name: 'Low-voltage work permit', category: 'Compliance', expires: true },
    { slug: 'working-at-height', name: 'Working at height', category: 'Compliance', expires: true },
    { slug: 'forklift-licence', name: 'Forklift licence', category: 'Compliance', expires: true },
  ] as const;

  const skills = Object.fromEntries(
    await Promise.all([
      ...skillSpecs.map(async (spec) => [
        spec.slug,
        await prisma.skill.create({
          data: { ...spec, kind: 'GRADED', expires: false, description: null },
        }),
      ]),
      ...certSpecs.map(async (spec) => [
        spec.slug,
        await prisma.skill.create({ data: { ...spec, kind: 'CERTIFICATION' } }),
      ]),
    ]),
  ) as Record<string, { id: string; name: string }>;

  // --- Positions -----------------------------------------------------------

  const seniorTech = await prisma.position.create({
    data: {
      slug: 'senior-electrical-technician',
      title: 'Senior Electrical Technician',
      department: 'Field Service',
      seniority: 4,
      description:
        'Fault-finding and repair on customer installations, including live work under permit, and handing the site back to the customer.',
      requirements: {
        create: [
          { skillId: skills['electrical-fault-finding']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['lv-permit']!.id, minLevel: 5, necessity: 'MANDATORY' },
          { skillId: skills['customer-handover']!.id, minLevel: 3, necessity: 'PREFERRED' },
        ],
      },
    },
  });

  const automationEngineer = await prisma.position.create({
    data: {
      slug: 'automation-engineer',
      title: 'Automation Engineer',
      department: 'Automation',
      seniority: 4,
      description: 'Control system changes, commissioning and line integration.',
      requirements: {
        create: [
          { skillId: skills['plc-programming']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['report-writing']!.id, minLevel: 3, necessity: 'PREFERRED' },
        ],
      },
    },
  });

  const workshopTech = await prisma.position.create({
    data: {
      slug: 'workshop-technician',
      title: 'Workshop Technician',
      department: 'Workshop',
      seniority: 2,
      description: 'Rebuilds and fabrication in the workshop.',
      requirements: {
        create: [
          { skillId: skills['hydraulics']!.id, minLevel: 3, necessity: 'MANDATORY' },
          { skillId: skills['welding-mig']!.id, minLevel: 3, necessity: 'MANDATORY' },
        ],
      },
    },
  });

  // --- People --------------------------------------------------------------

  interface PersonSpec {
    name: string;
    email: string;
    phone?: string;
    role: string;
    marketing: boolean;
    operational: boolean;
    coworker?: {
      positionId: string;
      department: string;
      capacity: number;
      committedNote?: string;
      languages: string;
      availability?: string;
      lastAssignedAt?: Date;
      assignmentCount?: number;
      notes?: string;
      skills: {
        slug: string;
        level: number;
        verified?: boolean;
        years?: number;
        expiresAt?: Date | null;
      }[];
    };
  }

  const people: PersonSpec[] = [
    {
      name: 'Mette Sørensen',
      email: 'mette@example.com',
      phone: '+4520100001',
      role: 'HEAD_OF_DISTRIBUTION',
      marketing: true,
      operational: true,
    },
    {
      name: 'Jonas Kruse',
      email: 'jonas@example.com',
      role: 'PLATFORM_ADMIN',
      marketing: false,
      operational: true,
    },
    // ---- The tie: Anna and Bo are deliberately identical on capability -----
    {
      name: 'Anna Holm',
      email: 'anna@example.com',
      phone: '+4520100002',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: seniorTech.id,
        department: 'Field Service',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-2),
        assignmentCount: 14,
        notes: 'Prefers the northern region. Van fitted for cable work.',
        skills: [
          { slug: 'electrical-fault-finding', level: 4, verified: true, years: 6 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(400) },
          { slug: 'customer-handover', level: 4, verified: true, years: 6 },
          { slug: 'report-writing', level: 3, years: 4 },
        ],
      },
    },
    {
      name: 'Bo Lindqvist',
      email: 'bo@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: false,
      coworker: {
        positionId: seniorTech.id,
        department: 'Field Service',
        capacity: 37,
        languages: 'da,en',
        // Identical capabilities to Anna; only the fairness bookkeeping differs,
        // which is exactly what the tie-break is there to use.
        lastAssignedAt: daysFromNow(-21),
        assignmentCount: 9,
        skills: [
          { slug: 'electrical-fault-finding', level: 4, verified: true, years: 6 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(400) },
          { slug: 'customer-handover', level: 4, verified: true, years: 6 },
          { slug: 'report-writing', level: 3, years: 4 },
        ],
      },
    },
    // ---- One level short: qualified-looking, but the gate says no ---------
    {
      name: 'Camilla Bech',
      email: 'camilla@example.com',
      role: 'COWORKER',
      marketing: true,
      operational: true,
      coworker: {
        positionId: seniorTech.id,
        department: 'Field Service',
        capacity: 37,
        languages: 'da',
        skills: [
          { slug: 'electrical-fault-finding', level: 3, years: 2 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(200) },
          { slug: 'customer-handover', level: 4, years: 3 },
        ],
      },
    },
    // ---- Lapsed certification --------------------------------------------
    {
      name: 'David Nyholm',
      email: 'david@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: seniorTech.id,
        department: 'Field Service',
        capacity: 37,
        languages: 'da,en,de',
        notes: 'Permit renewal booked — chase the training provider.',
        skills: [
          { slug: 'electrical-fault-finding', level: 5, verified: true, years: 11 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(-12) },
          { slug: 'customer-handover', level: 5, verified: true, years: 11 },
        ],
      },
    },
    // ---- Qualified but full ----------------------------------------------
    {
      name: 'Elif Yılmaz',
      email: 'elif@example.com',
      role: 'COWORKER',
      marketing: true,
      operational: true,
      coworker: {
        positionId: automationEngineer.id,
        department: 'Automation',
        capacity: 37,
        languages: 'en,tr',
        skills: [
          { slug: 'plc-programming', level: 5, verified: true, years: 9 },
          { slug: 'report-writing', level: 4, verified: true, years: 7 },
          { slug: 'electrical-fault-finding', level: 3, years: 5 },
        ],
      },
    },
    {
      name: 'Frederik Aaen',
      email: 'frederik@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: false,
      coworker: {
        positionId: automationEngineer.id,
        department: 'Automation',
        capacity: 30,
        languages: 'da,en',
        skills: [
          { slug: 'plc-programming', level: 4, years: 3 },
          { slug: 'report-writing', level: 3, years: 3 },
        ],
      },
    },
    {
      name: 'Gitte Rask',
      email: 'gitte@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: workshopTech.id,
        department: 'Workshop',
        capacity: 37,
        languages: 'da',
        skills: [
          { slug: 'hydraulics', level: 4, verified: true, years: 8 },
          { slug: 'welding-mig', level: 4, verified: true, years: 8 },
          { slug: 'forklift-licence', level: 5, verified: true, expiresAt: daysFromNow(500) },
          { slug: 'working-at-height', level: 5, expiresAt: daysFromNow(90) },
        ],
      },
    },
    // ---- On leave ---------------------------------------------------------
    {
      name: 'Henrik Vad',
      email: 'henrik@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: workshopTech.id,
        department: 'Workshop',
        capacity: 37,
        languages: 'da,en',
        availability: 'ON_LEAVE',
        skills: [
          { slug: 'hydraulics', level: 5, verified: true, years: 15 },
          { slug: 'welding-mig', level: 5, verified: true, years: 15 },
          { slug: 'forklift-licence', level: 5, verified: true, expiresAt: daysFromNow(300) },
        ],
      },
    },
  ];

  const created: Record<string, { userId: string; coworkerId?: string }> = {};

  for (const person of people) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        phone: person.phone ?? null,
        fullName: person.name,
        passwordHash: PASSWORD_HASH,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: person.phone ? new Date() : null,
        role: person.role,
        avatarColor: colourFor(person.email),
        identities: {
          create: { provider: 'EMAIL_PASSWORD', providerUserId: person.email, label: person.email },
        },
        consents: {
          create: [
            { type: 'TERMS_OF_SERVICE', granted: true, documentVersion: '2026-01-15', source: 'SIGNUP' },
            { type: 'PRIVACY_POLICY', granted: true, documentVersion: '2026-01-15', source: 'SIGNUP' },
            { type: 'OPERATIONAL_EMAIL', granted: person.operational, source: 'SIGNUP' },
            { type: 'OPERATIONAL_SMS', granted: person.operational && Boolean(person.phone), source: 'SIGNUP' },
            { type: 'MARKETING_EMAIL', granted: person.marketing, source: 'SIGNUP' },
            { type: 'MARKETING_SMS', granted: false, source: 'SIGNUP' },
          ],
        },
      },
    });

    created[person.name] = { userId: user.id };

    if (person.coworker) {
      const spec = person.coworker;
      const coworker = await prisma.coworker.create({
        data: {
          userId: user.id,
          positionId: spec.positionId,
          department: spec.department,
          weeklyCapacityHours: spec.capacity,
          languages: spec.languages,
          availability: spec.availability ?? 'ACTIVE',
          lastAssignedAt: spec.lastAssignedAt ?? null,
          assignmentCount: spec.assignmentCount ?? 0,
          notes: spec.notes ?? null,
          skills: {
            create: spec.skills.map((s) => ({
              skillId: skills[s.slug]!.id,
              level: s.level,
              verified: s.verified ?? false,
              yearsExperience: s.years ?? 0,
              expiresAt: s.expiresAt ?? null,
              verifiedAt: s.verified ? daysFromNow(-60) : null,
            })),
          },
        },
      });
      created[person.name]!.coworkerId = coworker.id;
    }
  }

  const head = created['Mette Sørensen']!.userId;

  // --- Folders -------------------------------------------------------------

  const callouts = await prisma.taskFolder.create({
    data: {
      slug: 'electrical-callouts',
      name: 'Electrical callouts',
      description:
        'Unplanned electrical work on customer sites. Time-critical, so this folder assigns automatically and balances the load.',
      department: 'Field Service',
      ownerId: head,
      defaultPositionId: seniorTech.id,
      routingMode: 'AUTO_ASSIGN',
      tieBreak: 'BALANCED_LOAD',
      ambiguityPolicy: 'STRICT',
      tieEpsilon: 0.02,
      minimumScore: 0.5,
    },
  });

  const commissioning = await prisma.taskFolder.create({
    data: {
      slug: 'commissioning',
      name: 'Commissioning',
      description:
        'Control-system work with customer sign-off. A person confirms every assignment here, because the wrong pairing is expensive.',
      department: 'Automation',
      ownerId: head,
      defaultPositionId: automationEngineer.id,
      routingMode: 'PROPOSE_ONLY',
      tieBreak: 'BEST_MATCH',
      ambiguityPolicy: 'STRICT',
      tieEpsilon: 0.03,
      minimumScore: 0.6,
    },
  });

  const workshop = await prisma.taskFolder.create({
    data: {
      slug: 'workshop-jobs',
      name: 'Workshop jobs',
      description: 'Rebuilds and fabrication. Rotates evenly through the workshop team.',
      department: 'Workshop',
      ownerId: head,
      defaultPositionId: workshopTech.id,
      routingMode: 'AUTO_ASSIGN',
      tieBreak: 'ROUND_ROBIN',
      ambiguityPolicy: 'AUTO',
      tieEpsilon: 0.02,
      minimumScore: 0.45,
    },
  });

  await prisma.counter.create({ data: { name: 'task', value: 1000 } });

  // --- Tasks ---------------------------------------------------------------

  const taskSpecs = [
    {
      folderId: callouts.id,
      title: 'Intermittent trip on the packing line feeder',
      description:
        'Customer reports the feeder tripping two or three times a shift, no obvious pattern. Site is live — permit required. Contact on arrival is the shift lead at reception.',
      priority: 'HIGH',
      hours: 6,
      dueInDays: 3,
      requirements: [
        { slug: 'electrical-fault-finding', minLevel: 4, necessity: 'MANDATORY', weight: 5 },
        { slug: 'lv-permit', minLevel: 5, necessity: 'MANDATORY', weight: 5 },
        { slug: 'customer-handover', minLevel: 3, necessity: 'PREFERRED', weight: 2 },
      ],
      languages: 'da',
    },
    {
      folderId: callouts.id,
      title: 'Replace damaged distribution board, north site',
      description: 'Board damaged by water ingress. Isolation arranged for Tuesday morning.',
      priority: 'NORMAL',
      hours: 8,
      dueInDays: 7,
      requirements: [
        { slug: 'electrical-fault-finding', minLevel: 4, necessity: 'MANDATORY', weight: 5 },
        { slug: 'lv-permit', minLevel: 5, necessity: 'MANDATORY', weight: 5 },
      ],
      languages: 'da',
    },
    {
      folderId: commissioning.id,
      title: 'Commission the new palletiser cell',
      description: 'PLC changes, safety circuit proving, and a written handover report for the customer.',
      priority: 'NORMAL',
      hours: 16,
      dueInDays: 14,
      requirements: [
        { slug: 'plc-programming', minLevel: 4, necessity: 'MANDATORY', weight: 5 },
        { slug: 'report-writing', minLevel: 3, necessity: 'MANDATORY', weight: 3 },
      ],
      languages: 'en',
    },
    {
      folderId: workshop.id,
      title: 'Rebuild the tipper ram assembly',
      description: 'Seal kit is on the shelf. Needs pressure testing before it goes back out.',
      priority: 'NORMAL',
      hours: 10,
      dueInDays: 10,
      requirements: [
        { slug: 'hydraulics', minLevel: 3, necessity: 'MANDATORY', weight: 5 },
        { slug: 'welding-mig', minLevel: 3, necessity: 'MANDATORY', weight: 3 },
        { slug: 'forklift-licence', minLevel: 5, necessity: 'MANDATORY', weight: 4 },
      ],
      languages: 'da',
    },
    {
      // Nobody has HV switching at all — this one is meant to be blocked.
      folderId: callouts.id,
      title: 'Switch the 11 kV ring main for the substation upgrade',
      description:
        'Requires authorised high-voltage switching. Raised so the gap in the team is on the record.',
      priority: 'CRITICAL',
      hours: 5,
      dueInDays: 5,
      requirements: [
        { slug: 'hv-switching', minLevel: 4, necessity: 'MANDATORY', weight: 5 },
        { slug: 'lv-permit', minLevel: 5, necessity: 'MANDATORY', weight: 3 },
      ],
      languages: 'da',
    },
  ] as const;

  let reference = 1000;
  for (const spec of taskSpecs) {
    reference += 1;
    await prisma.task.create({
      data: {
        reference: `TSK-${reference}`,
        title: spec.title,
        description: spec.description,
        folderId: spec.folderId,
        createdById: head,
        status: 'QUEUED',
        queuedAt: new Date(),
        priority: spec.priority,
        estimatedHours: spec.hours,
        dueAt: daysFromNow(spec.dueInDays),
        requiredLanguages: spec.languages,
        requirements: {
          create: spec.requirements.map((r) => ({
            skillId: skills[r.slug]!.id,
            minLevel: r.minLevel,
            necessity: r.necessity,
            weight: r.weight,
          })),
        },
      },
    });
  }
  await prisma.counter.update({ where: { name: 'task' }, data: { value: reference } });

  // --- A product announcement, to show the bell carrying marketing ---------

  const everyone = await prisma.user.findMany({ select: { id: true } });
  await prisma.notification.createMany({
    data: everyone.map((u) => ({
      userId: u.id,
      type: 'PRODUCT_UPDATE',
      title: 'New: see exactly why a task went where it did',
      body:
        'Every task now shows the full shortlist — who qualified, their score factor by factor, and the reason anyone was ruled out. Open any task to see it.',
      link: '/tasks',
      severity: 'INFO',
      category: 'MARKETING',
      emailStatus: 'SKIPPED_NO_CONSENT',
      smsStatus: 'NOT_APPLICABLE',
      deliveryNote: 'Shown in the bell for everyone, regardless of marketing consent.',
    })),
  });

  console.info(`
Seeded.

  Sign in with any of these — the password is the same for all of them:

    mette@example.com    head of distribution
    jonas@example.com    platform administrator
    anna@example.com     coworker (identical capabilities to Bo)
    bo@example.com       coworker (identical capabilities to Anna)
    david@example.com    coworker with a lapsed permit

  Password: ${DEMO_PASSWORD}

  Five tasks are queued and waiting for distribution. Open one and press
  "Run distribution again" to watch the engine work, or create a new task.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());