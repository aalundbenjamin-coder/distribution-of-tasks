/**
 * Typical jobs per position, offered as suggestions when a task is created.
 *
 * These are prompts, not constraints: the title field stays free text, and a
 * folder whose position is not listed here simply offers nothing. They live in
 * code rather than the database because they are vocabulary, not records —
 * nothing references them, nothing is stored against them, and translating or
 * amending them should be a code review, not a data migration.
 *
 * Keyed by position slug, matching `prisma/seed.ts`.
 */
export const TASK_SUBJECTS: Record<string, readonly string[]> = {
  'senior-electrical-technician': [
    'Emergency callout, power loss',
    'Fault-finding on live installation',
    'Distribution board upgrade',
    'RCD (HPFI) testing and replacement',
    'Electrical safety inspection (el-tjek)',
    'Thermographic survey',
  ],
  'automation-engineer': [
    'PLC programming and commissioning',
    'Safety circuit proving',
    'Line changeover and retune',
    'Sensor and instrumentation fault',
    'SCADA / HMI change',
    'Downtime analysis',
  ],
  'workshop-technician': [
    'Hydraulic cylinder overhaul',
    'Weld repair',
    'Machining and fitting',
    'Preventive service, workshop equipment',
    'Component fabrication',
  ],
  electrician: [
    'EV charger installation',
    'Distribution board upgrade',
    'Fault-finding on live installation',
    'Lighting installation and replacement',
    'New outlets and switches',
    'Rewiring of apartment',
    'RCD (HPFI) testing and replacement',
    'Smart home / IHC installation',
    'Outdoor and garden lighting',
    'Electrical safety inspection (el-tjek)',
    'Appliance connection (hob, oven, hood)',
    'Data and network cabling',
  ],
  bricklayer: [
    'Bathroom renovation',
    'Tiling of floors and walls',
    'Repointing of facade',
    'Brickwork for extension',
    'Rendering and plastering',
    'Chimney repair',
    'Repair of frost-damaged masonry',
    'Setting of window sills',
    'Moisture-proofing of basement walls',
    'Garden wall construction',
  ],
  carpenter: [
    'Roof replacement',
    'Window and door replacement',
    'Carport construction',
    'Drywall partition walls',
    'Laying wooden floors',
    'Terrace and deck construction',
    'Suspended ceilings',
    'Attic conversion',
    'Skylight (Velux) installation',
    'Repair of rot damage',
    'Kitchen installation',
    'Roof space insulation',
  ],
  'plumber-sewer-technician': [
    'Blocked drain clearing',
    'High-pressure sewer jetting',
    'CCTV drain inspection',
    'Toilet and sanitary installation',
    'Radiator replacement',
    'Water heater installation',
    'Leak repair',
    'Rat blocker installation',
    'Sewer connection renovation',
    'Bathroom plumbing rough-in',
    'District heating unit service',
    'Rainwater drainage connection',
  ],
  painter: [
    'Interior painting of apartment',
    'Facade painting',
    'Painting of windows and doors',
    'Wallpapering',
    'Filling and skimming of walls',
    'Painting of stairwell',
    'Spray painting of ceilings',
    'Wood protection and exterior stain',
    'Moving-out repaint (fraflytning)',
    'Epoxy floor coating',
  ],
  'pipe-relining-technician': [
    'CIPP relining of main sewer',
    'Point liner repair',
    'Pre-lining cleaning and jetting',
    'Robotic reopening of branch connections',
    'TV inspection with report',
    'Relining of downpipes',
    'Renovation of floor drain',
    'Root cutting in sewer',
    'Final documentation survey',
  ],
};
