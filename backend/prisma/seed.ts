import { PrismaClient, Language, BookingModel, PriceUnit, AttributeType, FilterType } from '@prisma/client';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { DERIVED_KEY_PREFIXES, deleteByPrefix } from '../src/common/cache/derived-keys';
import { emailTemplates } from './email-templates.seed-data';
import { staticPages } from './static-pages.seed-data';
import { faqs } from './faqs.seed-data';
import { SEARCH_FILTERS } from './search-filters.seed-data';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Packages — exact v1 prices from Product Bible §11.2 (amounts in para, i.e.
// RSD x 100 per P4).
// ---------------------------------------------------------------------------

async function seedPackages() {
  const packages = [
    {
      key: 'BASIC',
      priceMonthly: 149_000n,
      priceYearly: 1_639_000n,
      listingLimit: 1,
      hasBookings: false,
      hasMessaging: false,
      hasIcal: false,
      hasReviews: false,
      hasStatistics: true,
      displayOrder: 1,
    },
    {
      key: 'STANDARD',
      priceMonthly: 334_000n,
      priceYearly: 3_674_000n,
      listingLimit: 1,
      hasBookings: true,
      hasMessaging: true,
      hasIcal: true,
      hasReviews: true,
      hasStatistics: true,
      displayOrder: 2,
    },
    {
      key: 'PRO',
      priceMonthly: 864_800n,
      priceYearly: 9_490_000n,
      listingLimit: 4,
      hasBookings: true,
      hasMessaging: true,
      hasIcal: true,
      hasReviews: true,
      hasStatistics: true,
      displayOrder: 3,
    },
  ];

  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { key: pkg.key },
      update: pkg,
      create: pkg,
    });
  }
  console.log(`Seeded ${packages.length} packages`);
}

// ---------------------------------------------------------------------------
// Permissions — flat list (P6/R12). The admin gets every key; a future
// moderator/support role gets a subset without touching application code.
// ---------------------------------------------------------------------------

const PERMISSION_DEFS: Array<{ key: string; description: string }> = [
  { key: 'approve_listing', description: 'Approve or reject listings and listing edits' },
  { key: 'manage_categories', description: 'Create, merge, archive categories and their attributes' },
  { key: 'manage_users', description: 'View, block and manage user accounts' },
  { key: 'view_all_bookings', description: 'View all bookings and messages platform-wide' },
  { key: 'manage_subscriptions', description: 'Manage packages, prices and subscriptions' },
  { key: 'manual_activate_subscription', description: 'Manually activate/extend a subscription (bank transfer)' },
  { key: 'manage_featured', description: 'Assign featured listings and manage the waitlist' },
  { key: 'view_admin_logs', description: 'View the administrator action log' },
  { key: 'manage_static_pages', description: 'Manage static pages, legal documents and translations' },
  { key: 'resolve_disputes', description: 'Resolve disputes and reports' },
  { key: 'manage_settings', description: 'Change platform settings, prices and thresholds' },
];

async function seedPermissionsAndAdmin() {
  for (const perm of PERMISSION_DEFS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: perm,
    });
  }

  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@rentaj.rs';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      firstName: 'Rentaj',
      lastName: 'Administrator',
      email: adminEmail,
      emailVerified: true,
      passwordHash: await argon2.hash(adminPassword),
      language: Language.SR,
    },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: admin.id, permissionId: perm.id } },
      update: {},
      create: { userId: admin.id, permissionId: perm.id },
    });
  }

  console.log(`Seeded ${PERMISSION_DEFS.length} permissions and admin user (${adminEmail})`);
}

// ---------------------------------------------------------------------------
// Settings — configuration, never hard-coded (P7/R116), mirrors Ch.17 §12.9.
// ---------------------------------------------------------------------------

async function seedSettings() {
  const settings: Array<{ key: string; value: any; description: string }> = [
    { key: 'search_result_counters_enabled', value: false, description: 'R44 — off in v1' },
    { key: 'max_featured_per_category', value: 10, description: 'R114' },
    { key: 'featured_listing_prices', value: { '7': 890, '15': 1590, '30': 2490 }, description: 'Ch.11.3 — istaknut oglas, cena po trajanju (RSD)' },
    { key: 'auto_approve_listings', value: false, description: 'R119 — switch exists, off in v1' },
    {
      key: 'ranking_weights',
      value: { rating: 0.35, freshness: 0.25, responseTime: 0.2, random: 0.2 },
      description: 'R146 — search result ranking weights',
    },
    { key: 'daily_new_conversation_limit', value: 10, description: 'R77' },
    { key: 'listing_index_threshold', value: 3, description: 'R135' },
    { key: 'review_window_days', value: 14, description: 'Dizajn 43: days after a booking completes in which its guest can leave a review' },
    { key: 'review_edit_days', value: 7, description: 'Dizajn 43: days after a review goes public in which its author can change it' },
    { key: 'default_payment_deadline_hours', value: 48, description: 'R59' },
    {
      key: 'booking_request_response_hours',
      value: 48,
      description: 'Dizajn 41: hours an owner has to answer a booking request before it expires (sooner if the term starts first)',
    },
    { key: 'moderation_sla_hours', value: 24, description: 'R30' },
    {
      key: 'admin_new_booking_notifications',
      value: true,
      description: 'R182 — admin can turn off the "new booking" admin email once volume makes it noisy',
    },
    {
      key: 'homepage_video_url',
      value: null,
      description:
        'Ch.18.3 — YouTube/Vimeo/direct video URL for the homepage "how it works" section; section is hidden entirely while this is empty',
    },
    {
      key: 'homepage_video_thumbnail',
      value: null,
      description:
        'Poster image shown over the homepage "how it works" video before playback; uploaded from /admin/sadrzaj. Falls back to YouTube\'s own thumbnail when empty',
    },
  ];

  // Create-only, same reasoning as seedStaticPages/seedFaqs below — this
  // container reseeds on every restart, and an upsert-with-update here
  // would silently revert any admin's saved setting (e.g. the video URL
  // above) back to its seed default on the next restart.
  let created = 0;
  for (const setting of settings) {
    const existing = await prisma.setting.findUnique({ where: { key: setting.key } });
    if (existing) continue;
    await prisma.setting.create({ data: setting });
    created += 1;
  }
  console.log(created > 0 ? `Seeded ${created} settings` : 'Settings already seeded, skipped');
}

