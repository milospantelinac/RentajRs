"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const email_templates_seed_data_1 = require("./email-templates.seed-data");
const static_pages_seed_data_1 = require("./static-pages.seed-data");
const faqs_seed_data_1 = require("./faqs.seed-data");
const prisma = new client_1.PrismaClient();
async function setTranslation(entityType, entityId, field, sr) {
    await prisma.translation.upsert({
        where: { entityType_entityId_field_language: { entityType, entityId, field, language: client_1.Language.SR } },
        update: { value: sr },
        create: { entityType, entityId, field, language: client_1.Language.SR, value: sr },
    });
}
async function seedPackages() {
    const packages = [
        {
            key: 'BASIC',
            priceMonthly: 149000n,
            priceYearly: 1639000n,
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
            priceMonthly: 334000n,
            priceYearly: 3674000n,
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
            priceMonthly: 864800n,
            priceYearly: 9490000n,
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
const PERMISSION_DEFS = [
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
            language: client_1.Language.SR,
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
async function seedSettings() {
    const settings = [
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
            description: 'Ch.18.3 — YouTube/Vimeo/direct video URL for the homepage "how it works" section; section is hidden entirely while this is empty',
        },
    ];
    let created = 0;
    for (const setting of settings) {
        const existing = await prisma.setting.findUnique({ where: { key: setting.key } });
        if (existing)
            continue;
        await prisma.setting.create({ data: setting });
        created += 1;
    }
    console.log(created > 0 ? `Seeded ${created} settings` : 'Settings already seeded, skipped');
}
async function seedLocations() {
    const data = {
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
function slugify(input) {
    const map = {
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
const CATEGORY_TREE = [
    {
        name: 'Nekretnine',
        icon: 'home',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH],
        defaultPriceUnit: client_1.PriceUnit.NIGHT,
        attributes: [
            { key: 'kvadratura', name: 'Kvadratura', type: client_1.AttributeType.NUMBER, unit: 'm²', isFilter: true, filterType: client_1.FilterType.RANGE, required: true },
            { key: 'broj_soba', name: 'Broj soba', type: client_1.AttributeType.NUMBER, isFilter: true, filterType: client_1.FilterType.RANGE },
            { key: 'sprat', name: 'Sprat', type: client_1.AttributeType.NUMBER, isFilter: true, filterType: client_1.FilterType.RANGE },
            { key: 'lift', name: 'Lift', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'parking', name: 'Parking', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'klima', name: 'Klima uređaj', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'kucni_ljubimci', name: 'Kućni ljubimci dozvoljeni', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
        ],
        children: [
            { name: 'Stanovi', icon: 'building', defaultBookingModel: client_1.BookingModel.PER_STAY, allowedPriceUnits: [client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH], defaultPriceUnit: client_1.PriceUnit.NIGHT, attributes: [] },
            { name: 'Kuće i vikendice', icon: 'house', defaultBookingModel: client_1.BookingModel.PER_STAY, allowedPriceUnits: [client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH], defaultPriceUnit: client_1.PriceUnit.NIGHT, attributes: [] },
            { name: 'Sobe', icon: 'bed', defaultBookingModel: client_1.BookingModel.PER_STAY, allowedPriceUnits: [client_1.PriceUnit.NIGHT], defaultPriceUnit: client_1.PriceUnit.NIGHT, attributes: [] },
        ],
    },
    {
        name: 'Prostori za proslave',
        icon: 'party',
        defaultBookingModel: client_1.BookingModel.PER_SLOT,
        allowedPriceUnits: [client_1.PriceUnit.HOUR, client_1.PriceUnit.SLOT],
        defaultPriceUnit: client_1.PriceUnit.SLOT,
        attributes: [
            { key: 'kapacitet', name: 'Kapacitet (broj gostiju)', type: client_1.AttributeType.NUMBER, isFilter: true, filterType: client_1.FilterType.RANGE, required: true },
            { key: 'ozvucenje', name: 'Ozvučenje', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'catering_dozvoljen', name: 'Sopstveni ketering dozvoljen', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'parking', name: 'Parking', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
        ],
        children: [
            { name: 'Sale za proslave', icon: 'hall', defaultBookingModel: client_1.BookingModel.PER_SLOT, allowedPriceUnits: [client_1.PriceUnit.HOUR, client_1.PriceUnit.SLOT], defaultPriceUnit: client_1.PriceUnit.SLOT, attributes: [] },
            { name: 'Konferencijske sale', icon: 'meeting', defaultBookingModel: client_1.BookingModel.PER_SLOT, allowedPriceUnits: [client_1.PriceUnit.HOUR], defaultPriceUnit: client_1.PriceUnit.HOUR, attributes: [] },
        ],
    },
    {
        name: 'Igraonice',
        icon: 'toy',
        defaultBookingModel: client_1.BookingModel.PER_SLOT,
        allowedPriceUnits: [client_1.PriceUnit.HOUR, client_1.PriceUnit.SLOT],
        defaultPriceUnit: client_1.PriceUnit.SLOT,
        attributes: [
            { key: 'uzrast', name: 'Preporučeni uzrast', type: client_1.AttributeType.TEXT, isFilter: false },
            { key: 'kapacitet', name: 'Kapacitet (broj dece)', type: client_1.AttributeType.NUMBER, isFilter: true, filterType: client_1.FilterType.RANGE },
            { key: 'animator_dostupan', name: 'Animator dostupan', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
        ],
    },
    {
        name: 'Vozila',
        icon: 'car',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR],
        defaultPriceUnit: client_1.PriceUnit.DAY,
        attributes: [
            { key: 'marka', name: 'Marka', type: client_1.AttributeType.TEXT, isFilter: true, filterType: client_1.FilterType.SELECT, required: true },
            { key: 'godiste', name: 'Godište', type: client_1.AttributeType.NUMBER, isFilter: true, filterType: client_1.FilterType.RANGE },
            {
                key: 'gorivo',
                name: 'Gorivo',
                type: client_1.AttributeType.LIST,
                isFilter: true,
                filterType: client_1.FilterType.SELECT,
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
                type: client_1.AttributeType.LIST,
                isFilter: true,
                filterType: client_1.FilterType.SELECT,
                options: [
                    { key: 'manuelni', name: 'Manuelni' },
                    { key: 'automatski', name: 'Automatski' },
                ],
            },
            { key: 'klima', name: 'Klima uređaj', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'gps', name: 'GPS navigacija', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
        ],
        children: [
            { name: 'Automobili', icon: 'sedan', defaultBookingModel: client_1.BookingModel.PER_STAY, allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR], defaultPriceUnit: client_1.PriceUnit.DAY, attributes: [] },
            {
                name: 'Dostavna vozila',
                icon: 'van',
                defaultBookingModel: client_1.BookingModel.PER_STAY,
                allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR],
                defaultPriceUnit: client_1.PriceUnit.DAY,
                attributes: [
                    { key: 'nosivost', name: 'Nosivost', type: client_1.AttributeType.NUMBER, unit: 'kg', isFilter: true, filterType: client_1.FilterType.RANGE },
                    { key: 'zapremina_tovarnog_prostora', name: 'Zapremina tovarnog prostora', type: client_1.AttributeType.NUMBER, unit: 'm³', isFilter: true, filterType: client_1.FilterType.RANGE },
                    { key: 'vozac_ukljucen', name: 'Vozač uključen', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
                ],
            },
        ],
    },
    {
        name: 'Mašine',
        icon: 'excavator',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY],
        defaultPriceUnit: client_1.PriceUnit.DAY,
        attributes: [
            { key: 'tip_masine', name: 'Tip mašine', type: client_1.AttributeType.TEXT, isFilter: true, filterType: client_1.FilterType.SELECT, required: true },
            { key: 'snaga', name: 'Snaga', type: client_1.AttributeType.NUMBER, unit: 'kW', isFilter: true, filterType: client_1.FilterType.RANGE },
            { key: 'operater_ukljucen', name: 'Operater uključen', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'dostava_na_adresu', name: 'Dostava na adresu', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
        ],
    },
    {
        name: 'Magacini i skladišta',
        icon: 'warehouse',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.MONTH],
        defaultPriceUnit: client_1.PriceUnit.MONTH,
        attributes: [
            { key: 'povrsina', name: 'Površina', type: client_1.AttributeType.NUMBER, unit: 'm²', isFilter: true, filterType: client_1.FilterType.RANGE, required: true },
            { key: 'visina', name: 'Visina', type: client_1.AttributeType.NUMBER, unit: 'm', isFilter: true, filterType: client_1.FilterType.RANGE },
            { key: 'rampa_za_utovar', name: 'Rampa za utovar', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'obezbedjenje', name: 'Obezbeđenje / video nadzor', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
            { key: 'grejanje', name: 'Grejanje', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE },
        ],
    },
    {
        name: 'Oprema',
        icon: 'tools',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR],
        defaultPriceUnit: client_1.PriceUnit.DAY,
        attributes: [
            { key: 'kategorija_opreme', name: 'Vrsta opreme', type: client_1.AttributeType.TEXT, isFilter: true, filterType: client_1.FilterType.SELECT, required: true },
            { key: 'stanje', name: 'Stanje', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: [{ key: 'novo', name: 'Novo' }, { key: 'polovno', name: 'Polovno' }] },
        ],
    },
    {
        name: 'Ostalo',
        icon: 'other',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY],
        defaultPriceUnit: client_1.PriceUnit.DAY,
        attributes: [],
    },
];
async function seedCategoryNode(node, parentId, order) {
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
async function seedEmailTemplates() {
    for (const template of email_templates_seed_data_1.emailTemplates) {
        for (const language of [client_1.Language.SR, client_1.Language.EN]) {
            const copy = template[language === client_1.Language.SR ? 'sr' : 'en'];
            await prisma.emailTemplate.upsert({
                where: { key_language: { key: template.key, language } },
                update: copy,
                create: { key: template.key, language, ...copy },
            });
        }
    }
    console.log(`Seeded ${email_templates_seed_data_1.emailTemplates.length} email templates x 2 languages`);
}
async function seedStaticPages() {
    let created = 0;
    for (const page of static_pages_seed_data_1.staticPages) {
        for (const language of [client_1.Language.SR, client_1.Language.EN]) {
            const copy = page[language === client_1.Language.SR ? 'sr' : 'en'];
            const existing = await prisma.staticPage.findUnique({ where: { slug_language: { slug: page.slug, language } } });
            if (existing)
                continue;
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
    for (const [index, faq] of faqs_seed_data_1.faqs.entries()) {
        for (const language of [client_1.Language.SR, client_1.Language.EN]) {
            const copy = faq[language === client_1.Language.SR ? 'sr' : 'en'];
            await prisma.faq.create({ data: { language, displayOrder: index, ...copy } });
        }
    }
    console.log(`Seeded ${faqs_seed_data_1.faqs.length} FAQ items x 2 languages`);
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
//# sourceMappingURL=seed.js.map