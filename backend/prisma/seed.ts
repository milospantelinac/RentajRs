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
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
  }
  console.log(`Seeded ${settings.length} settings`);
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

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Nekretnine',
    icon: 'home',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH],
    defaultPriceUnit: PriceUnit.NIGHT,
    attributes: [
      { key: 'kvadratura', name: 'Kvadratura', type: AttributeType.NUMBER, unit: 'm²', isFilter: true, filterType: FilterType.RANGE, required: true },
      { key: 'broj_soba', name: 'Broj soba', type: AttributeType.NUMBER, isFilter: true, filterType: FilterType.RANGE },
      { key: 'sprat', name: 'Sprat', type: AttributeType.NUMBER, isFilter: true, filterType: FilterType.RANGE },
      { key: 'lift', name: 'Lift', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'parking', name: 'Parking', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'klima', name: 'Klima uređaj', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'kucni_ljubimci', name: 'Kućni ljubimci dozvoljeni', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
    ],
    children: [
      { name: 'Stanovi', icon: 'building', defaultBookingModel: BookingModel.PER_STAY, allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH], defaultPriceUnit: PriceUnit.NIGHT, attributes: [] },
      { name: 'Kuće i vikendice', icon: 'house', defaultBookingModel: BookingModel.PER_STAY, allowedPriceUnits: [PriceUnit.NIGHT, PriceUnit.MONTH], defaultPriceUnit: PriceUnit.NIGHT, attributes: [] },
      { name: 'Sobe', icon: 'bed', defaultBookingModel: BookingModel.PER_STAY, allowedPriceUnits: [PriceUnit.NIGHT], defaultPriceUnit: PriceUnit.NIGHT, attributes: [] },
    ],
  },
  {
    name: 'Prostori za proslave',
    icon: 'party',
    defaultBookingModel: BookingModel.PER_SLOT,
    allowedPriceUnits: [PriceUnit.HOUR, PriceUnit.SLOT],
    defaultPriceUnit: PriceUnit.SLOT,
    attributes: [
      { key: 'kapacitet', name: 'Kapacitet (broj gostiju)', type: AttributeType.NUMBER, isFilter: true, filterType: FilterType.RANGE, required: true },
      { key: 'ozvucenje', name: 'Ozvučenje', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'catering_dozvoljen', name: 'Sopstveni ketering dozvoljen', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'parking', name: 'Parking', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
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
      { key: 'uzrast', name: 'Preporučeni uzrast', type: AttributeType.TEXT, isFilter: false },
      { key: 'kapacitet', name: 'Kapacitet (broj dece)', type: AttributeType.NUMBER, isFilter: true, filterType: FilterType.RANGE },
      { key: 'animator_dostupan', name: 'Animator dostupan', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
    ],
  },
  {
    name: 'Vozila',
    icon: 'car',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR],
    defaultPriceUnit: PriceUnit.DAY,
    attributes: [
      { key: 'marka', name: 'Marka', type: AttributeType.TEXT, isFilter: true, filterType: FilterType.SELECT, required: true },
      { key: 'godiste', name: 'Godište', type: AttributeType.NUMBER, isFilter: true, filterType: FilterType.RANGE },
      {
        key: 'gorivo',
        name: 'Gorivo',
        type: AttributeType.LIST,
        isFilter: true,
        filterType: FilterType.SELECT,
        options: [
          { key: 'dizel', name: 'Dizel' },
          { key: 'benzin', name: 'Benzin' },
          { key: 'elektricni', name: 'Električni' },
          { key: 'hibrid', name: 'Hibrid' },
        ],
      },
      {
        key: 'menjac',
        name: 'Menjač',
        type: AttributeType.LIST,
        isFilter: true,
        filterType: FilterType.SELECT,
        options: [
          { key: 'manuelni', name: 'Manuelni' },
          { key: 'automatski', name: 'Automatski' },
        ],
      },
      { key: 'klima', name: 'Klima uređaj', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'gps', name: 'GPS navigacija', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
    ],
    children: [
      { name: 'Automobili', icon: 'sedan', defaultBookingModel: BookingModel.PER_STAY, allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR], defaultPriceUnit: PriceUnit.DAY, attributes: [] },
      {
        name: 'Dostavna vozila',
        icon: 'van',
        defaultBookingModel: BookingModel.PER_STAY,
        allowedPriceUnits: [PriceUnit.DAY, PriceUnit.HOUR],
        defaultPriceUnit: PriceUnit.DAY,
        attributes: [
          { key: 'nosivost', name: 'Nosivost', type: AttributeType.NUMBER, unit: 'kg', isFilter: true, filterType: FilterType.RANGE },
          { key: 'zapremina_tovarnog_prostora', name: 'Zapremina tovarnog prostora', type: AttributeType.NUMBER, unit: 'm³', isFilter: true, filterType: FilterType.RANGE },
          { key: 'vozac_ukljucen', name: 'Vozač uključen', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
        ],
      },
    ],
  },
  {
    name: 'Mašine',
    icon: 'excavator',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY],
    defaultPriceUnit: PriceUnit.DAY,
    attributes: [
      { key: 'tip_masine', name: 'Tip mašine', type: AttributeType.TEXT, isFilter: true, filterType: FilterType.SELECT, required: true },
      { key: 'snaga', name: 'Snaga', type: AttributeType.NUMBER, unit: 'kW', isFilter: true, filterType: FilterType.RANGE },
      { key: 'operater_ukljucen', name: 'Operater uključen', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'dostava_na_adresu', name: 'Dostava na adresu', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
    ],
  },
  {
    name: 'Magacini i skladišta',
    icon: 'warehouse',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.MONTH],
    defaultPriceUnit: PriceUnit.MONTH,
    attributes: [
      { key: 'povrsina', name: 'Površina', type: AttributeType.NUMBER, unit: 'm²', isFilter: true, filterType: FilterType.RANGE, required: true },
      { key: 'visina', name: 'Visina', type: AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: FilterType.RANGE },
      { key: 'rampa_za_utovar', name: 'Rampa za utovar', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'obezbedjenje', name: 'Obezbeđenje / video nadzor', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
      { key: 'grejanje', name: 'Grejanje', type: AttributeType.BOOLEAN, isFilter: true, filterType: FilterType.TOGGLE },
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
  // Hidden fallback parent for rejected category proposals (R6/§3.1) — never
  // shown in navigation, has no SEO page.
  {
    name: 'Ostalo',
    icon: 'other',
    defaultBookingModel: BookingModel.PER_STAY,
    allowedPriceUnits: [PriceUnit.DAY],
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
        displayOrder: i,
      },
    });
    await setTranslation('ATTRIBUTE', attribute.id, 'name', attr.name);

    for (const [j, opt] of (attr.options ?? []).entries()) {
      const option = await prisma.attributeOption.upsert({
        where: { attributeId_key: { attributeId: attribute.id, key: opt.key } },
        update: {},
        create: { attributeId: attribute.id, key: opt.key, displayOrder: j },
      });
      await setTranslation('OPTION', option.id, 'name', opt.name);
    }
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