// ---------------------------------------------------------------------------
// Locations — Serbian regions + a representative set of cities (R179 requires
// this populated before launch; the full exhaustive municipality list is
// flagged in DOCUMENTATION.md as a pre-launch content task, not a code task).
// ---------------------------------------------------------------------------

async function seedLocations() {
  const data: Record<string, string[]> = {
    Beograd: ['Beograd'],
    Vojvodina: ['Novi Sad', 'Subotica', 'Zrenjanin', 'Pančevo', 'Sombor', 'Kikinda', 'Sremska Mitrovica'],
    Šumadija: ['Kragujevac', 'Kruševac', 'Jagodina', 'Čačak', 'Gornji Milanovac'],
    'Zapadna Srbija': ['Užice', 'Valjevo', 'Šabac', 'Loznica'],
    'Istočna Srbija': ['Zaječar', 'Bor', 'Negotin', 'Kladovo'],
    'Južna Srbija': ['Niš', 'Leskovac', 'Vranje', 'Pirot', 'Prokuplje'],
    Kosovo: ['Kosovska Mitrovica'],
  };

  // Locative for headings like "Oglasi u Beogradu" (Dizajn 8). Listed rather
  // than derived: the ending changes irregularly (Šabac -> Šapcu, Čačak ->
  // Čačku) and two-word names decline the adjective too.
  const locative: Record<string, string> = {
    Beograd: 'Beogradu',
    'Novi Sad': 'Novom Sadu',
    Subotica: 'Subotici',
    Zrenjanin: 'Zrenjaninu',
    Pančevo: 'Pančevu',
    Sombor: 'Somboru',
    Kikinda: 'Kikindi',
    'Sremska Mitrovica': 'Sremskoj Mitrovici',
    Kragujevac: 'Kragujevcu',
    Kruševac: 'Kruševcu',
    Jagodina: 'Jagodini',
    Čačak: 'Čačku',
    'Gornji Milanovac': 'Gornjem Milanovcu',
    Užice: 'Užicu',
    Valjevo: 'Valjevu',
    Šabac: 'Šapcu',
    Loznica: 'Loznici',
    Zaječar: 'Zaječaru',
    Bor: 'Boru',
    Negotin: 'Negotinu',
    Kladovo: 'Kladovu',
    Niš: 'Nišu',
    Leskovac: 'Leskovcu',
    Vranje: 'Vranju',
    Pirot: 'Pirotu',
    Prokuplje: 'Prokuplju',
    'Kosovska Mitrovica': 'Kosovskoj Mitrovici',
  };

  const beogradAreas = [
    'Vračar',
    'Novi Beograd',
    'Zemun',
    'Stari Grad',
    'Savski Venac',
    'Voždovac',
    'Zvezdara',
    'Palilula',
    'Čukarica',
    'Rakovica',
  ];
  const novisadAreas = ['Stari Grad', 'Liman', 'Grbavica', 'Detelinara', 'Podbara', 'Petrovaradin'];

  for (const [regionName, cities] of Object.entries(data)) {
    const region = await prisma.region.upsert({
      where: { slug: slugify(regionName) },
      update: {},
      create: { name: regionName, slug: slugify(regionName) },
    });

    for (const cityName of cities) {
      const city = await prisma.city.upsert({
        where: { slug: slugify(cityName) },
        // Unlike the rest of this seed, the locative is backfilled on every
        // run: it was added after these rows already existed, and it is
        // reference data no admin edits, so there is nothing to overwrite.
        update: { nameLocative: locative[cityName] ?? null },
        create: {
          regionId: region.id,
          name: cityName,
          slug: slugify(cityName),
          nameLocative: locative[cityName] ?? null,
        },
      });

      const areas = cityName === 'Beograd' ? beogradAreas : cityName === 'Novi Sad' ? novisadAreas : [];
      for (const areaName of areas) {
        await prisma.cityArea.upsert({
          where: { cityId_slug: { cityId: city.id, slug: slugify(areaName) } },
          update: {},
          create: { cityId: city.id, name: areaName, slug: slugify(areaName) },
        });
      }
    }
  }
  console.log('Seeded regions, cities and city areas');
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    č: 'c',
    ć: 'c',
    ž: 'z',
    š: 's',
    đ: 'dj',
    Č: 'c',
    Ć: 'c',
    Ž: 'z',
    Š: 's',
    Đ: 'dj',
  };
  return input
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Categories — the 7 mandatory top-level categories (Ch.3 §3.1) with a
// representative attribute set per category (Bible leaves the exact list open
// as O16; this is a documented assumption — see DOCUMENTATION.md).
// ---------------------------------------------------------------------------

