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

/**
 * Additive mode leaves every existing row alone and only fills in what is
 * missing. It exists so the demo roster can be put into a database that real
 * accounts already live in — a deployed one — without the wipe below taking
 * those accounts, and their administrator, with it.
 */
const ADDITIVE = process.argv.includes('--additive') || process.env.SEED_MODE === 'additive';

async function main() {
  console.info(ADDITIVE ? 'Filling in missing demo data…' : 'Seeding…');

  // Every demo account is an @example.com address, so anything else is somebody
  // real who signed up. Wiping their account also takes the administrator role
  // with it — the bootstrap only grants it to the first account ever created —
  // so the wipe stops rather than doing that on the strength of a mistyped
  // command. `--additive` is the way to fill in demo data next to real people.
  if (!ADDITIVE) {
    const real = await prisma.user.count({ where: { NOT: { email: { endsWith: '@example.com' } } } });
    if (real > 0 && !process.argv.includes('--force')) {
      throw new Error(
        `Refusing to wipe: ${real} account(s) here were not created by this script.\n` +
          'Use `npm run db:demo` to add the demo data without deleting anything,\n' +
          'or pass --force if you genuinely mean to erase this database.',
      );
    }
  }

  // Destructive and deliberate: this removes *all* data, not just rows this
  // script wrote, so that re-running gives an identical starting point. Never
  // point it at a database anyone depends on.
  if (!ADDITIVE) await prisma.$transaction([
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
    { slug: 'safety-systems', name: 'Safety systems', category: 'Automation' },
    { slug: 'data-analysis', name: 'Data analysis', category: 'Automation' },
    // The building trades. Each category is one trade, so the catalogue reads
    // as a company that does more than one kind of work.
    { slug: 'residential-wiring', name: 'Residential wiring', category: 'Electrical' },
    { slug: 'switchboard-assembly', name: 'Switchboard and distribution board work', category: 'Electrical' },
    { slug: 'ev-charger-mounting', name: 'EV charger installation', category: 'Electrical' },
    { slug: 'knx-ihc-programming', name: 'KNX / IHC smart building systems', category: 'Electrical' },
    { slug: 'installation-troubleshooting', name: 'Installation troubleshooting', category: 'Electrical' },
    { slug: 'masonry-bricklaying', name: 'Bricklaying and blockwork', category: 'Masonry' },
    { slug: 'masonry-repointing', name: 'Repointing of facades', category: 'Masonry' },
    { slug: 'rendering-plastering', name: 'Rendering and plastering', category: 'Masonry' },
    { slug: 'tile-setting', name: 'Tile setting', category: 'Masonry' },
    { slug: 'roof-construction', name: 'Roof construction and replacement', category: 'Carpentry' },
    { slug: 'window-door-installation', name: 'Window and door installation', category: 'Carpentry' },
    { slug: 'drywall-partitioning', name: 'Drywall and partition walls', category: 'Carpentry' },
    { slug: 'timber-framing', name: 'Timber framing', category: 'Carpentry' },
    { slug: 'floor-laying', name: 'Floor laying', category: 'Carpentry' },
    { slug: 'sanitary-installation', name: 'Sanitary installation', category: 'Plumbing & Sewer' },
    { slug: 'heating-system-service', name: 'Heating system service', category: 'Plumbing & Sewer' },
    { slug: 'drain-jetting', name: 'High-pressure drain jetting', category: 'Plumbing & Sewer' },
    { slug: 'drain-cctv-survey', name: 'CCTV drain survey', category: 'Plumbing & Sewer' },
    { slug: 'interior-painting', name: 'Interior painting', category: 'Painting' },
    { slug: 'facade-painting', name: 'Facade and exterior painting', category: 'Painting' },
    { slug: 'spray-painting', name: 'Spray painting', category: 'Painting' },
    { slug: 'wallpapering', name: 'Wallpapering', category: 'Painting' },
    { slug: 'surface-filling-skimming', name: 'Surface filling and skimming', category: 'Painting' },
    { slug: 'cipp-liner-installation', name: 'CIPP liner installation', category: 'Pipe Relining' },
    { slug: 'point-liner-repair', name: 'Point liner repair', category: 'Pipe Relining' },
    { slug: 'robotic-cutter-operation', name: 'Robotic cutter operation', category: 'Pipe Relining' },
    { slug: 'pre-lining-jetting', name: 'Pre-lining cleaning and jetting', category: 'Pipe Relining' },
  ] as const;

  const certSpecs = [
    { slug: 'lv-permit', name: 'Low-voltage work permit', category: 'Compliance', expires: true },
    { slug: 'working-at-height', name: 'Working at height', category: 'Compliance', expires: true },
    { slug: 'forklift-licence', name: 'Forklift licence', category: 'Compliance', expires: true },
    // Trade certifications. The Danish courses several trades share — hot
    // work, epoxy — exist once, because a certificate belongs to a person,
    // not to the trade they happened to earn it in.
    { slug: 'electrical-authorisation', name: 'Electrical installer authorisation (el-autorisation)', category: 'Compliance', expires: false },
    { slug: 'wet-room-membrane-cert', name: 'Wet-room membrane certificate (vådrumssikring)', category: 'Compliance', expires: false },
    { slug: 'hot-work-certificate', name: 'Hot-work certificate (varmt arbejde)', category: 'Compliance', expires: true },
    { slug: 'scaffold-erection-cert', name: 'Scaffold erection course (systemstillads)', category: 'Compliance', expires: false },
    { slug: 'asbestos-roofing-cert', name: 'Asbestos handling course', category: 'Compliance', expires: false },
    { slug: 'vvs-authorisation', name: 'Plumbing installer authorisation (VVS-autorisation)', category: 'Compliance', expires: false },
    { slug: 'kloakmester-authorisation', name: 'Sewer master authorisation (kloakmester)', category: 'Compliance', expires: false },
    { slug: 'gas-a-certificate', name: 'Gas competence certificate (A-certifikat)', category: 'Compliance', expires: true },
    { slug: 'epoxy-course', name: 'Epoxy and isocyanate course', category: 'Compliance', expires: false },
    { slug: 'relining-tv-inspection-cert', name: 'Authorised TV inspection certificate', category: 'Compliance', expires: true },
    { slug: 'confined-space-training', name: 'Confined space and wells course', category: 'Compliance', expires: false },
  ] as const;

  const skills = Object.fromEntries(
    await Promise.all([
      ...skillSpecs.map(async (spec) => [
        spec.slug,
        await prisma.skill.upsert({
          where: { slug: spec.slug },
          create: { ...spec, kind: 'GRADED', expires: false, description: null },
          update: {},
        }),
      ]),
      ...certSpecs.map(async (spec) => [
        spec.slug,
        await prisma.skill.upsert({
          where: { slug: spec.slug },
          create: { ...spec, kind: 'CERTIFICATION' },
          update: {},
        }),
      ]),
    ]),
  ) as Record<string, { id: string; name: string }>;

  // --- Positions -----------------------------------------------------------

  const seniorTech = await prisma.position.upsert({
    where: { slug: 'senior-electrical-technician' },
    create: {
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
    update: {},
  });

  const automationEngineer = await prisma.position.upsert({
    where: { slug: 'automation-engineer' },
    create: {
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
    update: {},
  });

  const workshopTech = await prisma.position.upsert({
    where: { slug: 'workshop-technician' },
    create: {
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
    update: {},
  });

  // ---- The building trades ------------------------------------------------

  const electrician = await prisma.position.upsert({
    where: { slug: 'electrician' },
    create: {
      slug: 'electrician',
      title: 'Electrician',
      department: 'Electrical',
      seniority: 3,
      description:
        'Installs, services and troubleshoots electrical installations in homes and commercial buildings, from wiring and distribution boards to EV chargers and smart-home systems.',
      requirements: {
        create: [
          { skillId: skills['residential-wiring']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['installation-troubleshooting']!.id, minLevel: 3, necessity: 'MANDATORY' },
          { skillId: skills['lv-permit']!.id, minLevel: 5, necessity: 'MANDATORY' },
          { skillId: skills['ev-charger-mounting']!.id, minLevel: 2, necessity: 'PREFERRED' },
        ],
      },
    },
    update: {},
  });

  const bricklayer = await prisma.position.upsert({
    where: { slug: 'bricklayer' },
    create: {
      slug: 'bricklayer',
      title: 'Bricklayer',
      department: 'Masonry',
      seniority: 3,
      description:
        'Performs masonry work such as brickwork, repointing, rendering, tiling and bathroom renovation on facades and interiors.',
      requirements: {
        create: [
          { skillId: skills['masonry-bricklaying']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['tile-setting']!.id, minLevel: 3, necessity: 'MANDATORY' },
          { skillId: skills['wet-room-membrane-cert']!.id, minLevel: 5, necessity: 'PREFERRED' },
        ],
      },
    },
    update: {},
  });

  const carpenter = await prisma.position.upsert({
    where: { slug: 'carpenter' },
    create: {
      slug: 'carpenter',
      title: 'Carpenter',
      department: 'Carpentry',
      seniority: 3,
      description:
        'Builds and renovates roofs, windows, doors, partition walls, decks and other timber and drywall structures.',
      requirements: {
        create: [
          { skillId: skills['timber-framing']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['window-door-installation']!.id, minLevel: 3, necessity: 'MANDATORY' },
          { skillId: skills['roof-construction']!.id, minLevel: 3, necessity: 'PREFERRED' },
        ],
      },
    },
    update: {},
  });

  const plumberSewer = await prisma.position.upsert({
    where: { slug: 'plumber-sewer-technician' },
    create: {
      slug: 'plumber-sewer-technician',
      title: 'Plumber & Sewer Technician',
      department: 'Plumbing & Sewer',
      seniority: 3,
      description:
        'Handles plumbing, heating and sanitary installations plus sewer service work such as drain clearing, jetting and CCTV inspection.',
      requirements: {
        create: [
          { skillId: skills['sanitary-installation']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['vvs-authorisation']!.id, minLevel: 5, necessity: 'MANDATORY' },
          { skillId: skills['drain-jetting']!.id, minLevel: 3, necessity: 'PREFERRED' },
          { skillId: skills['kloakmester-authorisation']!.id, minLevel: 5, necessity: 'PREFERRED' },
        ],
      },
    },
    update: {},
  });

  const painter = await prisma.position.upsert({
    where: { slug: 'painter' },
    create: {
      slug: 'painter',
      title: 'Painter',
      department: 'Painting',
      seniority: 3,
      description:
        'Prepares and paints interior and exterior surfaces, including walls, ceilings, facades, woodwork and wallpapered surfaces.',
      requirements: {
        create: [
          { skillId: skills['interior-painting']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['surface-filling-skimming']!.id, minLevel: 3, necessity: 'MANDATORY' },
          { skillId: skills['facade-painting']!.id, minLevel: 3, necessity: 'PREFERRED' },
        ],
      },
    },
    update: {},
  });

  const reliningTech = await prisma.position.upsert({
    where: { slug: 'pipe-relining-technician' },
    create: {
      slug: 'pipe-relining-technician',
      title: 'Pipe Relining Technician',
      department: 'Pipe Relining',
      seniority: 3,
      description:
        'Renovates sewers and drains from the inside — cleaning, lining and reopening pipes without excavation.',
      requirements: {
        create: [
          { skillId: skills['cipp-liner-installation']!.id, minLevel: 4, necessity: 'MANDATORY' },
          { skillId: skills['pre-lining-jetting']!.id, minLevel: 3, necessity: 'MANDATORY' },
          { skillId: skills['robotic-cutter-operation']!.id, minLevel: 3, necessity: 'PREFERRED' },
          { skillId: skills['confined-space-training']!.id, minLevel: 5, necessity: 'PREFERRED' },
        ],
      },
    },
    update: {},
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
      availableFrom?: Date;
      lastAssignedAt?: Date;
      assignmentCount?: number;
      notes?: string;
      education?: string;
      school?: string;
      thesis?: string;
      bio?: string;
      portrait?: string;
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
        education: 'BEng Electrical Engineering',
        school: 'Aarhus Universitet',
        thesis: 'Cable fault location in rural distribution networks',
        bio: 'Works the northern region out of a van fitted for cable work. Unhurried on a live site, which is most of why she is trusted on them.',
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
        education: 'BEng Electrical Engineering',
        school: 'Aalborg Universitet',
        thesis: 'Selectivity in low-voltage protection coordination',
        bio: 'Methodical to a fault. Leaves the kind of notes the next technician is relieved to find.',
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
        education: 'AP Degree in Automation Engineering',
        school: 'Erhvervsakademi Aarhus',
        thesis: 'Commissioning checklists that survive contact with a live site',
        bio: 'Came up through commissioning and still thinks like a commissioner: nothing is finished until it has been proven in front of someone.',
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
        education: 'MSc Electrical Power Engineering',
        school: 'Danmarks Tekniske Universitet (DTU)',
        thesis: 'Transient signatures of intermittent earth faults',
        bio: 'The strongest diagnostician on the team, and currently the one the engine keeps having to pass over: his permit lapsed in August.',
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
        education: 'MSc Control Engineering',
        school: 'Danmarks Tekniske Universitet (DTU)',
        thesis: 'Model-based tuning for high-speed packaging lines',
        bio: 'Tunes a line until it stops arguing with itself. Reads three PLC dialects without needing the manual.',
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
        education: 'BEng Automation Engineering',
        school: 'Københavns Erhvervsakademi (KEA)',
        thesis: 'Retrofitting legacy conveyors with modern safety controllers',
        bio: 'Happiest inside a panel that has not been opened since 1998, and the only one who volunteers for those.',
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
        education: 'Skilled Trade Certificate, Industrial Technician',
        school: 'TEC — Technical Education Copenhagen',
        thesis: 'Jig design for repeatable weld quality on thin-wall sections',
        bio: 'Builds the jig before the part. Everything that leaves her bench comes out the same the second time.',
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
        education: 'Skilled Trade Certificate, Blacksmith and Machining',
        school: 'Syddansk Erhvervsskole',
        thesis: 'Wear patterns in high-cycle hydraulic seals',
        bio: 'Thirty years on hydraulics and still the first person anyone asks. On leave until September.',
        skills: [
          { slug: 'hydraulics', level: 5, verified: true, years: 15 },
          { slug: 'welding-mig', level: 5, verified: true, years: 15 },
          { slug: 'forklift-licence', level: 5, verified: true, expiresAt: daysFromNow(300) },
        ],
      },
    },

    // ---- The five carried over from the presentation ----------------------
    // Same people, same portraits, same capabilities as the projected slides,
    // so the deck and the running system tell one story rather than two.
    {
      name: 'Sofie Lindgren',
      email: 'sofie@example.com',
      phone: '+4520100010',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: seniorTech.id,
        department: 'Field Service',
        capacity: 37,
        languages: 'da,en,sv',
        lastAssignedAt: daysFromNow(-15),
        assignmentCount: 31,
        portrait: 'sofie',
        education: 'MSc Electrical Power Engineering',
        school: 'Danmarks Tekniske Universitet (DTU)',
        thesis: 'Arc-fault signatures in low-voltage distribution boards',
        bio: 'Reads a fault from its transient signature before opening the panel. The one the team calls when a trip has no obvious cause.',
        notes: 'Holds the high-voltage authorisation for the northern substations.',
        skills: [
          { slug: 'electrical-fault-finding', level: 5, verified: true, years: 11 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(307) },
          { slug: 'hv-switching', level: 4, verified: true, years: 7 },
          { slug: 'customer-handover', level: 4, verified: true, years: 9 },
          { slug: 'report-writing', level: 3, years: 5 },
        ],
      },
    },
    {
      name: 'Freja Nilsen',
      email: 'freja@example.com',
      phone: '+4520100011',
      role: 'COWORKER',
      marketing: true,
      operational: true,
      coworker: {
        positionId: seniorTech.id,
        department: 'Field Service',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-7),
        assignmentCount: 24,
        portrait: 'freja',
        education: 'BEng Electrical Installation & Service',
        school: 'Københavns Erhvervsakademi (KEA)',
        thesis: 'Reducing handover defects through structured customer sign-off',
        bio: 'Turns a finished repair into a signed, documented handover. Customers ask for her by name.',
        notes: 'Permit renewal booked; until it clears she cannot be sent to live work.',
        skills: [
          { slug: 'customer-handover', level: 5, verified: true, years: 8 },
          { slug: 'electrical-fault-finding', level: 4, verified: true, years: 6 },
          { slug: 'report-writing', level: 4, years: 6 },
          // Lapsed three weeks ago: the engine has to keep her off live work.
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(-22) },
        ],
      },
    },
    {
      name: 'Mikkel Dahl',
      email: 'mikkel@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: automationEngineer.id,
        department: 'Automation',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-10),
        assignmentCount: 19,
        portrait: 'mikkel',
        education: 'BEng Automation & Control Engineering',
        school: 'Aarhus Universitet',
        thesis: 'Safety-rated PLC architectures for collaborative robot cells',
        bio: 'Builds the control logic that makes a machine safe to stand next to, and proves it on paper afterwards.',
        notes: 'Signs off safety circuits for the whole Automation department.',
        skills: [
          { slug: 'plc-programming', level: 5, verified: true, years: 9 },
          { slug: 'safety-systems', level: 4, verified: true, years: 6 },
          { slug: 'report-writing', level: 4, verified: true, years: 7 },
          { slug: 'data-analysis', level: 2, years: 2 },
          { slug: 'electrical-fault-finding', level: 2, years: 3 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(186) },
        ],
      },
    },
    {
      name: 'Jonas Berg',
      email: 'jonas.berg@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: automationEngineer.id,
        department: 'Automation',
        // Four days a week by agreement, which is why the engine will not fill
        // him to the same hours as the rest of the team.
        capacity: 30,
        languages: 'da,en,no',
        lastAssignedAt: daysFromNow(-12),
        assignmentCount: 16,
        portrait: 'jonas',
        education: 'MSc Data Engineering',
        school: 'IT-Universitetet i København (ITU)',
        thesis: 'Predictive maintenance from vibration telemetry',
        bio: 'Finds the failure three weeks before it happens, then writes it up so someone can act on it.',
        notes: 'Owns the reliability reporting for every site.',
        skills: [
          { slug: 'data-analysis', level: 5, verified: true, years: 8 },
          { slug: 'report-writing', level: 5, verified: true, years: 8 },
          { slug: 'plc-programming', level: 3, years: 4 },
        ],
      },
    },
    {
      name: 'Amira Haddad',
      email: 'amira@example.com',
      phone: '+4520100012',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: workshopTech.id,
        department: 'Workshop',
        capacity: 37,
        languages: 'da,en,ar',
        availability: 'ON_LEAVE',
        availableFrom: daysFromNow(18),
        lastAssignedAt: daysFromNow(-20),
        assignmentCount: 27,
        portrait: 'amira',
        education: 'MSc Mechanical Engineering',
        school: 'Lunds Universitet',
        thesis: 'Fatigue life prediction in high-pressure hydraulic cylinders',
        bio: 'Rebuilds what everyone else writes off. Knows exactly how many cycles a cylinder has left in it.',
        notes: 'On leave until mid-September. Back on the bench from the 14th.',
        skills: [
          { slug: 'hydraulics', level: 5, verified: true, years: 12 },
          { slug: 'welding-mig', level: 4, verified: true, years: 10 },
          { slug: 'forklift-licence', level: 5, verified: true, expiresAt: daysFromNow(431) },
          { slug: 'report-writing', level: 3, years: 4 },
        ],
      },
    },

    // ---- One name per building trade ---------------------------------------
    // Each trade folder needs at least one person the engine can actually
    // hand work to, or a demo of that folder ends at "no qualified coworker".
    {
      name: 'Sara Lindholm',
      email: 'sara@example.com',
      phone: '+4520100020',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: electrician.id,
        department: 'Electrical',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-4),
        assignmentCount: 21,
        education: 'Skilled Trade Certificate, Electrician',
        school: 'TEC — Technical Education Copenhagen',
        thesis: 'Final apprenticeship project: full smart-home installation with load-managed EV charging',
        bio: 'Wires a house so the next electrician can read it like a book. The go-to for charger installations.',
        skills: [
          { slug: 'residential-wiring', level: 4, verified: true, years: 7 },
          { slug: 'installation-troubleshooting', level: 4, verified: true, years: 7 },
          { slug: 'switchboard-assembly', level: 4, verified: true, years: 6 },
          { slug: 'ev-charger-mounting', level: 5, verified: true, years: 4 },
          { slug: 'knx-ihc-programming', level: 3, years: 3 },
          { slug: 'lv-permit', level: 5, verified: true, expiresAt: daysFromNow(512) },
        ],
      },
    },
    {
      name: 'Lars Østergaard',
      email: 'lars@example.com',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: bricklayer.id,
        department: 'Masonry',
        capacity: 37,
        languages: 'da',
        lastAssignedAt: daysFromNow(-6),
        assignmentCount: 33,
        education: 'Skilled Trade Certificate, Bricklayer',
        school: 'EUC Nord',
        thesis: 'Final apprenticeship project: bathroom renovation with full wet-room membrane system',
        bio: 'Third-generation bricklayer. Repoints a hundred-year-old facade so the repair disappears into it.',
        skills: [
          { slug: 'masonry-bricklaying', level: 5, verified: true, years: 14 },
          { slug: 'masonry-repointing', level: 4, verified: true, years: 12 },
          { slug: 'rendering-plastering', level: 4, verified: true, years: 12 },
          { slug: 'tile-setting', level: 4, verified: true, years: 10 },
          { slug: 'wet-room-membrane-cert', level: 5, verified: true },
          { slug: 'hot-work-certificate', level: 5, verified: true, expiresAt: daysFromNow(610) },
          { slug: 'scaffold-erection-cert', level: 5, verified: true },
        ],
      },
    },
    {
      name: 'Nadia Petersen',
      email: 'nadia@example.com',
      phone: '+4520100021',
      role: 'COWORKER',
      marketing: true,
      operational: true,
      coworker: {
        positionId: carpenter.id,
        department: 'Carpentry',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-3),
        assignmentCount: 26,
        education: 'Skilled Trade Certificate, Carpenter',
        school: 'Roskilde Tekniske Skole',
        thesis: 'Final apprenticeship project: roof replacement with integrated skylights on a preservation-listed house',
        bio: 'Frames a roof by eye and finishes it by the millimetre. Takes the jobs where the house is older than the drawings.',
        skills: [
          { slug: 'timber-framing', level: 5, verified: true, years: 11 },
          { slug: 'roof-construction', level: 4, verified: true, years: 9 },
          { slug: 'window-door-installation', level: 4, verified: true, years: 9 },
          { slug: 'drywall-partitioning', level: 4, verified: true, years: 8 },
          { slug: 'floor-laying', level: 3, years: 5 },
          { slug: 'hot-work-certificate', level: 5, verified: true, expiresAt: daysFromNow(420) },
          { slug: 'asbestos-roofing-cert', level: 5, verified: true },
        ],
      },
    },
    {
      name: 'Oliver Brandt',
      email: 'oliver@example.com',
      phone: '+4520100022',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: plumberSewer.id,
        department: 'Plumbing & Sewer',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-2),
        assignmentCount: 29,
        education: 'Skilled Trade Certificate, Plumber (VVS-energiuddannelsen)',
        school: 'NEXT Uddannelse København',
        thesis: 'Final apprenticeship project: district-heating conversion of a two-family house',
        bio: 'Finds the leak the building has been hiding for years. Carries the sewer authorisation the whole department leans on.',
        skills: [
          { slug: 'sanitary-installation', level: 5, verified: true, years: 12 },
          { slug: 'heating-system-service', level: 4, verified: true, years: 9 },
          { slug: 'drain-jetting', level: 4, verified: true, years: 7 },
          { slug: 'drain-cctv-survey', level: 3, years: 4 },
          { slug: 'vvs-authorisation', level: 5, verified: true },
          { slug: 'kloakmester-authorisation', level: 5, verified: true },
          { slug: 'gas-a-certificate', level: 5, verified: true, expiresAt: daysFromNow(880) },
        ],
      },
    },
    {
      name: 'Ida Kjeldsen',
      email: 'ida@example.com',
      role: 'COWORKER',
      marketing: true,
      operational: true,
      coworker: {
        positionId: painter.id,
        department: 'Painting',
        capacity: 30,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-9),
        assignmentCount: 18,
        education: 'Skilled Trade Certificate, Painter',
        school: 'Aarhus Tech',
        thesis: 'Final apprenticeship project: restoration of lime-painted surfaces in a listed stairwell',
        bio: 'The finish everyone photographs. Half her jobs come from people who saw the last one.',
        skills: [
          { slug: 'interior-painting', level: 5, verified: true, years: 10 },
          { slug: 'surface-filling-skimming', level: 4, verified: true, years: 10 },
          { slug: 'facade-painting', level: 4, verified: true, years: 8 },
          { slug: 'wallpapering', level: 4, years: 6 },
          { slug: 'spray-painting', level: 3, years: 3 },
          { slug: 'epoxy-course', level: 5, verified: true },
        ],
      },
    },
    {
      name: 'Emil Vestergaard',
      email: 'emil@example.com',
      phone: '+4520100023',
      role: 'COWORKER',
      marketing: false,
      operational: true,
      coworker: {
        positionId: reliningTech.id,
        department: 'Pipe Relining',
        capacity: 37,
        languages: 'da,en',
        lastAssignedAt: daysFromNow(-5),
        assignmentCount: 15,
        education: 'Skilled Trade Certificate, Structural and Civil Works (struktør)',
        school: 'Learnmark Horsens',
        thesis: 'Final apprenticeship project: no-dig renovation of a collapsed clay sewer under a working bakery',
        bio: 'Renovates the pipe without touching the garden above it. Reads a CCTV survey the way others read the sports page.',
        skills: [
          { slug: 'cipp-liner-installation', level: 4, verified: true, years: 6 },
          { slug: 'point-liner-repair', level: 4, verified: true, years: 6 },
          { slug: 'pre-lining-jetting', level: 4, verified: true, years: 7 },
          { slug: 'robotic-cutter-operation', level: 3, years: 4 },
          { slug: 'drain-cctv-survey', level: 4, verified: true, years: 6 },
          { slug: 'relining-tv-inspection-cert', level: 5, verified: true, expiresAt: daysFromNow(295) },
          { slug: 'confined-space-training', level: 5, verified: true },
          { slug: 'epoxy-course', level: 5, verified: true },
        ],
      },
    },
  ];

  const created: Record<string, { userId: string; coworkerId?: string }> = {};

  for (const person of people) {
    const user = await prisma.user.upsert({
    where: { email: person.email },
    create: {
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
    update: {},
  });

    created[person.name] = { userId: user.id };

    if (person.coworker) {
      const spec = person.coworker;
      const coworker = await prisma.coworker.upsert({
    where: { userId: user.id },
    create: {
          userId: user.id,
          positionId: spec.positionId,
          department: spec.department,
          weeklyCapacityHours: spec.capacity,
          languages: spec.languages,
          availability: spec.availability ?? 'ACTIVE',
          availableFrom: spec.availableFrom ?? null,
          lastAssignedAt: spec.lastAssignedAt ?? null,
          assignmentCount: spec.assignmentCount ?? 0,
          notes: spec.notes ?? null,
          education: spec.education ?? null,
          school: spec.school ?? null,
          thesis: spec.thesis ?? null,
          bio: spec.bio ?? null,
          portrait: spec.portrait ?? null,
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
    update: {},
  });
      created[person.name]!.coworkerId = coworker.id;
    }
  }

  const head = created['Mette Sørensen']!.userId;

  // --- Folders -------------------------------------------------------------

  const callouts = await prisma.taskFolder.upsert({
    where: { slug: 'electrical-callouts' },
    create: {
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
    update: {},
  });

  const commissioning = await prisma.taskFolder.upsert({
    where: { slug: 'commissioning' },
    create: {
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
    update: {},
  });

  const workshop = await prisma.taskFolder.upsert({
    where: { slug: 'workshop-jobs' },
    create: {
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
    update: {},
  });

  // ---- A folder per building trade ---------------------------------------
  // Each is an intake for one kind of work, described in its own words, with
  // the trade's position as the default gate.

  const tradeFolders: {
    slug: string;
    name: string;
    description: string;
    department: string;
    defaultPositionId: string;
  }[] = [
    {
      slug: 'electrical-jobs',
      name: 'Electrical jobs',
      description:
        'Planned electrical work: installations, upgrades, safety checks and charging equipment. Unplanned callouts go in the callout folder instead.',
      department: 'Electrical',
      defaultPositionId: electrician.id,
    },
    {
      slug: 'masonry-jobs',
      name: 'Masonry jobs',
      description:
        'Incoming masonry work: brickwork, facade and joint repairs, rendering, tiling and full bathroom renovations.',
      department: 'Masonry',
      defaultPositionId: bricklayer.id,
    },
    {
      slug: 'carpentry-jobs',
      name: 'Carpentry jobs',
      description:
        'Incoming carpentry work: roofing, window and door replacement, drywall, floors, decks and general timber construction and repair.',
      department: 'Carpentry',
      defaultPositionId: carpenter.id,
    },
    {
      slug: 'plumbing-sewer-jobs',
      name: 'Plumbing & sewer jobs',
      description:
        'Incoming plumbing, heating and sewer work: leaks, sanitary and heating installations, blocked drains, jetting, CCTV surveys and sewer repairs.',
      department: 'Plumbing & Sewer',
      defaultPositionId: plumberSewer.id,
    },
    {
      slug: 'painting-jobs',
      name: 'Painting jobs',
      description:
        'Incoming painting work: interior and exterior painting, surface preparation, wallpapering and coating of wood and metal.',
      department: 'Painting',
      defaultPositionId: painter.id,
    },
    {
      slug: 'relining-jobs',
      name: 'Relining jobs',
      description:
        'No-dig sewer renovation: pre-lining cleaning, CIPP and point liners, robotic reopening and the TV inspection that documents the result.',
      department: 'Pipe Relining',
      defaultPositionId: reliningTech.id,
    },
  ];

  for (const folder of tradeFolders) {
    await prisma.taskFolder.upsert({
      where: { slug: folder.slug },
      create: {
        ...folder,
        ownerId: head,
        routingMode: 'AUTO_ASSIGN',
        tieBreak: 'BALANCED_LOAD',
        ambiguityPolicy: 'STRICT',
        tieEpsilon: 0.02,
        minimumScore: 0.5,
      },
      update: {},
    });
  }


  await prisma.counter.upsert({
    where: { name: 'task' },
    create: { name: 'task', value: 1921 },
    update: {},
  });

  // --- Tasks ---------------------------------------------------------------

  // --- Work already done ----------------------------------------------------
  //
  // A finished task keeps its assignment rather than being cleared away, which
  // is what lets a coworker's page answer "what has this person actually done"
  // long after the fact. These are the same jobs, references and dates the
  // presentation credits them with.

  const historySpecs: {
    who: string;
    reference: string;
    title: string;
    folderId: string;
    daysAgo: number;
    hours: number;
    skill: string;
    score: number;
  }[] = [
    { who: 'Freja Nilsen', reference: 'TSK-1921', title: 'Customer handover and acceptance test, Køge line 2', folderId: callouts.id, daysAgo: 7, hours: 5, skill: 'customer-handover', score: 0.94 },
    { who: 'Mikkel Dahl', reference: 'TSK-1915', title: 'Commission palletiser cell, Vejle', folderId: commissioning.id, daysAgo: 10, hours: 16, skill: 'plc-programming', score: 0.97 },
    { who: 'Jonas Berg', reference: 'TSK-1912', title: 'Downtime analysis, Q2', folderId: commissioning.id, daysAgo: 12, hours: 12, skill: 'data-analysis', score: 0.96 },
    { who: 'Sofie Lindgren', reference: 'TSK-1908', title: 'Distribution board replacement, Aalborg depot', folderId: callouts.id, daysAgo: 15, hours: 9, skill: 'electrical-fault-finding', score: 0.95 },
    { who: 'Elif Yılmaz', reference: 'TSK-1906', title: 'Line 2 retune after motor swap', folderId: commissioning.id, daysAgo: 16, hours: 7, skill: 'plc-programming', score: 0.91 },
    { who: 'Mikkel Dahl', reference: 'TSK-1902', title: 'Safety circuit proving after guard rebuild', folderId: commissioning.id, daysAgo: 18, hours: 6, skill: 'safety-systems', score: 0.93 },
    { who: 'Amira Haddad', reference: 'TSK-1898', title: 'Rebuild tipper ram assembly', folderId: workshop.id, daysAgo: 20, hours: 14, skill: 'hydraulics', score: 0.98 },
    { who: 'Anna Holm', reference: 'TSK-1893', title: 'Cable fault located and repaired, Randers feeder', folderId: callouts.id, daysAgo: 19, hours: 8, skill: 'electrical-fault-finding', score: 0.89 },
    { who: 'Freja Nilsen', reference: 'TSK-1889', title: 'Service visit, packaging hall', folderId: callouts.id, daysAgo: 22, hours: 4, skill: 'customer-handover', score: 0.90 },
    { who: 'David Nyholm', reference: 'TSK-1885', title: 'Earth fault traced on the bottling line', folderId: callouts.id, daysAgo: 24, hours: 6, skill: 'electrical-fault-finding', score: 0.92 },
    { who: 'Jonas Berg', reference: 'TSK-1881', title: 'Sensor data pipeline for bearing telemetry', folderId: commissioning.id, daysAgo: 25, hours: 18, skill: 'data-analysis', score: 0.95 },
    { who: 'Sofie Lindgren', reference: 'TSK-1876', title: 'Emergency isolation after water ingress, Hillerød', folderId: callouts.id, daysAgo: 27, hours: 5, skill: 'hv-switching', score: 0.93 },
    { who: 'Bo Lindqvist', reference: 'TSK-1872', title: 'Annual inspection, switchroom B', folderId: callouts.id, daysAgo: 29, hours: 7, skill: 'electrical-fault-finding', score: 0.88 },
    { who: 'Mikkel Dahl', reference: 'TSK-1868', title: 'PLC migration, line 4', folderId: commissioning.id, daysAgo: 30, hours: 20, skill: 'plc-programming', score: 0.96 },
    { who: 'Amira Haddad', reference: 'TSK-1866', title: 'Weld repair, boom section', folderId: workshop.id, daysAgo: 32, hours: 6, skill: 'welding-mig', score: 0.94 },
    { who: 'Freja Nilsen', reference: 'TSK-1857', title: 'Fault report, conveyor drive', folderId: callouts.id, daysAgo: 36, hours: 4, skill: 'report-writing', score: 0.87 },
    { who: 'Gitte Rask', reference: 'TSK-1852', title: 'Weld repair, chassis crossmember', folderId: workshop.id, daysAgo: 38, hours: 5, skill: 'welding-mig', score: 0.90 },
    { who: 'Sofie Lindgren', reference: 'TSK-1844', title: 'Thermographic survey, main switchroom', folderId: callouts.id, daysAgo: 40, hours: 6, skill: 'electrical-fault-finding', score: 0.91 },
    { who: 'Jonas Berg', reference: 'TSK-1839', title: 'Reliability baseline report, all sites', folderId: commissioning.id, daysAgo: 43, hours: 22, skill: 'report-writing', score: 0.97 },
    { who: 'Amira Haddad', reference: 'TSK-1831', title: 'Hydraulic press overhaul', folderId: workshop.id, daysAgo: 47, hours: 16, skill: 'hydraulics', score: 0.96 },
  ];

  for (const spec of historySpecs) {
    const coworkerId = created[spec.who]?.coworkerId;
    if (!coworkerId) throw new Error(`History references an unknown coworker: ${spec.who}`);

    const finished = daysFromNow(-spec.daysAgo);
    await prisma.task.upsert({
    where: { reference: spec.reference },
    create: {
        reference: spec.reference,
        title: spec.title,
        folderId: spec.folderId,
        createdById: head,
        status: 'COMPLETED',
        priority: 'NORMAL',
        estimatedHours: spec.hours,
        queuedAt: daysFromNow(-spec.daysAgo - 2),
        completedAt: finished,
        requirements: {
          create: [{ skillId: skills[spec.skill]!.id, minLevel: 3, necessity: 'MANDATORY', weight: 5 }],
        },
        assignments: {
          create: {
            coworkerId,
            method: 'AUTOMATIC',
            assignedById: head,
            status: 'COMPLETED',
            scoreAtAssignment: spec.score,
            rationale: 'Highest ranked candidate at the time of distribution.',
            acceptedAt: daysFromNow(-spec.daysAgo - 2),
            completedAt: finished,
          },
        },
      },
    update: {},
  });
  }

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
        { slug: 'safety-systems', minLevel: 3, necessity: 'PREFERRED', weight: 4 },
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
        { slug: 'hv-switching', minLevel: 5, necessity: 'MANDATORY', weight: 5 },
        { slug: 'lv-permit', minLevel: 5, necessity: 'MANDATORY', weight: 3 },
      ],
      languages: 'da',
    },
  ] as const;

  let reference = 1921;
  for (const spec of taskSpecs) {
    reference += 1;
    await prisma.task.upsert({
    where: { reference: `TSK-${reference}` },
    create: {
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
    update: {},
  });
  }
  const highest = await prisma.task.findFirst({
    where: { reference: { startsWith: 'TSK-' } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const highestNumber = Number(highest?.reference.replace('TSK-', '') ?? 0);
  await prisma.counter.update({
    where: { name: 'task' },
    data: { value: Math.max(reference, Number.isFinite(highestNumber) ? highestNumber : 0) },
  });

  // --- A product announcement, to show the bell carrying marketing ---------

  // Notifications carry no natural key, so the announcement is addressed only
  // to people who have not already been told. Re-running otherwise stacks the
  // same message up in everyone's bell.
  const ANNOUNCEMENT = 'New: see exactly why a task went where it did';
  const alreadyTold = new Set(
    (
      await prisma.notification.findMany({
        where: { title: ANNOUNCEMENT },
        select: { userId: true },
      })
    ).map((n) => n.userId),
  );
  const everyone = (await prisma.user.findMany({ select: { id: true } })).filter(
    (u) => !alreadyTold.has(u.id),
  );
  await prisma.notification.createMany({
    data: everyone.map((u) => ({
      userId: u.id,
      type: 'PRODUCT_UPDATE',
      title: ANNOUNCEMENT,
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