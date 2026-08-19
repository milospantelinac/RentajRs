/**
 * Initial content for the admin-editable static pages (politika-privatnosti,
 * uslovi-koriscenja, o-nama), migrated from what used to be hardcoded
 * directly in the .vue templates. From here on, admins edit this through
 * the Rich Text Editor in /admin/sadrzaj — this seed only sets the
 * starting point.
 */
export interface StaticPageSeed {
  slug: string;
  sr: { title: string; bodyHtml: string };
  en: { title: string; bodyHtml: string };
}

export const staticPages: StaticPageSeed[] = [
  {
    slug: 'o-nama',
    sr: {
      title: 'O nama',
      bodyHtml: `
<p class="lead-paragraph">Rentaj spaja oglasnik i rezervacioni sistem na jednom mestu. Vlasnik objavljuje ono što izdaje — stan, salu, igraonicu, vozilo, mašinu, magacin ili opremu — i prima rezervacije direktno, bez posrednika i bez provizije.</p>
<h2>Zašto smo napravili Rentaj</h2>
<p>Vlasnici koji izdaju jedan do nekoliko objekata najčešće biraju između oglasnika bez alata za rezervisanje i platformi koje uzimaju procenat od svake rezervacije. Rentaj radi drugačije: plaćate jednu fiksnu pretplatu za oglas, a rezervacioni sistem — kalendar, potvrda uplate, iCal sinhronizacija, poruke sa gostima — dolazi uz njega.</p>
<h2>Kako zarađujemo</h2>
<p>Isključivo od pretplate koju plaća vlasnik oglasa. Rentaj nikada ne uzima procenat od rezervacije i nikada ne dodiruje novac gosta — gost plaća vlasnika direktno, kešom ili uplatom na tekući račun. To je razlog zašto poruka „0% provizije" nešto zaista znači, a ne samo marketinški slogan.</p>
<h2>Za koga je Rentaj</h2>
<p>Prvenstveno za vlasnike koji izdaju jedan do četiri objekta — apartman, vozilo, salu za proslave, igraonicu, mašinu ili magacin — i za goste koji traže overen, pregledan način da ih pronađu i rezervišu.</p>
<h2>Kontakt</h2>
<p>Pišite nam na <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a> — rado čujemo pitanja, predloge i prijave problema.</p>`.trim(),
    },
    en: {
      title: 'About us',
      bodyHtml: `
<p class="lead-paragraph">Rentaj combines a listings marketplace and a booking system in one place. Owners publish what they rent out — an apartment, a venue, a playroom, a vehicle, machinery, a warehouse, or equipment — and receive bookings directly, with no middleman and no commission.</p>
<h2>Why we built Rentaj</h2>
<p>Owners renting out one to a few properties usually have to choose between a listings site with no booking tools, or a platform that takes a cut of every booking. Rentaj works differently: you pay one fixed subscription per listing, and the booking system — calendar, payment confirmation, iCal sync, guest messaging — comes with it.</p>
<h2>How we make money</h2>
<p>Exclusively from the subscription the listing owner pays. Rentaj never takes a percentage of a booking and never touches the guest's money — the guest pays the owner directly, in cash or by bank transfer. That's why "0% commission" actually means something here, not just a marketing line.</p>
<h2>Who Rentaj is for</h2>
<p>Primarily for owners renting out one to four properties — an apartment, a vehicle, an event venue, a playroom, machinery, or a warehouse — and for guests looking for a vetted, easy way to find and book them.</p>
<h2>Contact</h2>
<p>Write to us at <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a> — we're happy to hear questions, suggestions, and problem reports.</p>`.trim(),
    },
  },
  {
    slug: 'uslovi-koriscenja',
    sr: {
      title: 'Uslovi korišćenja',
      bodyHtml: `
<h2>1. Šta je Rentaj</h2>
<p>Rentaj je platforma koja spaja oglasnik i rezervacioni sistem. Vlasnik objavljuje ono što izdaje — stan, salu, igraonicu, vozilo, mašinu, magacin ili opremu — i prima rezervacije bez posrednika i bez provizije. Rentaj ne naplaćuje procenat od rezervacije; prihod platforme dolazi isključivo od mesečne ili godišnje pretplate koju plaća vlasnik oglasa.</p>
<h2>2. Nalog i uloge</h2>
<p>Registracijom postajete korisnik Platforme. Nema posebnog izbora „gost" ili „vlasnik" prilikom registracije — svaki nalog može i da rezerviše kod drugih i da izdaje sopstvene oglase. Uloga vlasnika nastaje objavljivanjem prvog oglasa i ne isključuje mogućnost rezervisanja kod drugih korisnika.</p>
<p>Odgovorni ste za tačnost podataka koje unesete i za bezbednost svoje lozinke.</p>
<h2>3. Objavljivanje oglasa</h2>
<p>Svaki oglas prolazi kroz administratorsko odobrenje pre nego što postane javno vidljiv, u roku od 24 časa. Vlasnik garantuje da su podaci u oglasu tačni i da ima pravo da izdaje ono što oglašava. Rentaj zadržava pravo da odbije ili ukloni oglas koji krši ova pravila ili važeće propise.</p>
<h2>4. Rezervacije i plaćanje</h2>
<p>Rentaj evidentira zahtev za rezervaciju, generiše IPS QR kod za uplatu i vodi status rezervacije, ali <strong>nikada ne prima, ne prosleđuje niti vraća novac</strong>. Gost plaća vlasnika direktno — kešom ili uplatom na tekući račun vlasnika. Vlasnik ručno potvrđuje prijem uplate; Rentaj ne verifikuje da je uplata izvršena.</p>
<p>Uslovi otkazivanja rezervacije su izjava vlasnika, prikazana pre uplate — Platforma nema sopstvenu politiku otkazivanja i ne posreduje u eventualnom sporu oko novca. Administrator može da razmatra ponašanje korisnika na Platformi (npr. neopravdano neprihvatanje uplate) i po potrebi izrekne upozorenje, ograničenje ili blokadu naloga.</p>
<h2>5. Pretplate i naplata</h2>
<ul>
<li>Objavljivanje oglasa zahteva aktivnu pretplatu na jedan od dostupnih paketa.</li>
<li>Pretplata se automatski obnavlja do otkazivanja, osim za pravna lica koja plaćaju virmanom.</li>
<li>Otkazivanje je moguće u svakom trenutku kroz kontrolnu tablu; oglas ostaje aktivan do kraja plaćenog perioda.</li>
<li>Povraćaj sredstava nije moguć, osim u slučaju tehničke greške na strani Platforme.</li>
<li>Rentaj ne čuva podatke o platnim karticama — naplatu obrađuje ovlašćeni platni servis.</li>
</ul>
<h2>6. Zabranjeno ponašanje</h2>
<ul>
<li>Objavljivanje netačnih, obmanjujućih ili tuđih oglasa.</li>
<li>Zaobilaženje Platforme radi izbegavanja pretplate razmenom kontakt podataka pre rezervacije.</li>
<li>Automatizovano prikupljanje podataka sa Platforme (grabbing/scraping) ili automatski unos naloga.</li>
<li>Uznemiravanje ili neprimereno ponašanje prema drugim korisnicima kroz poruke ili recenzije.</li>
</ul>
<p>Kršenje ovih pravila može dovesti do uklanjanja sadržaja, upozorenja ili blokade naloga.</p>
<h2>7. Ograničenje odgovornosti</h2>
<p>Rentaj nije strana u ugovoru o izdavanju između gosta i vlasnika i ne garantuje za kvalitet, bezbednost ili zakonitost onoga što se oglašava. Platforma obezbeđuje prostor za oglašavanje i rezervisanje, ali stvarni dogovor i njegovo izvršenje su isključivo stvar gosta i vlasnika.</p>
<h2>8. Izmene uslova</h2>
<p>Ovi uslovi se mogu povremeno izmeniti. O svakoj izmeni koja bitno utiče na vaša prava bićete obavešteni, a nastavak korišćenja Platforme nakon izmene smatra se prihvatanjem novih uslova.</p>
<h2>9. Kontakt</h2>
<p>Pitanja u vezi sa ovim uslovima možete poslati na <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a>.</p>`.trim(),
    },
    en: {
      title: 'Terms of Use',
      bodyHtml: `
<h2>1. What Rentaj is</h2>
<p>Rentaj is a platform that combines a listings marketplace and a booking system. Owners publish what they rent out — an apartment, a venue, a playroom, a vehicle, machinery, a warehouse, or equipment — and receive bookings with no middleman and no commission. Rentaj does not charge a percentage of any booking; the platform's revenue comes solely from the monthly or yearly subscription paid by the listing owner.</p>
<h2>2. Account and roles</h2>
<p>By registering you become a user of the Platform. There is no separate "guest" or "owner" choice at sign-up — every account can both book from others and publish its own listings. The owner role begins the moment you publish your first listing, and doesn't exclude booking from other users.</p>
<p>You are responsible for the accuracy of the information you provide and for the security of your password.</p>
<h2>3. Publishing a listing</h2>
<p>Every listing goes through administrator approval before becoming publicly visible, within 24 hours. The owner guarantees that the listing's information is accurate and that they have the right to rent out what is advertised. Rentaj reserves the right to reject or remove any listing that violates these rules or applicable regulations.</p>
<h2>4. Bookings and payment</h2>
<p>Rentaj records the booking request, generates an IPS QR payment code, and tracks the booking's status, but <strong>never receives, forwards, or refunds money</strong>. The guest pays the owner directly — in cash or by bank transfer to the owner's account. The owner manually confirms receipt of payment; Rentaj does not verify that payment was made.</p>
<p>Cancellation terms are the owner's own stated policy, shown before payment — the Platform has no cancellation policy of its own and does not mediate any dispute over money. The administrator may review a user's behavior on the Platform (e.g. unreasonably refusing to acknowledge a payment) and, if warranted, issue a warning, a restriction, or block the account.</p>
<h2>5. Subscriptions and billing</h2>
<ul>
<li>Publishing a listing requires an active subscription to one of the available packages.</li>
<li>The subscription renews automatically until cancelled, except for legal entities paying by bank transfer.</li>
<li>Cancellation is possible at any time from the dashboard; the listing stays active until the end of the paid period.</li>
<li>Refunds are not available, except in the case of a technical error on the Platform's side.</li>
<li>Rentaj never stores card payment details — billing is handled by an authorized payment service provider.</li>
</ul>
<h2>6. Prohibited behavior</h2>
<ul>
<li>Publishing inaccurate, misleading, or listings that aren't yours to publish.</li>
<li>Circumventing the Platform to avoid the subscription by exchanging contact details before booking.</li>
<li>Automated data collection from the Platform (scraping) or automated account creation.</li>
<li>Harassment or inappropriate behavior toward other users through messages or reviews.</li>
</ul>
<p>Violating these rules may lead to content removal, a warning, or an account block.</p>
<h2>7. Limitation of liability</h2>
<p>Rentaj is not a party to the rental agreement between guest and owner, and does not guarantee the quality, safety, or legality of what is advertised. The Platform provides the space to advertise and book, but the actual arrangement and its fulfillment are solely a matter between guest and owner.</p>
<h2>8. Changes to these terms</h2>
<p>These terms may change from time to time. You will be notified of any change that materially affects your rights, and continuing to use the Platform after a change is considered acceptance of the new terms.</p>
<h2>9. Contact</h2>
<p>Questions about these terms can be sent to <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a>.</p>`.trim(),
    },
  },
  {
    slug: 'politika-privatnosti',
    sr: {
      title: 'Politika privatnosti',
      bodyHtml: `
<h2>1. Ko je rukovalac podataka</h2>
<p>Rukovalac podataka koje prikupljamo prilikom korišćenja platforme Rentaj (u daljem tekstu: „Platforma") je Rentaj. Podatke obrađujemo u skladu sa Zakonom o zaštiti podataka o ličnosti Republike Srbije.</p>
<h2>2. Koje podatke prikupljamo</h2>
<ul>
<li>Osnovni podaci naloga: ime, prezime, e-mail adresa, lozinka (u kriptovanom obliku).</li>
<li>Opcioni podaci profila: telefon, profilna slika, jezik.</li>
<li>Podaci za naplatu ako objavljujete oglas: telefon, tekući račun za IPS QR kod, a za pravna lica naziv firme, PIB i matični broj.</li>
<li>Sadržaj koji sami unosite: oglasi, poruke, recenzije, prijave i sporovi.</li>
<li>Tehnički podaci: IP adresa, vrsta uređaja i kolačići — videti odeljak 6.</li>
</ul>
<p>Podatke o platnim karticama Rentaj nikada ne prikuplja niti čuva. Naplatu pretplate obrađuje ovlašćeni platni servis (Banca Intesa NestPay); Rentaj dobija samo potvrdu o uspešnoj uplati.</p>
<h2>3. Zašto obrađujemo vaše podatke</h2>
<ul>
<li>Da bismo vam omogućili registraciju, objavu oglasa i slanje zahteva za rezervaciju.</li>
<li>Da bismo omogućili komunikaciju između gosta i vlasnika oglasa.</li>
<li>Da bismo naplatili pretplatu za objavljene oglase i izdali fiskalni račun ili e-Fakturu.</li>
<li>Da bismo sprečili zloupotrebu, lažne naloge i automatski unos podataka.</li>
<li>Da bismo vas obavestili o statusu vaših rezervacija, oglasa i naloga.</li>
</ul>
<h2>4. Rentaj ne posreduje u novcu gostiju</h2>
<p>Gost plaća vlasnika oglasa direktno — keš ili uplatom na tekući račun vlasnika. Rentaj nikada ne prima, ne prosleđuje i ne vraća taj novac, i ne procesuira podatke o platnim karticama gostiju. Platforma naplaćuje isključivo pretplatu vlasnika oglasa.</p>
<h2>5. Vlasnik oglasa kao samostalan rukovalac</h2>
<p>Kada pošaljete zahtev za rezervaciju, vaše ime, kontakt podaci i poruka se dele sa vlasnikom oglasa radi realizacije rezervacije. Od tog trenutka, vlasnik postaje samostalan rukovalac tim podacima i odgovoran je za njihovu dalju obradu van Platforme.</p>
<h2>6. Kolačići</h2>
<p>Platforma koristi kolačiće neophodne za rad sajta i, uz vašu saglasnost, kolačiće za analitiku. Svoj izbor možete promeniti u svakom trenutku preko obaveštenja o kolačićima. Odbijanje neobaveznih kolačića ne utiče na osnovnu funkcionalnost Platforme.</p>
<h2>7. Vaša prava</h2>
<ul>
<li>Pravo uvida u podatke koje čuvamo o vama.</li>
<li>Pravo na ispravku netačnih podataka kroz podešavanja naloga.</li>
<li>Pravo na preuzimanje svojih podataka u čitljivom formatu.</li>
<li>Pravo na brisanje naloga — nalog se anonimizuje (lični podaci se trajno uklanjaju), dok evidencije potrebne iz zakonskih razloga (npr. izdati računi) ostaju bez ličnih podataka.</li>
</ul>
<p>Zahtev za ostvarivanje ovih prava možete podneti iz kontrolne table ili nam se obratiti na kontakt ispod.</p>
<h2>8. Bezbednost podataka</h2>
<p>Lozinke se čuvaju isključivo u kriptovanom obliku. Sav saobraćaj ide preko šifrovane veze. Administratorski nalozi zahtevaju dvofaktorsku autentikaciju.</p>
<h2>9. Kontakt</h2>
<p>Za sva pitanja o obradi ličnih podataka pišite nam na <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a>.</p>`.trim(),
    },
    en: {
      title: 'Privacy Policy',
      bodyHtml: `
<h2>1. Who the data controller is</h2>
<p>The controller of the data we collect while you use the Rentaj platform (the "Platform") is Rentaj. We process data in accordance with the Personal Data Protection Law of the Republic of Serbia.</p>
<h2>2. What data we collect</h2>
<ul>
<li>Basic account data: first name, last name, email address, password (encrypted).</li>
<li>Optional profile data: phone number, profile picture, language.</li>
<li>Billing data if you publish a listing: phone number, bank account for the IPS QR code, and for legal entities, company name, tax ID, and registration number.</li>
<li>Content you submit yourself: listings, messages, reviews, reports, and disputes.</li>
<li>Technical data: IP address, device type, and cookies — see section 6.</li>
</ul>
<p>Rentaj never collects or stores payment card data. Subscription billing is handled by an authorized payment service provider (Banca Intesa NestPay); Rentaj only receives confirmation that a payment succeeded.</p>
<h2>3. Why we process your data</h2>
<ul>
<li>To let you register, publish listings, and send booking requests.</li>
<li>To enable communication between a guest and a listing owner.</li>
<li>To bill the subscription for published listings and issue a fiscal receipt or e-invoice.</li>
<li>To prevent abuse, fake accounts, and automated data entry.</li>
<li>To notify you about the status of your bookings, listings, and account.</li>
</ul>
<h2>4. Rentaj does not handle guests' money</h2>
<p>The guest pays the listing owner directly — in cash or by bank transfer to the owner's account. Rentaj never receives, forwards, or refunds that money, and does not process guests' payment card data. The Platform only charges the listing owner's subscription.</p>
<h2>5. The listing owner as an independent controller</h2>
<p>When you send a booking request, your name, contact details, and message are shared with the listing owner to carry out the booking. From that point on, the owner becomes an independent controller of that data and is responsible for any further processing outside the Platform.</p>
<h2>6. Cookies</h2>
<p>The Platform uses cookies necessary for the site to function and, with your consent, analytics cookies. You can change your choice at any time through the cookie notice. Declining optional cookies does not affect the Platform's core functionality.</p>
<h2>7. Your rights</h2>
<ul>
<li>The right to access the data we hold about you.</li>
<li>The right to correct inaccurate data through your account settings.</li>
<li>The right to export your data in a readable format.</li>
<li>The right to delete your account — the account is anonymized (personal data is permanently removed), while records required for legal reasons (e.g. issued invoices) remain without personal data.</li>
</ul>
<p>You can submit a request to exercise these rights from your dashboard or by contacting us below.</p>
<h2>8. Data security</h2>
<p>Passwords are stored exclusively in encrypted form. All traffic runs over an encrypted connection. Administrator accounts require two-factor authentication.</p>
<h2>9. Contact</h2>
<p>For any questions about the processing of personal data, write to us at <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a>.</p>`.trim(),
    },
  },
];