interface AttributeSeed {
  key: string;
  name: string;
  type: AttributeType;
  required?: boolean;
  unit?: string;
  isFilter?: boolean;
  filterType?: FilterType;
  showOnCard?: boolean;
  /** Kategorije spec §5 (Mašine) — only shown once the sibling attribute keyed
   * `dependsOnAttrKey` has the option `dependsOnOptionKey` selected. */
  dependsOnAttrKey?: string;
  dependsOnOptionKey?: string;
  options?: Array<{ key: string; name: string }>;
}

interface CategorySeed {
  name: string;
  defaultBookingModel: BookingModel;
  allowedPriceUnits: PriceUnit[];
  defaultPriceUnit: PriceUnit;
  icon: string;
  /** Dizajn 17 — the grey line under the category's card on /oglasi/novi, copy from frame 172:287. */
  shortDescription?: string;
  /**
   * Dizajn 50: whether a new database shows the category on the site. Only
   * written when the row is created; after that it belongs to the admin's
   * "Prikaži na sajtu" switch, so a reseed never publishes or hides one.
   */
  published?: boolean;
  attributes: AttributeSeed[];
  children?: CategorySeed[];
}

/** Kategorije spec's "Vrednosti" column → {key, name} option pairs. */
function opts(names: string[]): Array<{ key: string; name: string }> {
  return names.map((name) => ({ key: slugify(name), name }));
}

