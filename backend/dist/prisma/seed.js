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
function opts(names) {
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
const CATEGORY_TREE = [
    {
        name: 'Nekretnine',
        icon: 'home',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH],
        defaultPriceUnit: client_1.PriceUnit.NIGHT,
        attributes: [],
        children: [
            {
                name: 'Stanovi',
                icon: 'building',
                defaultBookingModel: client_1.BookingModel.PER_STAY,
                allowedPriceUnits: [client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH],
                defaultPriceUnit: client_1.PriceUnit.NIGHT,
                attributes: [
                    { key: 'kvadratura', name: 'Površina', type: client_1.AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'broj_soba', name: 'Broj soba', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Garsonjera', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5+']) },
                    { key: 'broj_kreveta', name: 'Broj kreveta', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'sprat', name: 'Sprat', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Suteren', 'Prizemlje', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+', 'Potkrovlje']) },
                    { key: 'sadrzaji', name: 'Sadržaji', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT, options: AMENITIES_APARTMANI },
                ],
            },
            {
                name: 'Kuće i vikendice',
                icon: 'house',
                defaultBookingModel: client_1.BookingModel.PER_STAY,
                allowedPriceUnits: [client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH],
                defaultPriceUnit: client_1.PriceUnit.NIGHT,
                attributes: [
                    { key: 'kvadratura', name: 'Površina', type: client_1.AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'broj_soba', name: 'Broj soba', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'broj_kreveta', name: 'Broj kreveta', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'broj_kupatila', name: 'Broj kupatila', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'sadrzaji', name: 'Sadržaji', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT, options: AMENITIES_KUCE },
                ],
            },
            {
                name: 'Sobe',
                icon: 'bed',
                defaultBookingModel: client_1.BookingModel.PER_STAY,
                allowedPriceUnits: [client_1.PriceUnit.NIGHT],
                defaultPriceUnit: client_1.PriceUnit.NIGHT,
                attributes: [
                    { key: 'kvadratura', name: 'Površina', type: client_1.AttributeType.NUMBER, unit: 'm²', required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'broj_kreveta', name: 'Broj kreveta', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'kupatilo', name: 'Kupatilo', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Privatno', 'Zajedničko']) },
                    { key: 'sadrzaji', name: 'Sadržaji', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT, options: AMENITIES_SOBE },
                ],
            },
        ],
    },
    {
        name: 'Prostori za proslave',
        icon: 'party',
        defaultBookingModel: client_1.BookingModel.PER_SLOT,
        allowedPriceUnits: [client_1.PriceUnit.HOUR, client_1.PriceUnit.SLOT],
        defaultPriceUnit: client_1.PriceUnit.SLOT,
        attributes: [
            { key: 'kapacitet_ljudi', name: 'Kapacitet ljudi', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
            { key: 'tip_prostora', name: 'Tip prostora', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Sala za proslave', 'Open Air prostor', 'Salaš', 'Restoran', 'Klub / Bar', 'Splav']) },
            { key: 'ketering', name: 'Ketering', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['Uključen', 'Sopstveni ketering dozvoljen', 'Po dogovoru', 'Nije dostupan']) },
            {
                key: 'sadrzaji', name: 'Sadržaji', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT,
                options: opts(['Bazen — spoljašnji', 'Bazen — unutrašnji', 'Đakuzi', 'Igralište za decu', 'Kafe aparat', 'Klima', 'Kuhinja', 'Kupatilo', 'Ledomat', 'Mikrofon', 'Ozvučenje', 'Parking', 'Privatni ulaz', 'Projektor', 'Pušenje dozvoljeno', 'Roštilj', 'Terasa', 'TV', 'WiFi']),
            },
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
            { key: 'kapacitet_dece', name: 'Kapacitet dece', type: client_1.AttributeType.NUMBER, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
            { key: 'uzrast_dece', name: 'Uzrast dece', type: client_1.AttributeType.CHECKBOX_GROUP, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['1–3 godine', '4–6 godine', '7–10 godine', '10+ godina']) },
            {
                key: 'sadrzaji', name: 'Sadržaji', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT,
                options: opts(['Kafić / zona za roditelje', 'Klima', 'Parking', 'Privatni ulaz', 'Pušenje dozvoljeno', 'WiFi', 'Animator dostupan', 'Trambolina', 'Tobogan', 'Lavirint / poligon', 'Bazen sa lopticama', 'Video igre / konzole', 'Kreativni sadržaji']),
            },
        ],
    },
    {
        name: 'Vozila',
        icon: 'car',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR],
        defaultPriceUnit: client_1.PriceUnit.DAY,
        attributes: [],
        children: [
            {
                name: 'Putnička vozila',
                icon: 'sedan',
                defaultBookingModel: client_1.BookingModel.PER_STAY,
                allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR],
                defaultPriceUnit: client_1.PriceUnit.DAY,
                attributes: [
                    { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: client_1.AttributeType.YEAR, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'tip_vozila', name: 'Tip vozila', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Hatchback', 'SUV', 'Limuzina', 'Coupe', 'Kabriolet', 'Minivan']) },
                    { key: 'marka_vozila', name: 'Marka vozila', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: VEHICLE_BRANDS },
                    { key: 'broj_sedista', name: 'Broj sedišta', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['2', '4', '5', '6', '7', '8+']) },
                    { key: 'menjac', name: 'Menjač', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Manuelni', 'Automatski']) },
                    { key: 'gorivo', name: 'Gorivo', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Benzin', 'Dizel', 'Hibrid', 'Plug-in hibrid', 'Električno']) },
                    { key: 'pogon', name: 'Pogon', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['Prednji', 'Zadnji', '4x4']) },
                    { key: 'oprema', name: 'Oprema', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['GPS / navigacija', 'Klima', 'Krovni nosač', 'Parking senzori', 'Tempomat', 'TV', 'WiFi']) },
                ],
            },
            {
                name: 'Dostavna vozila',
                icon: 'van',
                defaultBookingModel: client_1.BookingModel.PER_STAY,
                allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.HOUR],
                defaultPriceUnit: client_1.PriceUnit.DAY,
                attributes: [
                    { key: 'tip_vozila', name: 'Tip vozila', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Pickup', 'Kombi', 'Kamion']) },
                    { key: 'marka_vozila', name: 'Marka vozila', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: VEHICLE_BRANDS },
                    { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: client_1.AttributeType.YEAR, required: true, isFilter: true, filterType: client_1.FilterType.RANGE, showOnCard: true },
                    { key: 'nosivost', name: 'Nosivost', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['500 kg', '1000 kg', '1500 kg', '2000 kg', '3500 kg', '5000 kg', '7500 kg', '12000 kg', 'Preko 12000 kg']) },
                    { key: 'zapremina_tovarnog_prostora', name: 'Zapremina tovarnog prostora', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['1 m³', '2 m³', '3 m³', '5 m³', '8 m³', '10 m³', '15 m³', 'Preko 15 m³']) },
                    { key: 'duzina_tovarnog_prostora', name: 'Dužina tovarnog prostora', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['1 m', '1.5 m', '2 m', '2.5 m', '3 m', '4 m', '5 m', 'Preko 5 m']) },
                    { key: 'sirina_tovarnog_prostora', name: 'Širina tovarnog prostora', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['1 m', '1.3 m', '1.5 m', '1.8 m', '2 m', 'Preko 2 m']) },
                    { key: 'visina_tovarnog_prostora', name: 'Visina tovarnog prostora', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['1 m', '1.3 m', '1.5 m', '1.8 m', '2 m', 'Preko 2 m']) },
                    { key: 'menjac', name: 'Menjač', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['Manuelni', 'Automatski']) },
                    { key: 'gorivo', name: 'Gorivo', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['Benzin', 'Dizel', 'Hibrid', 'Plug-in hibrid', 'Električno']) },
                    { key: 'pogon', name: 'Pogon', type: client_1.AttributeType.LIST, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['Prednji', 'Zadnji', '4x4']) },
                    { key: 'oprema', name: 'Oprema', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT, options: opts(['GPS / navigacija', 'Klima', 'Parking senzori', 'Tempomat']) },
                ],
            },
        ],
    },
    {
        name: 'Građevinske mašine',
        icon: 'excavator',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY],
        defaultPriceUnit: client_1.PriceUnit.DAY,
        attributes: [
            { key: 'tip_masine', name: 'Tip mašine', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Bager', 'Dizalica / Kran', 'Mini mašina', 'Platforma za rad na visini', 'Transporter / Mini damper', 'Viljuškar']) },
            { key: 'godina_proizvodnje', name: 'Godina proizvodnje', type: client_1.AttributeType.YEAR, showOnCard: true },
            { key: 'vrsta_pogona', name: 'Vrsta pogona', type: client_1.AttributeType.LIST, required: true, showOnCard: true, options: opts(['Dizel', 'Benzin', 'Električni', 'Hibridni']) },
            { key: 'stanje_masine', name: 'Stanje mašine', type: client_1.AttributeType.LIST, options: opts(['Novo', 'Polovno', 'Za delove']) },
            { key: 'tezina_masine', name: 'Težina mašine', type: client_1.AttributeType.LIST, options: opts(['500 kg', '1000 kg', '2000 kg', '3000 kg', '5000 kg', '8000 kg', '12000 kg', '20000 kg', 'Preko 20000 kg']) },
            { key: 'snaga_motora', name: 'Snaga motora', type: client_1.AttributeType.LIST, options: opts(['10 kW', '20 kW', '30 kW', '50 kW', '75 kW', '100 kW', '150 kW', 'Preko 150 kW']) },
            { key: 'sa_rukovaocem', name: 'Sa rukovaocem', type: client_1.AttributeType.BOOLEAN, required: true, isFilter: true, filterType: client_1.FilterType.TOGGLE, showOnCard: true },
            { key: 'dostava_na_lokaciju', name: 'Dostava na lokaciju', type: client_1.AttributeType.BOOLEAN, isFilter: true, filterType: client_1.FilterType.TOGGLE, showOnCard: true },
            { key: 'tip_bagera', name: 'Tip bagera', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Guseničar', 'Točkaš', 'Mini bager', 'Bager-utovarivač']) },
            { key: 'max_dubina_kopanja', name: 'Maksimalna dubina kopanja', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['1 m', '2 m', '3 m', '4 m', '5 m', '6 m', 'Preko 6 m']) },
            { key: 'max_radna_visina_bager', name: 'Maksimalna radna visina', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['3 m', '4 m', '5 m', '6 m', '7 m', 'Preko 7 m']) },
            { key: 'zapremina_kasike', name: 'Zapremina kašike', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['0.05 m³', '0.1 m³', '0.2 m³', '0.3 m³', '0.5 m³', '0.75 m³', 'Preko 0.75 m³']) },
            { key: 'tip_kabine_bager', name: 'Tip kabine', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Otvorena', 'Zatvorena', 'Klimatizovana']) },
            { key: 'prikljucci_bager', name: 'Priključci', type: client_1.AttributeType.CHECKBOX_GROUP, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Standardna kašika', 'Hidraulični čekić', 'Grajfer', 'Bušilica / svrdlo', 'Rotirajuća kašika', 'Hidraulični adapteri', 'Tanjirasti priključak', 'Specijalni alati']) },
            { key: 'oprema_bager', name: 'Oprema', type: client_1.AttributeType.CHECKBOX_GROUP, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'bager', options: opts(['Daljinsko upravljanje', 'Digitalni displej / kontrolni panel', 'GPS / navigacija', 'Grejanje kabine', 'Klima u kabini', 'LED / radna svetla', 'Parking senzori', 'Sigurnosni pojasevi', 'Telematika / praćenje radnih sati']) },
            { key: 'tip_dizalice', name: 'Tip dizalice / krana', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Toranjski', 'Mobilni', 'Gusenični', 'Auto-dizalica']) },
            { key: 'nosivost_dizalica', name: 'Nosivost', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['1000 kg', '3000 kg', '5000 kg', '10000 kg', '20000 kg', 'Preko 20000 kg']) },
            { key: 'max_visina_dizanja_dizalica', name: 'Maksimalna visina dizanja', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['10 m', '20 m', '30 m', '50 m', '75 m', 'Preko 75 m']) },
            { key: 'horizontalni_domet', name: 'Horizontalni domet', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['10 m', '20 m', '30 m', '40 m', 'Preko 40 m']) },
            { key: 'tip_kabine_dizalica', name: 'Tip kabine', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Otvorena', 'Zatvorena', 'Klimatizovana']) },
            { key: 'stabilizatori', name: 'Stabilizatori', type: client_1.AttributeType.BOOLEAN, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran' },
            { key: 'nacin_montaze', name: 'Način montaže', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'dizalica-kran', options: opts(['Fiksna', 'Mobilna', 'Vučna']) },
            { key: 'tip_mini_masine', name: 'Tip mini mašine', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'mini-masina', options: opts(['Mini utovarivač', 'Mini bager', 'Mini damper']) },
            { key: 'tip_platforme', name: 'Tip platforme', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['Škarasta', 'Zglobna', 'Teleskopska', 'Guseničarska']) },
            { key: 'max_radna_visina_platforma', name: 'Maksimalna radna visina', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['6 m', '8 m', '10 m', '12 m', '16 m', '20 m', 'Preko 20 m']) },
            { key: 'nosivost_platforma', name: 'Nosivost', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['120 kg', '200 kg', '230 kg', '300 kg', '450 kg', 'Preko 450 kg']) },
            { key: 'radni_prostor_platforma', name: 'Radni prostor', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['Unutrašnji', 'Spoljašnji', 'Oba']) },
            { key: 'radni_domet_platforma', name: 'Radni domet', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'platforma-za-rad-na-visini', options: opts(['3 m', '5 m', '7 m', '10 m', 'Preko 10 m']) },
            { key: 'tip_transportera', name: 'Tip transportera', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['Gusenični', 'Točkaš']) },
            { key: 'nosivost_transporter', name: 'Nosivost', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['500 kg', '1000 kg', '1500 kg', '2000 kg', '3000 kg', 'Preko 3000 kg']) },
            { key: 'zapremina_korpe', name: 'Zapremina korpe', type: client_1.AttributeType.LIST, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['0.3 m³', '0.5 m³', '0.75 m³', '1 m³', 'Preko 1 m³']) },
            { key: 'visina_istovara', name: 'Visina istovara', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['0.5 m', '1 m', '1.5 m', '2 m', 'Preko 2 m']) },
            { key: 'nacin_kipovanja', name: 'Način kipovanja', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'transporter-mini-damper', options: opts(['Zadnje', 'Bočno', 'Trostrano']) },
            { key: 'tip_viljuskara', name: 'Tip viljuškara', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['Dizel', 'Elektro', 'Gas', 'Teleskopski']) },
            { key: 'nosivost_viljuskar', name: 'Nosivost', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['1000 kg', '1500 kg', '2000 kg', '2500 kg', '3000 kg', '5000 kg', 'Preko 5000 kg']) },
            { key: 'max_visina_dizanja_viljuskar', name: 'Maksimalna visina dizanja', type: client_1.AttributeType.LIST, required: true, showOnCard: true, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['3 m', '4 m', '5 m', '6 m', '7 m', 'Preko 7 m']) },
            { key: 'radni_prostor_viljuskar', name: 'Radni prostor', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['Unutrašnji', 'Spoljašnji']) },
            { key: 'radni_domet_viljuskar', name: 'Radni domet', type: client_1.AttributeType.LIST, dependsOnAttrKey: 'tip_masine', dependsOnOptionKey: 'viljuskar', options: opts(['0.5 m', '1 m', '1.5 m', '2 m', 'Preko 2 m']) },
        ],
    },
    {
        name: 'Magacini i skladišta',
        icon: 'warehouse',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.MONTH],
        defaultPriceUnit: client_1.PriceUnit.MONTH,
        attributes: [
            { key: 'povrsina', name: 'Površina', type: client_1.AttributeType.LIST, required: true, showOnCard: true, options: opts(['20 m²', '50 m²', '100 m²', '200 m²', '300 m²', '500 m²', '1000 m²', 'Preko 1000 m²']) },
            { key: 'visina_prostora', name: 'Visina prostora', type: client_1.AttributeType.LIST, required: true, showOnCard: true, options: opts(['2 m', '2.5 m', '3 m', '4 m', '5 m', '6 m', 'Preko 6 m']) },
            { key: 'tip_prostora', name: 'Tip prostora', type: client_1.AttributeType.LIST, required: true, isFilter: true, filterType: client_1.FilterType.SELECT, showOnCard: true, options: opts(['Privatni magacin', 'Poslovni magacin', 'Industrijski magacin', 'Skladišni prostor', 'Hladnjača']) },
            {
                key: 'sadrzaji', name: 'Sadržaji', type: client_1.AttributeType.CHECKBOX_GROUP, isFilter: true, filterType: client_1.FilterType.SELECT,
                options: opts(['Alarm / sigurnosni sistem', 'Video nadzor / kamere', 'Protivpožarni sistem', 'Grejanje', 'Klima', 'Paletni regali / police', 'Parking', 'Pristup kamionima', 'Rampa za utovar']),
            },
        ],
    },
    {
        name: 'Ostalo',
        icon: 'other',
        defaultBookingModel: client_1.BookingModel.PER_STAY,
        allowedPriceUnits: [client_1.PriceUnit.DAY, client_1.PriceUnit.NIGHT, client_1.PriceUnit.MONTH, client_1.PriceUnit.HOUR, client_1.PriceUnit.SLOT],
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
const REMOVED_CATEGORY_SLUGS = ['oprema', 'usluge', 'automobili', 'masine'];
async function pruneRemovedCategories() {
    for (const slug of REMOVED_CATEGORY_SLUGS) {
        const category = await prisma.category.findUnique({ where: { slug } });
        if (!category)
            continue;
        await prisma.emptySearch.updateMany({ where: { categoryId: category.id }, data: { categoryId: null } });
        await prisma.listing.deleteMany({ where: { categoryId: category.id } });
        await prisma.categoryAttribute.deleteMany({ where: { categoryId: category.id } });
        await prisma.category.delete({ where: { id: category.id } });
        console.log(`Pruned removed category "${slug}"`);
    }
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
    await pruneRemovedCategories();
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