import { PrismaClient, Language, BookingModel, PriceUnit, AttributeType, FilterType } from '@prisma/client';
import * as argon2 from 'argon2';
import { emailTemplates } from './email-templates.seed-data';
import { staticPages } from './static-pages.seed-data';
import { faqs } from './faqs.seed-data';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Translations helper — every category/attribute/option name goes through the
// Translation table (R137), never a hard-coded _sr/_en column.
// ---------------------------------------------------------------------------

async function setTranslation(
  entityType: 'CATEGORY' | 'ATTRIBUTE' | 'OPTION' | 'PAGE',
  entityId: string,
  field: string,
  sr: string,
) {
  await prisma.translation.upsert({
    where: { entityType_entityId_field_language: { entityType, entityId, field, language: Language.SR } },
    update: { value: sr },
    create: { entityType, entityId, field, language: Language.SR, value: sr },
  });
}

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
    { key: 'grace_period_days', value: 7, description: 'R113' },
    { key: 'listing_index_threshold', value: 3, description: 'R135' },
    { key: 'review_window_days', value: 14, description: 'R96' },
    { key: 'default_payment_deadline_hours', value: 48, description: 'R59' },
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
        update: {},
        create: { regionId: region.id, name: cityName, slug: slugify(cityName) },
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
const AMENITIES_SOBE = opts([
  'Bademantil', 'Fen za kosu', 'Kafe aparat', 'Kamin', 'Klima', 'Lift', 'Mašina za veš', 'Parking', 'Pegla',
  'Peškiri', 'Posteljina', 'Privatni ulaz', 'Pušenje dozvoljeno', 'Terasa', 'TV', 'WiFi',
]);
const VEHICLE_BRANDS = opts([
  'Volkswagen', 'Opel', 'Renault', 'Peugeot', 'Fiat', 'Škoda', 'Ford', 'BMW', 'Mercedes-Benz', 'Audi',
  'Toyota', 'Hyundai', 'Kia', 'Dacia', 'Citroën', 'Ostalo',
]);

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Nekretnine',
    icon: 'home',
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
        allowedPriceUnits: [PriceUnit.NIGHT],
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
      { name: 'Sale za proslave', icon: 'hall', defaultBookingModel: BookingModel.PER_SLOT, allowedPriceUnits: [PriceUnit.HOUR, PriceUnit.SLOT], defaultPriceUnit: PriceUnit.SLOT, attributes: [] },
      { name: 'Konferencijske sale', icon: 'meeting', defaultBookingModel: BookingModel.PER_SLOT, allowedPriceUnits: [PriceUnit.HOUR], defaultPriceUnit: PriceUnit.HOUR, attributes: [] },
    ],
  },
  {
    name: 'Igraonice',
    icon: 'toy',
    defaultBookingModel: BookingModel.PER_SLOT,
    allowedPriceUnits: [PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.SLOT,
    attributes: [
      { key: 'kapacitet_dece', name: 'Kapacitet dece', type: AttributeType.NUMBER, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
      { key: 'uzrast_dece', name: 'Uzrast dece', type: AttributeType.CHECKBOX_GROUP, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['1–3 godine', '4–6 godine', '7–10 godine', '10+ godina']) },
      {
        key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT,
        options: opts(['Kafić / zona za roditelje', 'Klima', 'Parking', 'Privatni ulaz', 'Pušenje dozvoljeno', 'WiFi', 'Animator dostupan', 'Trambolina', 'Tobogan', 'Lavirint / poligon', 'Bazen sa lopticama', 'Video igre / konzole', 'Kreativni sadržaji']),
      },
    ],
  },
  {
    name: 'Vozila',
    icon: 'car',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR],
    defaultPriceUnit: PriceUnit.DAY,
    // Putnička/Dostavna get entirely separate attribute sets below — same
    // reasoning as Nekretnine's subcategories.
    attributes: [],
    children: [
      {
        name: 'Putnička vozila',
        icon: 'sedan',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR],
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
        ],
      },
      {
        name: 'Dostavna vozila',
        icon: 'van',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR],
        defaultPriceUnit: PriceUnit.DAY,
        attributes: [
          { key: 'tip_vozila', name: 'Tip vozila', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Pickup', 'Kombi', 'Kamion']) },
          { key: 'marka_vozila', name: 'Marka vozila', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: VEHICLE_BRANDS },
          { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: AttributeType.YEAR, required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'nosivost', name: 'Nosivost', type: AttributeType.NUMBER, unit: 'kg', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'zapremina_tovarnog_prostora', name: 'Zapremina tovarnog prostora', type: AttributeType.NUMBER, unit: 'm³', isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
          { key: 'duzina_tovarnog_prostora', name: 'Dužina tovarnog prostora', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE },
          { key: 'sirina_tovarnog_prostora', name: 'Širina tovarnog prostora', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE },
          { key: 'visina_tovarnog_prostora', name: 'Visina tovarnog prostora', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE },
          { key: 'menjac', name: 'Menjač', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Manuelni', 'Automatski']) },
          { key: 'gorivo', name: 'Gorivo', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Benzin', 'Dizel', 'Hibrid', 'Plug-in hibrid', 'Električno']) },
          { key: 'pogon', name: 'Pogon', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Prednji', 'Zadnji', '4x4']) },
          { key: 'oprema', name: 'Oprema', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT, options: opts(['GPS / navigacija', 'Klima', 'Parking senzori', 'Tempomat']) },
        ],
      },
    ],
  },
  {
    name: 'Građevinske mašine',
    icon: 'excavator',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY],
    defaultPriceUnit: PriceUnit.DAY,
    // Kategorije spec §5 — "ne praviti ogromnu fiksnu hijerarhiju": every
    // machine type lives as ONE category with a gating `tip_masine` SELECT
    // plus per-type attributes conditioned on it via dependsOnAttrKey/
    // dependsOnOptionKey, so a new machine type later is pure data (a new
    // option + a few dependent rows), never a schema or wizard code change.
    attributes: [
      { key: 'tip_masine', name: 'Tip mašine', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Bager', 'Dizalica / Kran', 'Mini mašina', 'Platforma za rad na visini', 'Transporter / Mini damper', 'Viljuškar']) },
      { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: AttributeType.YEAR, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
      { key: 'vrsta_pogona', name: 'Vrsta pogona', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Dizel', 'Benzin', 'Električni', 'Hibridni']) },
      { key: 'stanje_masine', name: 'Stanje mašine', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: opts(['Novo', 'Polovno', 'Za delove']) },
      { key: 'tezina_masine', name: 'Težina mašine', type: AttributeType.NUMBER, unit: 'kg', isFilter: true, filterType: FilterType.RANGE },
      { key: 'snaga_motora', name: 'Snaga motora', type: AttributeType.NUMBER, unit: 'kW', isFilter: true, filterType: FilterType.RANGE },
      { key: 'sa_rukovaocem', name: 'Sa rukovaocem', type: AttributeType.BOOLEAN, required: true, isFilter: true, filterType: FilterType.TOGGLE, showOnCard: true },
      { key: 'dostava_na_lokaciju', name: 'Dostava na lokaciju', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE, showOnCard: true },

      // -- Bager --
      { key: 'tip_bagera', name: 'Tip bagera', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Guseničar', 'Točkaš', 'Mini bager', 'Bager-utovarivač']) },
      { key: 'max_dubina_kopanja', name: 'Maksimalna dubina kopanja', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager' },
      { key: 'max_radna_visina_bager', name: 'Maksimalna radna visina', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager' },
      { key: 'zapremina_kasike', name: 'Zapremina kašike', type: AttributeType.NUMBER, unit: 'm³', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager' },
      { key: 'tip_kabine_bager', name: 'Tip kabine', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Otvorena', 'Zatvorena', 'Klimatizovana']) },
      { key: 'prikljucci_bager', name: 'Priključci', type: AttributeType.CHECKBOX_GROUP, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Standardna kašika', 'Hidraulični čekić', 'Grajfer', 'Bušilica / svrdlo', 'Rotirajuća kašika', 'Hidraulični adapteri', 'Tanjirasti priključak', 'Specijalni alati']) },
      { key: 'oprema_bager', name: 'Oprema', type: AttributeType.CHECKBOX_GROUP, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Daljinsko upravljanje', 'Digitalni displej / kontrolni panel', 'GPS / navigacija', 'Grejanje kabine', 'Klima u kabini', 'LED / radna svetla', 'Parking senzori', 'Sigurnosni pojasevi', 'Telematika / praćenje radnih sati']) },

      // -- Dizalica / Kran --
      { key: 'tip_dizalice', name: 'Tip dizalice / krana', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Toranjski', 'Mobilni', 'Gusenični', 'Auto-dizalica']) },
      { key: 'nosivost_dizalica', name: 'Nosivost', type: AttributeType.NUMBER, unit: 'kg', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran' },
      { key: 'max_visina_dizanja_dizalica', name: 'Maksimalna visina dizanja', type: AttributeType.NUMBER, unit: 'm', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran' },
      { key: 'horizontalni_domet', name: 'Horizontalni domet', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran' },
      { key: 'tip_kabine_dizalica', name: 'Tip kabine', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Otvorena', 'Zatvorena', 'Klimatizovana']) },
      { key: 'stabilizatori', name: 'Stabilizatori', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran' },
      { key: 'nacin_montaze', name: 'Način montaže', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Fiksna', 'Mobilna', 'Vučna']) },

      // -- Mini mašina --
      { key: 'tip_mini_masine', name: 'Tip mini mašine', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'mini-masina', options: opts(['Mini utovarivač', 'Mini bager', 'Mini damper']) },

      // -- Platforma za rad na visini --
      { key: 'tip_platforme', name: 'Tip platforme', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['Škarasta', 'Zglobna', 'Teleskopska', 'Guseničarska']) },
      { key: 'max_radna_visina_platforma', name: 'Maksimalna radna visina', type: AttributeType.NUMBER, unit: 'm', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini' },
      { key: 'nosivost_platforma', name: 'Nosivost', type: AttributeType.NUMBER, unit: 'kg', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini' },
      { key: 'radni_prostor_platforma', name: 'Radni prostor', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['Unutrašnji', 'Spoljašnji', 'Oba']) },
      { key: 'radni_domet_platforma', name: 'Radni domet', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini' },

      // -- Transporter / Mini damper --
      { key: 'tip_transportera', name: 'Tip transportera', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['Gusenični', 'Točkaš']) },
      { key: 'nosivost_transporter', name: 'Nosivost', type: AttributeType.NUMBER, unit: 'kg', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper' },
      { key: 'zapremina_korpe', name: 'Zapremina korpe', type: AttributeType.NUMBER, unit: 'm³', isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper' },
      { key: 'visina_istovara', name: 'Visina istovara', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper' },
      { key: 'nacin_kipovanja', name: 'Način kipovanja', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['Zadnje', 'Bočno', 'Trostrano']) },

      // -- Viljuškar --
      { key: 'tip_viljuskara', name: 'Tip viljuškara', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['Dizel', 'Elektro', 'Gas', 'Teleskopski']) },
      { key: 'nosivost_viljuskar', name: 'Nosivost', type: AttributeType.NUMBER, unit: 'kg', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar' },
      { key: 'max_visina_dizanja_viljuskar', name: 'Maksimalna visina dizanja', type: AttributeType.NUMBER, unit: 'm', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar' },
      { key: 'radni_prostor_viljuskar', name: 'Radni prostor', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['Unutrašnji', 'Spoljašnji']) },
      { key: 'radni_domet_viljuskar', name: 'Radni domet', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar' },
    ],
  },
  {
    name: 'Magacini i skladišta',
    icon: 'warehouse',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.MONTH],
    defaultPriceUnit: PriceUnit.MONTH,
    attributes: [
      { key: 'povrsina', name: 'Površina', type: AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
      { key: 'visina_prostora', name: 'Visina prostora', type: AttributeType.NUMBER, unit: 'm', required: true, isFilter: true, filterType: FilterType.RANGE, showOnCard: true },
      { key: 'tip_prostora', name: 'Tip prostora', type: AttributeType.LIST, required: true, isFilter: true, filterType: FilterType.SELECT, showOnCard: true, options: opts(['Privatni magacin', 'Poslovni magacin', 'Industrijski magacin', 'Skladišni prostor', 'Hladnjača']) },
      {
        key: 'sadrzaji', name: 'Sadržaji', type: AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: FilterType.SELECT,
        options: opts(['Alarm / sigurnosni sistem', 'Video nadzor / kamere', 'Protivpožarni sistem', 'Grejanje', 'Klima', 'Paletni regali / police', 'Parking', 'Pristup kamionima', 'Rampa za utovar']),
      },
    ],
  },
  {
    name: 'Oprema',
    icon: 'tools',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR],
    defaultPriceUnit: PriceUnit.DAY,
    attributes: [
      { key: 'kategorija_opreme', name: 'Vrsta opreme', type: AttributeType.TEXT, isFilter: true, filterType: FilterType.SELECT, required: true },
      { key: 'stanje', name: 'Stanje', type: AttributeType.LIST, isFilter: true, filterType: FilterType.SELECT, options: [{ key: 'novo', name: 'Novo' }, { key: 'polovno', name: 'Polovno' }] },
    ],
  },
  // Kategorije spec §7 — "u ovoj fazi nema zaključene strukture detalja",
  // kept ready for future attribute definitions without blocking launch.
  {
    name: 'Usluge',
    icon: 'services',
    defaultBookingModel: BookingModel.PER_SLOT,
    allowedPriceUnits: [PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.HOUR,
    attributes: [],
  },
  // Hidden fallback parent for rejected category proposals and "Otključaj
  // svoju kategoriju" intake listings (R6/§3.1, Kategorije spec §8) — never
  // shown in navigation, has no SEO page. allowedPriceUnits covers every
  // unit the intake form can send (R25's DB trigger rejects anything
  // outside a listing's category's allowed set), since the real category —
  // and its real constraint — isn't assigned until an admin reviews it.
  {
    name: 'Ostalo',
    icon: 'other',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY, PriceUnit.NIGHT, PriceUnit.MONTH, PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.DAY,
    attributes: [],
  },
];

async function seedCategoryNode(node: CategorySeed, parentId: string | null, order: number) {
  const slug = slugify(node.name);
  const category = await prisma.category.upsert({
    where: { slug },
    update: {
      parentId: parentId ?? undefined,
      icon: node.icon,
      defaultBookingModel: node.defaultBookingModel,
      allowedPriceUnits: node.allowedPriceUnits,
      defaultPriceUnit: node.defaultPriceUnit,
    },
    create: {
      parentId,
      level: parentId ? 2 : 1,
      slug,
      icon: node.icon,
      defaultBookingModel: node.defaultBookingModel,
      allowedPriceUnits: node.allowedPriceUnits,
      defaultPriceUnit: node.defaultPriceUnit,
      displayOrder: order,
    },
  });

  await setTranslation('CATEGORY', category.id, 'name', node.name);

  for (const [i, attr] of node.attributes.entries()) {
    const attrFields = {
      type: attr.type,
      required: attr.required ?? false,
      unit: attr.unit,
      isFilter: attr.isFilter ?? false,
      filterType: attr.filterType,
      showOnCard: attr.showOnCard ?? false,
      dependsOnAttrKey: attr.dependsOnAttrKey,
      dependsOnOptionKey: attr.dependsOnOptionKey,
      displayOrder: i,
    };
    const attribute = await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: category.id, key: attr.key } },
      // Unlike StaticPage/Faq/Setting, CategoryAttribute is site config an
      // admin doesn't hand-edit per install — same as Category itself above,
      // it re-syncs to this file on every reseed rather than create-only.
      update: attrFields,
      create: { categoryId: category.id, key: attr.key, ...attrFields },
    });
    await setTranslation('ATTRIBUTE', attribute.id, 'name', attr.name);

    const optionKeys = (attr.options ?? []).map((o) => o.key);
    const staleOptions = await prisma.attributeOption.findMany({
      where: { attributeId: attribute.id, key: { notIn: optionKeys.length ? optionKeys : ['__none__'] } },
    });
    for (const stale of staleOptions) {
      await prisma.attributeOption.delete({ where: { id: stale.id } });
    }

    for (const [j, opt] of (attr.options ?? []).entries()) {
      const option = await prisma.attributeOption.upsert({
        where: { attributeId_key: { attributeId: attribute.id, key: opt.key } },
        update: { displayOrder: j },
        create: { attributeId: attribute.id, key: opt.key, displayOrder: j },
      });
      await setTranslation('OPTION', option.id, 'name', opt.name);
    }
  }

  // Delete attributes no longer in this category's seed list (moved to a
  // child category, renamed, or dropped) — otherwise resolveAttributesFor-
  // Category's parent+child merge would keep surfacing a stale duplicate
  // alongside its replacement forever, since upsert alone never removes rows.
  const currentKeys = node.attributes.map((a) => a.key);
  const staleAttributes = await prisma.categoryAttribute.findMany({
    where: { categoryId: category.id, key: { notIn: currentKeys.length ? currentKeys : ['__none__'] } },
  });
  for (const stale of staleAttributes) {
    await prisma.listingAttribute.deleteMany({ where: { attributeId: stale.id } });
    await prisma.categoryAttribute.delete({ where: { id: stale.id } });
  }

  for (const [i, child] of (node.children ?? []).entries()) {
    await seedCategoryNode(child, category.id, i);
  }
}

async function seedCategories() {
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
        update: copy,
        create: { key: template.key, language, ...copy },
      });
    }
  }
  console.log(`Seeded ${emailTemplates.length} email templates x 2 languages`);
}

// Create-only, unlike seedEmailTemplates above — this container reseeds on
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

async function main() {
  await seedPackages();
  await seedPermissionsAndAdmin();
  await seedSettings();
  await seedLocations();
  await seedCategories();
  await seedEmailTemplates();
  await seedStaticPages();
  await seedFaqs();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