const AMENITIES_APARTMANI = opts([
  'Bazen — spoljašnji', 'Bazen — unutrašnji', 'Đakuzi', 'Sauna', 'Bademantil', 'Fen za kosu', 'Kafe aparat',
  'Kamin', 'Klima', 'Kuhinja', 'Ledomat', 'Ležaljke', 'Lift', 'Mašina za veš', 'Parking', 'Pegla', 'Peškiri',
  'Posteljina', 'Privatni ulaz', 'Pušenje dozvoljeno', 'Roštilj', 'Terasa', 'TV', 'WiFi', 'Kućni ljubimci dozvoljeni',
]);
const AMENITIES_KUCE = opts([
  'Bazen — spoljašnji', 'Bazen — unutrašnji', 'Bio sauna', 'Đakuzi', 'Fen za kosu', 'Finska sauna',
  'Igralište za decu', 'Kafe aparat', 'Kamin', 'Klima', 'Kuhinja', 'Ledomat', 'Ležaljke', 'Mašina za veš',
  'Ozvučenje', 'Parking', 'Pegla', 'Peškiri', 'Posteljina', 'Privatni ulaz', 'Pušenje dozvoljeno', 'Roštilj',
  'Sauna', 'Slana soba', 'Terasa', 'Tuš kabina', 'TV', 'WiFi', 'Kućni ljubimci dozvoljeni',
]);
// T115: rooms take pets too, for the "Ljubimci dozvoljeni" switch every
// Nekretnine page has.
const AMENITIES_SOBE = opts([
  'Bademantil', 'Fen za kosu', 'Kafe aparat', 'Kamin', 'Klima', 'Lift', 'Mašina za veš', 'Parking', 'Pegla',
  'Peškiri', 'Posteljina', 'Privatni ulaz', 'Pušenje dozvoljeno', 'Terasa', 'TV', 'WiFi', 'Kućni ljubimci dozvoljeni',
]);
const VEHICLE_BRANDS = opts([
  'Volkswagen', 'Opel', 'Renault', 'Peugeot', 'Fiat', 'Škoda', 'Ford', 'BMW', 'Mercedes-Benz', 'Audi',
  'Toyota', 'Hyundai', 'Kia', 'Dacia', 'Citroën', 'Ostalo',
]);

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Nekretnine',
    icon: 'home',
    shortDescription: 'Stanovi, kuće i vikendice',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH],
    defaultPriceUnit: PriceUnit.NIGHT,
    // Each subcategory below has its own, non-overlapping attribute set per
    // the Kategorije spec — nothing shared lives on this parent, since a
    // parent attribute would otherwise be inherited by every child alongside
    // that child's own (different) definition of the same concept.
    attributes: [],
    children: [
      {
        name: 'Stanovi',
        icon: 'building',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH],
        defaultPriceUnit: PriceUnit.NIGHT,
        attributes: [
          { key: 'kvadratura', name: 'Površina', type: AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'broj_soba', name: 'Broj soba', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Garsonjera', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5+']) },
          { key: 'broj_kreveta', name: 'Broj kreveta', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'sprat', name: 'Sprat', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Suteren', 'Prizemlje', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+', 'Potkrovlje']) },
          { key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT, options: AMENITIES_APARTMANI },
        ],
      },
      {
        name: 'Kuće i vikendice',
        icon: 'house',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH],
        defaultPriceUnit: PriceUnit.NIGHT,
        attributes: [
          { key: 'kvadratura', name: 'Površina', type: AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'broj_soba', name: 'Broj soba', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'broj_kreveta', name: 'Broj kreveta', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'broj_kupatila', name: 'Broj kupatila', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT, options: AMENITIES_KUCE },
        ],
      },
      {
        name: 'Sobe',
        icon: 'bed',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH],
        defaultPriceUnit: PriceUnit.NIGHT,
        attributes: [
          { key: 'kvadratura', name: 'Površina', type: AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'broj_kreveta', name: 'Broj kreveta', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'kupatilo', name: 'Kupatilo', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Privatno', 'Zajedničko']) },
          { key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT, options: AMENITIES_SOBE },
        ],
      },
    ],
  },
  {
    name: 'Prostori za proslave',
    icon: 'party',
    shortDescription: 'Sale, bašte i restorani',
    defaultBookingModel: BookingModel.PER_SLOT,
    allowedPriceUnits: [PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.SLOT,
    attributes: [
      { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
      { key: 'tip_prostora', name: 'Tip prostora', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Sala za proslave', 'Open Air prostor', 'Salaš', 'Restoran', 'Klub / Bar', 'Splav']) },
      { key: 'ketering', name: 'Ketering', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Uključen', 'Sopstveni ketering dozvoljen', 'Po dogovoru', 'Nije dostupan']) },
      {
        key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT,
        options: opts(['Bazen — spoljašnji', 'Bazen — unutrašnji', 'Đakuzi', 'Igralište za decu', 'Kafe aparat', 'Klima', 'Kuhinja', 'Kupatilo', 'Ledomat', 'Mikrofon', 'Ozvučenje', 'Parking', 'Privatni ulaz', 'Projektor', 'Pušenje dozvoljeno', 'Roštilj', 'Terasa', 'TV', 'WiFi']),
      },
    ],
    children: [
      { name: 'Sale za proslave', icon: 'hall', defaultBookingModel: BookingModel.PER_SLOT, allowedPriceUnits: [PriceUnit.SLOT, PriceUnit.GUEST], defaultPriceUnit: PriceUnit.SLOT, attributes: [] },
      { name: 'Konferencijske sale', icon: 'meeting', defaultBookingModel: BookingModel.PER_SLOT, allowedPriceUnits: [PriceUnit.HOUR], defaultPriceUnit: PriceUnit.HOUR, attributes: [] },
    ],
  },
  {
    name: 'Igraonice',
    icon: 'toy',
    shortDescription: 'Igraonice i rođendaonice',
    defaultBookingModel: BookingModel.PER_SLOT,
    allowedPriceUnits: [PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.SLOT,
    attributes: [
      { key: 'kapacitet_dece', name: 'Kapacitet dece', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
      // T115: "4-6 godina" and "7-10 godina", and the last bracket starts at
      // 11 so 10 sits in one only. The keys stay the old names' slugs, so the
      // brackets owners ticked stay ticked.
      {
        key: 'uzrast_dece', name: 'Uzrast dece', type: AttributeType.CHECKBOX_GROUP, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true,
        options: [
          { key: '1-3-godine', name: '1-3 godine' },
          { key: '4-6-godine', name: '4-6 godina' },
          { key: '7-10-godine', name: '7-10 godina' },
          { key: '10-godina', name: '11+ godina' },
        ],
      },
      // T115: no "Pušenje dozvoljeno" here, it is not something a playroom has.
      {
        key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT,
        options: opts(['Kafić / zona za roditelje', 'Klima', 'Parking', 'Privatni ulaz', 'WiFi', 'Animator dostupan', 'Trambolina', 'Tobogan', 'Lavirint / poligon', 'Bazen sa lopticama', 'Video igre / konzole', 'Kreativni sadržaji']),
      },
    ],
  },
  {
    name: 'Vozila',
    icon: 'car',
    shortDescription: 'Putnička i dostavna vozila',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY],
    defaultPriceUnit: PriceUnit.DAY,
    // Putnička/Dostavna get entirely separate attribute sets below — same
    // reasoning as Nekretnine's subcategories.
    attributes: [],
    children: [
      {
        name: 'Putnička vozila',
        icon: 'sedan',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.DAY],
        defaultPriceUnit: PriceUnit.DAY,
        attributes: [
          { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: AttributeType.YEAR, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'tip_vozila', name: 'Tip vozila', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Hatchback', 'SUV', 'Limuzina', 'Coupe', 'Kabriolet', 'Minivan']) },
          { key: 'marka_vozila', name: 'Marka vozila', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: VEHICLE_BRANDS },
          { key: 'broj_sedista', name: 'Broj sedišta', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['2', '4', '5', '6', '7', '8+']) },
          { key: 'menjac', name: 'Menjač', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Manuelni', 'Automatski']) },
          { key: 'gorivo', name: 'Gorivo', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Benzin', 'Dizel', 'Hibrid', 'Plug-in hibrid', 'Električno']) },
          { key: 'pogon', name: 'Pogon', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Prednji', 'Zadnji', '4x4']) },
          { key: 'oprema', name: 'Oprema', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT, options: opts(['GPS / navigacija', 'Klima', 'Krovni nosač', 'Parking senzori', 'Tempomat', 'TV', 'WiFi']) },
          // T115: new, a filter of its own in "Više filtera".
          { key: 'dostava_na_adresu', name: 'Dostava na adresu', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
        ],
      },
      {
        name: 'Dostavna vozila',
        icon: 'van',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.DAY],
        defaultPriceUnit: PriceUnit.DAY,
        attributes: [
          { key: 'tip_vozila', name: 'Tip vozila', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Pickup', 'Kombi', 'Kamion']) },
          { key: 'marka_vozila', name: 'Marka vozila', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: VEHICLE_BRANDS },
          { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: AttributeType.YEAR, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          // T38 — document explicitly asks for a dropdown of preset values
          // here, not a free numeric input; the option's own name carries the
          // unit since LIST rendering (wizard + detail page) never appends
          // `unit` the way NUMBER does.
          { key: 'nosivost', name: 'Nosivost', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['500 kg', '1000 kg', '1500 kg', '2000 kg', '3500 kg', '5000 kg', '7500 kg', '12000 kg', 'Preko 12000 kg']) },
          { key: 'zapremina_tovarnog_prostora', name: 'Zapremina tovarnog prostora', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['1 m³', '2 m³', '3 m³', '5 m³', '8 m³', '10 m³', '15 m³', 'Preko 15 m³']) },
          { key: 'duzina_tovarnog_prostora', name: 'Dužina tovarnog prostora', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['1 m', '1.5 m', '2 m', '2.5 m', '3 m', '4 m', '5 m', 'Preko 5 m']) },
          { key: 'sirina_tovarnog_prostora', name: 'Širina tovarnog prostora', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['1 m', '1.3 m', '1.5 m', '1.8 m', '2 m', 'Preko 2 m']) },
          { key: 'visina_tovarnog_prostora', name: 'Visina tovarnog prostora', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['1 m', '1.3 m', '1.5 m', '1.8 m', '2 m', 'Preko 2 m']) },
          { key: 'menjac', name: 'Menjač', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Manuelni', 'Automatski']) },
          { key: 'gorivo', name: 'Gorivo', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Benzin', 'Dizel', 'Hibrid', 'Plug-in hibrid', 'Električno']) },
          { key: 'pogon', name: 'Pogon', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Prednji', 'Zadnji', '4x4']) },
          { key: 'oprema', name: 'Oprema', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT, options: opts(['GPS / navigacija', 'Klima', 'Parking senzori', 'Tempomat']) },
          { key: 'dostava_na_adresu', name: 'Dostava na adresu', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
        ],
      },
    ],
  },
  {
    name: 'Magacini i skladišta',
    icon: 'warehouse',
    shortDescription: 'Magacini, skladišta i hladnjače',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.MONTH],
    defaultPriceUnit: PriceUnit.MONTH,
    attributes: [
      // T66 — kept as wizard/detail fields (required, showOnCard) but
      // intentionally not a search filter — the document explicitly asked
      // for these to be left out of the /pretraga panel for now. T115 puts
      // Površina back in the bar ("od 20 m²" and up, SEARCH_FILTERS).
      // T40 — dropdown of preset values instead of free numeric input; the
      // option's own name carries the unit since LIST rendering never
      // appends `unit` the way NUMBER does.
      { key: 'povrsina', name: 'Površina', type: AttributeType.LIST, required: true, showOnCard: true, options: opts(['20 m²', '50 m²', '100 m²', '200 m²', '300 m²', '500 m²', '1000 m²', 'Preko 1000 m²']) },
      { key: 'visina_prostora', name: 'Visina prostora', type: AttributeType.LIST, required: true, showOnCard: true, options: opts(['2 m', '2.5 m', '3 m', '4 m', '5 m', '6 m', 'Preko 6 m']) },
      { key: 'tip_prostora', name: 'Tip prostora', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Privatni magacin', 'Poslovni magacin', 'Industrijski magacin', 'Skladišni prostor', 'Hladnjača']) },
      {
        key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT,
        options: opts(['Alarm / sigurnosni sistem', 'Video nadzor / kamere', 'Protivpožarni sistem', 'Grejanje', 'Klima', 'Paletni regali / police', 'Parking', 'Pristup kamionima', 'Rampa za utovar']),
      },
    ],
  },
  {
    name: 'Građevinske mašine',
    icon: 'excavator',
    shortDescription: 'Bageri, viljuškari, platforme',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY],
    defaultPriceUnit: PriceUnit.DAY,
    // Kategorije spec §5 — "ne praviti ogromnu fiksnu hijerarhiju": every
    // machine type lives as ONE category with a gating `tip_masine` SELECT
    // plus per-type attributes conditioned on it via dependsOnAttrKey/
    // dependsOnOptionKey, so a new machine type later is pure data (a new
    // option + a few dependent rows), never a schema or wizard code change.
    attributes: [
      // T67 — the /pretraga filter panel for this category shows exactly
      // Tip mašine / Sa rukovaocem / Dostava na lokaciju and nothing else;
      // every other attribute below keeps its wizard/detail behavior
      // (required, showOnCard, dependsOn...) but is no longer isFilter.
      { key: 'tip_masine', name: 'Tip mašine', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Bager', 'Dizalica / Kran', 'Mini mašina', 'Platforma za rad na visini', 'Transporter / Mini damper', 'Viljuškar']) },
      { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: AttributeType.YEAR, showOnCard: true },
      { key: 'vrsta_pogona', name: 'Vrsta pogona', type: AttributeType.LIST, required: true, showOnCard: true, options: opts(['Dizel', 'Benzin', 'Električni', 'Hibridni']) },
      { key: 'stanje_masine', name: 'Stanje mašine', type: AttributeType.LIST, options: opts(['Novo', 'Polovno', 'Za delove']) },
      // T39 — document explicitly asks for a dropdown of preset values on
      // every numeric field below, not free numeric input; the option's own
      // name carries the unit since LIST rendering never appends `unit`.
      { key: 'tezina_masine', name: 'Težina mašine', type: AttributeType.LIST, options: opts(['500 kg', '1000 kg', '2000 kg', '3000 kg', '5000 kg', '8000 kg', '12000 kg', '20000 kg', 'Preko 20000 kg']) },
      { key: 'snaga_motora', name: 'Snaga motora', type: AttributeType.LIST, options: opts(['10 kW', '20 kW', '30 kW', '50 kW', '75 kW', '100 kW', '150 kW', 'Preko 150 kW']) },
      { key: 'sa_rukovaocem', name: 'Sa rukovaocem', type: AttributeType.BOOLEAN, required: true, isFilter: true, filterType: FilterType.TOGGLE, showOnCard: true },
      { key: 'dostava_na_lokaciju', name: 'Dostava na lokaciju', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE, showOnCard: true },

      // -- Bager --
      { key: 'tip_bagera', name: 'Tip bagera', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Guseničar', 'Točkaš', 'Mini bager', 'Bager-utovarivač']) },
      { key: 'max_dubina_kopanja', name: 'Maksimalna dubina kopanja', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['1 m', '2 m', '3 m', '4 m', '5 m', '6 m', 'Preko 6 m']) },
      { key: 'max_radna_visina_bager', name: 'Maksimalna radna visina', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['3 m', '4 m', '5 m', '6 m', '7 m', 'Preko 7 m']) },
      { key: 'zapremina_kasike', name: 'Zapremina kašike', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['0.05 m³', '0.1 m³', '0.2 m³', '0.3 m³', '0.5 m³', '0.75 m³', 'Preko 0.75 m³']) },
      { key: 'tip_kabine_bager', name: 'Tip kabine', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Otvorena', 'Zatvorena', 'Klimatizovana']) },
      { key: 'prikljucci_bager', name: 'Priključci', type: AttributeType.CHECKBOX_GROUP, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Standardna kašika', 'Hidraulični čekić', 'Grajfer', 'Bušilica / svrdlo', 'Rotirajuća kašika', 'Hidraulični adapteri', 'Tanjirasti priključak', 'Specijalni alati']) },
      { key: 'oprema_bager', name: 'Oprema', type: AttributeType.CHECKBOX_GROUP, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Daljinsko upravljanje', 'Digitalni displej / kontrolni panel', 'GPS / navigacija', 'Grejanje kabine', 'Klima u kabini', 'LED / radna svetla', 'Parking senzori', 'Sigurnosni pojasevi', 'Telematika / praćenje radnih sati']) },

      // -- Dizalica / Kran --
      { key: 'tip_dizalice', name: 'Tip dizalice / krana', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Toranjski', 'Mobilni', 'Gusenični', 'Auto-dizalica']) },
      { key: 'nosivost_dizalica', name: 'Nosivost', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['1000 kg', '3000 kg', '5000 kg', '10000 kg', '20000 kg', 'Preko 20000 kg']) },
      { key: 'max_visina_dizanja_dizalica', name: 'Maksimalna visina dizanja', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['10 m', '20 m', '30 m', '50 m', '75 m', 'Preko 75 m']) },
      { key: 'horizontalni_domet', name: 'Horizontalni domet', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['10 m', '20 m', '30 m', '40 m', 'Preko 40 m']) },
      { key: 'tip_kabine_dizalica', name: 'Tip kabine', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Otvorena', 'Zatvorena', 'Klimatizovana']) },
      { key: 'stabilizatori', name: 'Stabilizatori', type: AttributeType.BOOLEAN, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran' },
      { key: 'nacin_montaze', name: 'Način montaže', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Fiksna', 'Mobilna', 'Vučna']) },

      // -- Mini mašina --
      { key: 'tip_mini_masine', name: 'Tip mini mašine', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'mini-masina', options: opts(['Mini utovarivač', 'Mini bager', 'Mini damper']) },

      // -- Platforma za rad na visini --
      { key: 'tip_platforme', name: 'Tip platforme', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['Škarasta', 'Zglobna', 'Teleskopska', 'Guseničarska']) },
      { key: 'max_radna_visina_platforma', name: 'Maksimalna radna visina', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['6 m', '8 m', '10 m', '12 m', '16 m', '20 m', 'Preko 20 m']) },
      { key: 'nosivost_platforma', name: 'Nosivost', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['120 kg', '200 kg', '230 kg', '300 kg', '450 kg', 'Preko 450 kg']) },
      { key: 'radni_prostor_platforma', name: 'Radni prostor', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['Unutrašnji', 'Spoljašnji', 'Oba']) },
      { key: 'radni_domet_platforma', name: 'Radni domet', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['3 m', '5 m', '7 m', '10 m', 'Preko 10 m']) },

      // -- Transporter / Mini damper --
      { key: 'tip_transportera', name: 'Tip transportera', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['Gusenični', 'Točkaš']) },
      { key: 'nosivost_transporter', name: 'Nosivost', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['500 kg', '1000 kg', '1500 kg', '2000 kg', '3000 kg', 'Preko 3000 kg']) },
      { key: 'zapremina_korpe', name: 'Zapremina korpe', type: AttributeType.LIST, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['0.3 m³', '0.5 m³', '0.75 m³', '1 m³', 'Preko 1 m³']) },
      { key: 'visina_istovara', name: 'Visina istovara', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['0.5 m', '1 m', '1.5 m', '2 m', 'Preko 2 m']) },
      { key: 'nacin_kipovanja', name: 'Način kipovanja', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['Zadnje', 'Bočno', 'Trostrano']) },

      // -- Viljuškar --
      { key: 'tip_viljuskara', name: 'Tip viljuškara', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['Dizel', 'Elektro', 'Gas', 'Teleskopski']) },
      { key: 'nosivost_viljuskar', name: 'Nosivost', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['1000 kg', '1500 kg', '2000 kg', '2500 kg', '3000 kg', '5000 kg', 'Preko 5000 kg']) },
      { key: 'max_visina_dizanja_viljuskar', name: 'Maksimalna visina dizanja', type: AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['3 m', '4 m', '5 m', '6 m', '7 m', 'Preko 7 m']) },
      { key: 'radni_prostor_viljuskar', name: 'Radni prostor', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['Unutrašnji', 'Spoljašnji']) },
      { key: 'radni_domet_viljuskar', name: 'Radni domet', type: AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['0.5 m', '1 m', '1.5 m', '2 m', 'Preko 2 m']) },
    ],
  },
  // Fallback parent for rejected category proposals and "Otključaj svoju
  // kategoriju" intake listings (R6/§3.1, Kategorije spec §8). Dizajn 50 makes
  // it the seventh category, last and without subcategories, shown wherever
  // the other six are once the owner publishes it in /admin/kategorije; a new
  // database creates it unpublished. allowedPriceUnits covers every unit the
  // intake form can send (R25's DB trigger rejects anything outside a
  // listing's category's allowed set), since the real category, and its real
  // constraint, isn't assigned until an admin reviews it.
  {
    name: 'Ostalo',
    icon: 'other',
    published: false,
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY, PriceUnit.NIGHT, PriceUnit.MONTH, PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.DAY,
    attributes: [],
  },
];

// T129: the taxonomy belongs to the admin panel now. The seed only fills an
// empty database (seedCategories) and never updates, reorders or deletes a
// row, so a reseed can no longer undo what an admin changed in
// Administracija > Kategorije.
async function setTranslationIfMissing(
  entityType: 'CATEGORY' | 'ATTRIBUTE' | 'OPTION',
  entityId: string,
  field: string,
  sr: string,
) {
  await prisma.translation.upsert({
    where: { entityType_entityId_field_language: { entityType, entityId, field, language: Language.SR } },
    update: {},
    create: { entityType, entityId, field, language: Language.SR, value: sr },
  });
}

// T129: the key facts of the cards (up to 3) and of the listing page strip (up
// to 6), by category slug. The admin panel edits them afterwards; migration
// 20261010170000_attribute_admin wrote the same lists into existing databases.
const SEED_FACT_KEYS: Record<string, { card: string[]; listing: string[] }> = {
  stanovi: { card: ['kapacitet_ljudi', 'broj_soba', 'kvadratura'], listing: ['kapacitet_ljudi', 'broj_soba', 'broj_kreveta', 'sprat', 'kvadratura'] },
  'kuce-i-vikendice': { card: ['kapacitet_ljudi', 'broj_soba', 'kvadratura'], listing: ['kapacitet_ljudi', 'broj_soba', 'broj_kreveta', 'broj_kupatila', 'kvadratura'] },
  sobe: { card: ['kapacitet_ljudi', 'broj_soba', 'kvadratura'], listing: ['kapacitet_ljudi', 'broj_kreveta', 'kupatilo', 'kvadratura'] },
  'sale-za-proslave': { card: ['kapacitet_ljudi', 'tip_prostora', 'ketering'], listing: ['kapacitet_ljudi', 'tip_prostora', 'ketering'] },
  'konferencijske-sale': { card: ['kapacitet_ljudi', 'tip_prostora', 'ketering'], listing: ['kapacitet_ljudi', 'tip_prostora', 'ketering'] },
  igraonice: { card: ['kapacitet_dece', 'uzrast_dece', 'kvadratura'], listing: ['kapacitet_dece', 'uzrast_dece'] },
  'putnicka-vozila': { card: ['broj_sedista', 'menjac', 'godina_proizvodnje'], listing: ['broj_sedista', 'menjac', 'gorivo', 'godina_proizvodnje'] },
  'dostavna-vozila': { card: ['nosivost', 'zapremina_tovarnog_prostora', 'godina_proizvodnje'], listing: ['nosivost', 'zapremina_tovarnog_prostora', 'menjac', 'godina_proizvodnje'] },
  'magacini-i-skladista': { card: ['povrsina', 'visina_prostora', 'tip_prostora'], listing: ['povrsina', 'visina_prostora', 'tip_prostora'] },
  'gradjevinske-masine': { card: ['tip_masine', 'snaga_motora', 'tezina_masine'], listing: ['tip_masine', 'snaga_motora', 'tezina_masine', 'godina_proizvodnje'] },
};

async function seedCategoryNode(node: CategorySeed, parentId: string | null, order: number) {
  const slug = slugify(node.name);
  const category = await prisma.category.upsert({
    where: { slug },
    update: {},
    create: {
      parentId,
      level: parentId ? 2 : 1,
      slug,
      icon: node.icon,
      defaultBookingModel: node.defaultBookingModel,
      allowedPriceUnits: node.allowedPriceUnits,
      defaultPriceUnit: node.defaultPriceUnit,
      // Dizajn 46: counted from 0, so Ostalo (Dizajn 50) is 6, the seventh and last.
      displayOrder: order,
      published: node.published ?? true,
      cardFactKeys: SEED_FACT_KEYS[slug]?.card ?? [],
      listingFactKeys: SEED_FACT_KEYS[slug]?.listing ?? [],
    },
  });

  await setTranslationIfMissing('CATEGORY', category.id, 'name', node.name);
  if (node.shortDescription) {
    await setTranslationIfMissing('CATEGORY', category.id, 'shortDescription', node.shortDescription);
  }

  for (const [i, attr] of node.attributes.entries()) {
    const attribute = await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: category.id, key: attr.key } },
      update: {},
      create: {
        categoryId: category.id,
        key: attr.key,
        type: attr.type,
        required: attr.required ?? false,
        unit: attr.unit,
        isFilter: attr.isFilter ?? false,
        filterType: attr.filterType,
        showOnCard: attr.showOnCard ?? false,
        dependsOnAttrKey: attr.dependsOnAttrKey,
        dependsOnOptionKey: attr.dependsOnOptionKey,
        displayOrder: i,
      },
    });
    await setTranslationIfMissing('ATTRIBUTE', attribute.id, 'name', attr.name);

    for (const [j, opt] of (attr.options ?? []).entries()) {
      const option = await prisma.attributeOption.upsert({
        where: { attributeId_key: { attributeId: attribute.id, key: opt.key } },
        update: {},
        create: { attributeId: attribute.id, key: opt.key, displayOrder: j },
      });
      await setTranslationIfMissing('OPTION', option.id, 'name', opt.name);
    }
  }

  // T115: the category's /pretraga filters, created when missing.
  for (const [i, filter] of (SEARCH_FILTERS[slug] ?? []).entries()) {
    await prisma.categoryFilter.upsert({
      where: { categoryId_key: { categoryId: category.id, key: filter.key } },
      update: {},
      create: {
        categoryId: category.id,
        key: filter.key,
        attributeKey: filter.attributeKey === undefined ? filter.key : filter.attributeKey,
        optionKey: filter.optionKey ?? null,
        placement: filter.placement,
        control: filter.control,
        thresholds: filter.thresholds ?? [],
        displayOrder: i,
      },
    });
  }

  for (const [i, child] of (node.children ?? []).entries()) {
    await seedCategoryNode(child, category.id, i);
  }
}

async function seedCategories() {
  // T129: an admin may delete a seeded category, attribute or option; seeding
  // into a database that already has a taxonomy would bring it back.
  if ((await prisma.category.count()) > 0) {
    console.log('Categories already exist, the taxonomy is left to the admin panel');
    return;
  }
  for (const [i, node] of CATEGORY_TREE.entries()) {
    await seedCategoryNode(node, null, i);
  }
  console.log(`Seeded ${CATEGORY_TREE.length} top-level categories with subcategories and attributes`);
}

// ---------------------------------------------------------------------------

async function seedEmailTemplates() {
  for (const template of emailTemplates) {
    for (const language of [Language.SR, Language.EN] as const) {
      const copy = template[language === Language.SR ? 'sr' : 'en'];
      await prisma.emailTemplate.upsert({
        where: { key_language: { key: template.key, language } },
        // T129: create-only, an admin edit in E-mail sabloni survives a reseed.
        update: {},
        create: { key: template.key, language, ...copy },
      });
    }
  }
  console.log(`Seeded ${emailTemplates.length} email templates x 2 languages`);
}

// Create-only, like seedEmailTemplates above (T129). This container reseeds on
// every restart (see docker-compose.yml), and once an admin has edited a
// page or FAQ item through /admin/sadrzaj, a reseed must never clobber it.
async function seedStaticPages() {
  let created = 0;
  for (const page of staticPages) {
    for (const language of [Language.SR, Language.EN] as const) {
      const copy = page[language === Language.SR ? 'sr' : 'en'];
      const existing = await prisma.staticPage.findUnique({ where: { slug_language: { slug: page.slug, language } } });
      if (existing) continue;
      await prisma.staticPage.create({ data: { slug: page.slug, language, ...copy } });
      created += 1;
    }
  }
  console.log(created > 0 ? `Seeded ${created} static page rows` : 'Static pages already seeded, skipped');
}

async function seedFaqs() {
  const existingCount = await prisma.faq.count();
  if (existingCount > 0) {
    console.log('FAQ already seeded, skipped');
    return;
  }
  for (const [index, faq] of faqs.entries()) {
    for (const language of [Language.SR, Language.EN] as const) {
      const copy = faq[language === Language.SR ? 'sr' : 'en'];
      await prisma.faq.create({ data: { language, displayOrder: index, ...copy } });
    }
  }
  console.log(`Seeded ${faqs.length} FAQ items x 2 languages`);
}

// The backend keeps copies of categories, locations, packages and settings in
// Redis for up to half an hour, and a reseed rewrites exactly those rows (the
// category order of Dizajn 46, for one). A backend that starts after the seed
// drops them itself when it connects; this covers one that is already running.
// Redis being out of reach is no reason to fail the seed.
async function clearDerivedCache() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => undefined); // the failed connect() below reports it
  try {
    await redis.connect();
    for (const prefix of DERIVED_KEY_PREFIXES) await deleteByPrefix(redis, prefix);
    console.log(`Cleared the cached ${DERIVED_KEY_PREFIXES.join(', ')} keys`);
  } catch (err) {
    console.warn(
      `Redis cache not cleared (${(err as Error).message}): a running backend can show the old categories for up to 30 minutes, or until it restarts`,
    );
  } finally {
    redis.disconnect();
  }
}

async function main() {
  await seedPackages();
  await seedPermissionsAndAdmin();
  await seedSettings();
  await seedLocations();
  await seedCategories();
  await seedEmailTemplates();
  await seedStaticPages();
  await seedFaqs();
  await clearDerivedCache();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
