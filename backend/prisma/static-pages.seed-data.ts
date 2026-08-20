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
    // Real, legally-operative text migrated verbatim from the old WordPress
    // site (staging.rentaj.rs/opsti-uslovi-poslovanja) 2026-08-20 — replaces
    // the earlier placeholder summary that was never the actual reviewed
    // terms. The EN copy is a plain translation of the same SR text, not an
    // independently drafted document — keep both in sync if either changes.
    slug: 'uslovi-koriscenja',
    sr: {
      title: 'Opšti uslovi poslovanja',
      bodyHtml: `
<h2>Uvod</h2>
<p>Opštim uslovima poslovanja (u daljem tekstu: „OUP") reguliše se korišćenje web sajta rentaj.rs (u daljem tekstu: „web sajt"), kojom upravlja preduzetnik Tamara Božović preduzetnik Veb portali RENTAJ.RS Nova Pazova, PIB 115213635, MB 68188032, sa sedištem u Novoj Pazovi, ul. Janka Čmelika br. 2.</p>
<p>Korišćenjem platforme korisnici (oglašivači i krajnji korisnici) prihvataju ove opšte uslove poslovanja i saglasni su sa njihovom daljom primenom prilikom korišćenja web sajta.</p>
<h2>Osnovni pojmovi</h2>
<p>Platforma Rentaj.rs, kojom upravlja preduzetnik Tamara Božović preduzetnik Veb portali RENTAJ.RS Nova Pazova, je internet stranica na koju korisnici (oglašivači) postavljaju oglase za rentiranje (iznajmljivanje) objekata i dr.</p>
<p>Korisnik (oglašivač) je lice koje je registrovano na platformi rentaj.rs i koje koristi istu u cilju postavljanja oglasa za rentiranje (iznajmljivanje) objekata i dr. i koje može biti u pretplatničkom odnosu prema platformi rentaj.rs.</p>
<p>Krajnji korisnici (posetioci) platforme su treća lica koja posredstvom platforme rentaj.rs iznajmljuju objekte i dr. u cilju boravka u istima (kratkoročno ili dugoročno).</p>
<h2>Usluge</h2>
<p>Web sajt rentaj.rs omogućava oglašivačima (vlasnicima objekata ili korisnicima objekata, ali i drugih stvari podobnih za iznajmljivanje) da posredstvom platforme rentaj.rs oglašavaju svoje objekte namenjene rentiranju (jednokratnom ili dugoročnom), a krajnji korisnici (posetioci web sajta) putem istog rezervišu usluge pružene od strane oglašivača koristeći web sajt rentaj.rs.</p>
<p>Usluge se sastoje u sledećem:</p>
<ul>
<li>platforma rentaj.rs omogućava vlasnicima objekta da, pod ovim OUP, koriste platformu na taj način što će oglašavati svoje objekte namenjene kratkoročnom ili dugoročnom zakupu;</li>
<li>platforma rentaj.rs omogućava krajnjim korisnicima da, putem platforme rentaj.rs, rezervišu objekat (ili objekte) oglašivača pod ovim OUP;</li>
<li>ovi OUP se odnose na teritoriju Republike Srbije na smeštajne turističke i neturističke objekte namenjene izdavanju trećim licima (korisnicima), kao i druge usluge koje su podobne za izdavanje u zakup i sl.</li>
</ul>
<h2>Registracija oglašivača</h2>
<p>Oglašivači se registruju (Registracija, na web sajtu pod opcijom „Vlasnik") putem web sajta rentaj.rs, ostavljajući svoju e-mail adresu, pri čemu kreiraju korisnički nalog sa zaštitnom lozinkom kako bi mogli pristupiti sajtu. Korisničko ime je dostupno trećim licima, dok je lozinka tajni podatak dostupan isključivo oglašivačima i može se menjati u toku trajanja naloga.</p>
<p>Platforma rentaj.rs nudi oglašivačima sledeće načine registracije:</p>
<ul>
<li>registracija putem e-mail adrese;</li>
<li>registracija putem Google naloga;</li>
<li>registracija putem Facebook naloga.</li>
</ul>
<p>Registracija oglašivača je besplatna i trajna.</p>
<p>Korisnički nalog može se obrisati u svako doba, bez naknade.</p>
<h2>Registracija korisnika usluga</h2>
<p>Korisnici usluga registruju se (na web sajtu pod opcijom „Gost") putem web sajta rentaj.rs, ostavljajući svoju e-mail adresu, pri čemu kreiraju korisnički nalog sa zaštitnom lozinkom kako bi mogli pristupiti sajtu. Korisničko ime je dostupno trećim licima, dok je lozinka tajni podatak dostupan isključivo korisnicima i može se menjati u toku trajanja naloga.</p>
<p>Platforma rentaj.rs nudi korisnicima usluga sledeće načine registracije:</p>
<ul>
<li>registracija putem e-mail adrese;</li>
<li>registracija putem Google naloga;</li>
<li>registracija putem Facebook naloga.</li>
</ul>
<h2>Plaćanje usluga</h2>
<p>Platforma rentaj.rs omogućava korisnicima usluge da rezervišu objekat (objekte) i druge usluge u skladu sa ovim Opštim uslovima, oglašene od strane oglašivača. Isplate za usluge rezervacije i zakupa vrše se direktno na račun oglašivača koji je naveden u registracionoj prijavi oglašivača, dok postoji i mogućnost plaćanja u kešu, koju opciju oglašivač može navesti kao metod plaćanja.</p>
<p>Platforma rentaj.rs ne preuzima odgovornost za procesuiranje plaćanja, tačnost unetih podataka od strane oglašivača niti garantuje oglašivačima isplatu od strane korisnika.</p>
<p>Platforma rentaj.rs ne naplaćuje proviziju od zakupa niti ima uvid u finansijske transakcije oglašivača i trećih lica.</p>
<p>Sva plaćanja biće izvršena u lokalnoj valuti Republike Srbije — dinar (RSD). Za informativni prikaz cena u drugim valutama koristi se srednji kurs Narodne Banke Srbije. Iznos za koji će biti zadužena Vaša platna kartica biće izražen u Vašoj lokalnoj valuti kroz konverziju po kursu koji koriste kartičarske organizacije, a koji nama u trenutku transakcije ne može biti poznat. Kao rezultat ove konverzije postoji mogućnost neznatne razlike između originalne cene navedene na našem sajtu i one koju možete videti na izvodu po računu vaše platne kartice.</p>
<p><em>Napomena: Rentaj.rs nije u sistemu PDV-a, pa su cene oglasa iskazane bez PDV-a.</em></p>
<h2>Realizacija usluge</h2>
<p>Nakon izvršene kupovine i uspešne autorizacije plaćanja, kupcu se na registrovanu e-mail adresu dostavlja potvrda o realizaciji usluge. Usluga se smatra realizovanom u trenutku slanja navedene potvrde.</p>
<h2>Naknada za oglašavanje</h2>
<p>Platforma rentaj.rs ostvaruje prihode isključivo naplaćivanjem svog oglasnog prostora na web sajtu. Naknada se razlikuje u zavisnosti od paketa koji bira oglašivač, a može, pod određenim uslovima, biti i besplatna (u smislu promo perioda i dr.).</p>
<p>Naknada se uplaćuje na poslovni račun lica koje upravlja platformom i koje je registrovano u APR u skladu sa zakonom koji reguliše postupak registracije privrednih subjekata u nadležnom registru.</p>
<p>Poslovni račun na koji se vrše uplate od strane oglašivača je 160600000255740355 i vodi se kod Banca Intesa ad Beograd.</p>
<h2>Paketi usluga</h2>
<p>Platforma rentaj.rs omogućava oglašivačima izbor sledećih paketa usluga:</p>
<ul>
<li>Osnovni (mesečni, za jedan oglas)</li>
<li>Standardni (mesečni, za jedan oglas)</li>
<li>Pro (mesečni, isplativo za 3-4 oglasa)</li>
<li>Godišnji paket usluga (za koji se naplaćuje cena od 11 meseci, sa trajanjem 12 meseci)</li>
</ul>
<p>Oglašivač može, u svako doba, promeniti paket ili pak, za dva različita oglašavanja koristiti dva različita paketa. Ukoliko je od strane oglašivača odabran mesečni plan, standardni i pro paket se automatski obnavljaju.</p>
<p>Paketi traju ograničeno, u skladu sa onim što je naglašeno na samom web sajtu.</p>
<p>Paket koji sadrži promo period i koji je besplatan može se koristiti samo jednom od strane jednog oglašivača.</p>
<p>Takođe, na platformi je dostupna i opcija „istaknuti oglas" koja ima prioritet u odnosu na ostale (neistaknute) oglase i bolju vidljivost, a cena ove opcije je istaknuta na samoj platformi.</p>
<h2>Odgovornost platforme i odricanje od odgovornosti</h2>
<p>Platforma rentaj.rs ne odgovara za sadržaj koji je unet od strane oglašivača. Platforma rentaj.rs odgovara jedino za ispravno funkcionisanje same platforme i u tom smislu pruža, kako oglašivačima, tako i drugim korisnicima, podršku putem e-mail adrese koja je označena na samoj web prezentaciji.</p>
<p>Platforma rentaj.rs garantuje, svojom politikom privatnosti, tajnost određenih podataka.</p>
<p>Platforma rentaj.rs ne odgovara ukoliko do nefunkcionisanja web prezentacije dođe usled više sile, tehničkih problema kod trećih lica, prekida internet konekcije ili drugih okolnosti koje se nisu mogle predvideti ili izbeći.</p>
<p>Eventualne reklamacije korisnika u vezi tehničkog funkcionisanja platforme ili nepravilnog obračuna paketa mogu se podneti putem e-mail adrese <a href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>Politika reklamacija</h2>
<p>Ova Politika reklamacija definiše način ostvarivanja prava korisnika u vezi sa uslugama rezervacije putem platforme rentaj.rs.</p>
<p>Korisnik ima pravo da podnese reklamaciju u slučaju:</p>
<ul>
<li>tehničkih grešaka na platformi,</li>
<li>nepravilnog obračuna plaćenih oglasa,</li>
<li>drugih opravdanih razloga u skladu sa važećim propisima Republike Srbije.</li>
</ul>
<p>Reklamacija se podnosi elektronskim putem na e-mail adresu <a href="mailto:office@rentaj.rs">office@rentaj.rs</a> i treba da sadrži:</p>
<ul>
<li>ime i prezime korisnika,</li>
<li>broj korisničkog naloga ili identifikacioni broj transakcije,</li>
<li>datum i opis problema,</li>
<li>dokaz o izvršenoj uplati (ukoliko je primenljivo).</li>
</ul>
<p>Korisnik je u obavezi da reklamaciju podnese najkasnije u roku od 10 dana od dana nastanka razloga za reklamaciju.</p>
<h2>Rokovi za postupanje</h2>
<p>Platforma će bez odlaganja potvrditi prijem reklamacije. Odgovor na reklamaciju biće dostavljen korisniku najkasnije u roku od 8 dana od dana prijema reklamacije.</p>
<p>Rok za rešavanje reklamacije ne može biti duži od 14 dana od dana podnošenja reklamacije.</p>
<h2>Način rešavanja reklamacije</h2>
<p>U zavisnosti od prirode zahteva, reklamacija može biti rešena:</p>
<ul>
<li>otklanjanjem tehničke greške na platformi,</li>
<li>korekcijom obračuna plaćenih oglasa,</li>
<li>pružanjem podrške korisnicima u vezi sa korišćenjem platforme.</li>
</ul>
<p>Podnošenje reklamacije ne proizvodi dodatne troškove za korisnika.</p>
<h2>Povraćaj sredstava</h2>
<p>U slučaju povraćaja plaćenih oglasa kupcu koji je prethodno platio nekom od platnih kartica, delimično ili u celosti, iz razloga navedenih u Politici reklamacija, platforma rentaj.rs je u obavezi da povraćaj vrši isključivo preko VISA, EC/MC, Amex i DinaCard metoda plaćanja, što znači da će banka na zahtev platforme izvršiti povraćaj sredstava na račun korisnika platne kartice.</p>
<h2>Odgovornost oglašivača i korisnika</h2>
<p>Oglašivač je odgovoran za uneti sadržaj na platformu rentaj.rs. Oglašivač je isključivi vlasnik unetog sadržaja i ukoliko dođe do propusta ili greške prilikom unosa sadržaja od strane oglašivača, platforma rentaj.rs nije odgovorna ni po kakvom osnovu.</p>
<p>Oglašivači i korisnici sajta ne smeju:</p>
<ul>
<li>objavljivati neistinite, netačne podatke i informacije;</li>
<li>objavljivati obmanjujuće poruke koje mogu dovesti u zabludu ostale korisnike;</li>
<li>objavljivati nezakonit sadržaj i koristiti web prezentaciju rentaj.rs za druge nezakonite aktivnosti.</li>
</ul>
<p>Obaveza svih, kako korisnika, tako i oglašivača, je da poštuju pravo intelektualne svojine drugih korisnika web sajta.</p>
<h2>Odustajanje od kupovine</h2>
<p>Plaćeni oglasi na platformi rentaj.rs nisu predmet prava na odustanak u roku od 14 dana, jer se radi o naknadi za oglašavanje, a usluga je izvršena odmah nakon uplate.</p>
<h2>Izmene uslova</h2>
<p>Platforma rentaj.rs i operator platforme zadržava pravo da u svako doba izmeni ove OUP, ali se obavezuje da o izmenama obaveštava registrovana lica na samoj platformi. Nastavak korišćenja usluga smatra se pristankom na nove ili izmenjene OUP.</p>
<h2>Korespodencija</h2>
<p>Korespondencija između platforme rentaj.rs i trećih lica obavljaće se putem kontakt forme na samom web sajtu, putem kontakt telefona 064/2-7777-40 ili putem e-maila <a href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>Primena zakona</h2>
<p>Na sve što nije regulisano ovim OUP primenjivaće se propisi Republike Srbije.</p>
<h2>Rešavanje sporova</h2>
<p>Svi sporovi rešavaće se sporazumno, a za slučaj sudskog spora nadležan je Privredni sud u Sremskoj Mitrovici.</p>
<h2>Važenje opštih uslova</h2>
<p>Ovi OUP važe od dana objavljivanja na internet prezentaciji rentaj.rs i nisu vremenski ograničeni.</p>`.trim(),
    },
    en: {
      title: 'General Terms of Business',
      bodyHtml: `
<h2>Introduction</h2>
<p>These General Terms of Business ("GTB") govern the use of the website rentaj.rs (the "Website"), operated by the sole proprietorship Tamara Božović preduzetnik Veb portali RENTAJ.RS Nova Pazova, Tax ID (PIB) 115213635, Company Registration No. (MB) 68188032, with registered office in Nova Pazova, Janka Čmelika St. no. 2.</p>
<p>By using the platform, users (advertisers and end users) accept these General Terms of Business and agree to their continued application while using the Website.</p>
<h2>Basic terms</h2>
<p>The Rentaj.rs platform, operated by the sole proprietorship Tamara Božović preduzetnik Veb portali RENTAJ.RS Nova Pazova, is a website on which users (advertisers) post listings for renting out properties and other items.</p>
<p>A user (advertiser) is a person registered on the rentaj.rs platform who uses it to post listings for renting out properties and other items, and who may be a subscriber of the rentaj.rs platform.</p>
<p>End users (visitors) of the platform are third parties who, through the rentaj.rs platform, rent properties and other items for the purpose of staying in them (short-term or long-term).</p>
<h2>Services</h2>
<p>The rentaj.rs website enables advertisers (owners or users of properties, as well as other items suitable for renting) to advertise, through the rentaj.rs platform, their properties intended for renting (one-time or long-term), while end users (website visitors) use it to book the services provided by advertisers through the rentaj.rs website.</p>
<p>The services consist of the following:</p>
<ul>
<li>the rentaj.rs platform enables property owners to use the platform, under these GTB, by advertising their properties intended for short-term or long-term lease;</li>
<li>the rentaj.rs platform enables end users to book an advertiser's property (or properties) through the rentaj.rs platform, under these GTB;</li>
<li>these GTB apply, within the territory of the Republic of Serbia, to tourist and non-tourist accommodation intended for renting to third parties (users), as well as other services suitable for renting and similar.</li>
</ul>
<h2>Advertiser registration</h2>
<p>Advertisers register (Registration, on the website under the "Owner" option) through the rentaj.rs website by providing their email address, thereby creating a user account protected by a password in order to access the site. The username is available to third parties, while the password is confidential information available exclusively to the advertiser and may be changed during the life of the account.</p>
<p>The rentaj.rs platform offers advertisers the following registration methods:</p>
<ul>
<li>registration via email address;</li>
<li>registration via Google account;</li>
<li>registration via Facebook account.</li>
</ul>
<p>Advertiser registration is free of charge and permanent.</p>
<p>A user account can be deleted at any time, free of charge.</p>
<h2>Registration of service users</h2>
<p>Service users register (on the website under the "Guest" option) through the rentaj.rs website by providing their email address, thereby creating a user account protected by a password in order to access the site. The username is available to third parties, while the password is confidential information available exclusively to the user and may be changed during the life of the account.</p>
<p>The rentaj.rs platform offers service users the following registration methods:</p>
<ul>
<li>registration via email address;</li>
<li>registration via Google account;</li>
<li>registration via Facebook account.</li>
</ul>
<h2>Payment for services</h2>
<p>The rentaj.rs platform allows service users to book a property (properties) and other services advertised by advertisers, in accordance with these General Terms. Payments for booking and rental services are made directly to the advertiser's account stated in the advertiser's registration application, and there is also the option of cash payment, which the advertiser may specify as a payment method.</p>
<p>The rentaj.rs platform does not assume responsibility for processing payments or for the accuracy of information entered by the advertiser, nor does it guarantee advertisers that payment will be made by the user.</p>
<p>The rentaj.rs platform does not charge a commission on rentals and has no insight into the financial transactions between advertisers and third parties.</p>
<p>All payments will be made in the local currency of the Republic of Serbia — the dinar (RSD). For informational display of prices in other currencies, the National Bank of Serbia's median exchange rate is used. The amount charged to your payment card will be expressed in your local currency through conversion at the exchange rate used by the card organizations, which we cannot know at the time of the transaction. As a result of this conversion, there may be a slight difference between the original price stated on our website and the one shown on your card statement.</p>
<p><em>Note: Rentaj.rs is not registered for VAT, so listing prices are stated without VAT.</em></p>
<h2>Fulfillment of the service</h2>
<p>After a purchase is completed and payment is successfully authorized, a confirmation of service fulfillment is sent to the buyer's registered email address. The service is considered fulfilled at the moment this confirmation is sent.</p>
<h2>Advertising fee</h2>
<p>The rentaj.rs platform generates revenue exclusively by charging for its advertising space on the website. The fee varies depending on the package chosen by the advertiser, and may, under certain conditions, be free of charge (e.g. during a promotional period).</p>
<p>The fee is paid into the business account of the entity operating the platform, registered with the Serbian Business Registers Agency (APR) in accordance with the law governing the registration of business entities in the competent register.</p>
<p>The business account to which advertisers make payments is 160600000255740355, held with Banca Intesa ad Beograd.</p>
<h2>Service packages</h2>
<p>The rentaj.rs platform allows advertisers to choose from the following service packages:</p>
<ul>
<li>Basic (monthly, for one listing)</li>
<li>Standard (monthly, for one listing)</li>
<li>Pro (monthly, cost-effective for 3–4 listings)</li>
<li>Annual package (charged at the price of 11 months, with a 12-month duration)</li>
</ul>
<p>An advertiser may change their package at any time, or use two different packages for two different listings. If an advertiser has selected the monthly plan, the Standard and Pro packages renew automatically.</p>
<p>Packages last for a limited period, in accordance with what is stated on the website itself.</p>
<p>A package that includes a free promotional period may be used only once by any one advertiser.</p>
<p>The platform also offers a "featured listing" option, which is given priority over other (non-featured) listings and greater visibility; the price of this option is stated on the platform itself.</p>
<h2>Platform liability and disclaimer</h2>
<p>The rentaj.rs platform is not responsible for content entered by advertisers. The rentaj.rs platform is responsible only for the correct functioning of the platform itself, and in that regard provides support to both advertisers and other users via the email address stated on the website.</p>
<p>The rentaj.rs platform guarantees, through its privacy policy, the confidentiality of certain data.</p>
<p>The rentaj.rs platform is not liable if the website fails to function due to force majeure, technical problems on the part of third parties, internet connection interruptions, or other circumstances that could not have been foreseen or avoided.</p>
<p>Any user complaints regarding the technical functioning of the platform or incorrect package billing may be submitted via email to <a href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>Complaints policy</h2>
<p>This Complaints Policy defines how users may exercise their rights regarding booking services provided through the rentaj.rs platform.</p>
<p>A user has the right to file a complaint in the event of:</p>
<ul>
<li>technical errors on the platform,</li>
<li>incorrect billing of paid listings,</li>
<li>other justified reasons in accordance with applicable regulations of the Republic of Serbia.</li>
</ul>
<p>A complaint is submitted electronically to the email address <a href="mailto:office@rentaj.rs">office@rentaj.rs</a> and should include:</p>
<ul>
<li>the user's first and last name,</li>
<li>the user account number or transaction identification number,</li>
<li>the date and description of the issue,</li>
<li>proof of payment made (where applicable).</li>
</ul>
<p>The user must submit the complaint no later than 10 days from the date the grounds for the complaint arose.</p>
<h2>Response deadlines</h2>
<p>The platform will confirm receipt of the complaint without delay. A response to the complaint will be delivered to the user no later than 8 days from the date the complaint is received.</p>
<p>The deadline for resolving a complaint may not exceed 14 days from the date the complaint is submitted.</p>
<h2>How complaints are resolved</h2>
<p>Depending on the nature of the request, a complaint may be resolved by:</p>
<ul>
<li>fixing a technical error on the platform,</li>
<li>correcting the billing of paid listings,</li>
<li>providing user support regarding the use of the platform.</li>
</ul>
<p>Filing a complaint does not result in any additional cost to the user.</p>
<h2>Refunds</h2>
<p>In the event of a refund to a buyer who has previously paid, in full or in part, by payment card, for reasons stated in the Complaints Policy, the rentaj.rs platform is required to process the refund exclusively through the VISA, EC/MC, Amex, and DinaCard payment methods, meaning the bank will, at the platform's request, refund the funds to the payment card holder's account.</p>
<h2>Liability of advertisers and users</h2>
<p>The advertiser is responsible for the content entered on the rentaj.rs platform. The advertiser is the exclusive owner of the content they enter, and if any omission or error occurs when the advertiser enters content, the rentaj.rs platform bears no responsibility on any grounds.</p>
<p>Advertisers and website users may not:</p>
<ul>
<li>publish untrue or inaccurate data and information;</li>
<li>publish misleading messages that could deceive other users;</li>
<li>publish unlawful content or use the rentaj.rs website for other unlawful activities.</li>
</ul>
<p>All users and advertisers are obligated to respect the intellectual property rights of other website users.</p>
<h2>Withdrawal from purchase</h2>
<p>Paid listings on the rentaj.rs platform are not subject to the 14-day right of withdrawal, as they constitute an advertising fee and the service is performed immediately upon payment.</p>
<h2>Changes to these terms</h2>
<p>The rentaj.rs platform and its operator reserve the right to amend these GTB at any time, but undertake to notify registered persons of any changes on the platform itself. Continued use of the services after a change is considered acceptance of the new or amended GTB.</p>
<h2>Correspondence</h2>
<p>Correspondence between the rentaj.rs platform and third parties will take place via the contact form on the website, via the contact phone number 064/2-7777-40, or via email at <a href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>Applicable law</h2>
<p>For anything not regulated by these GTB, the regulations of the Republic of Serbia shall apply.</p>
<h2>Dispute resolution</h2>
<p>All disputes will be resolved amicably; in the event of litigation, the Commercial Court in Sremska Mitrovica has jurisdiction.</p>
<h2>Validity of these general terms</h2>
<p>These GTB are valid from the date of publication on the rentaj.rs website and are not limited in time.</p>`.trim(),
    },
  },
  {
    // Same migration note as uslovi-koriscenja above — real text from
    // staging.rentaj.rs/politika-privatnosti, 2026-08-20.
    slug: 'politika-privatnosti',
    sr: {
      title: 'Politika privatnosti',
      bodyHtml: `
<h2>1. Uvod</h2>
<p>Platforma rentaj.rs (kojom upravlja Tamara Božović preduzetnik Veb portali RENTAJ.RS Nova Pazova, MB 68188032, PIB 115213635, sa sedištem u Novoj Pazovi, Janka Čmelika br. 2) obavezuje se da štiti podatke svih korisnika platforme, na način kako je to propisano zakonodavstvom Republike Srbije, a naročito u skladu sa Zakonom o zaštiti podataka o ličnosti („Sl. glasnik RS", br. 87/2018). Podacima rukuje isključivo platforma rentaj.rs.</p>
<p>Podatak o ličnosti predstavlja svaki podatak koji se odnosi na fizičko lice čiji je identitet određen ili odrediv, neposredno ili posredno, posebno na osnovu oznake identiteta, kao što je ime i identifikacioni broj, podataka o lokaciji, identifikatora u elektronskim komunikacionim mrežama ili jednog, odnosno više obeležja njegovog fizičkog, fiziološkog, genetskog, mentalnog, ekonomskog, kulturnog i društvenog identiteta.</p>
<p>Pod obradom podataka o ličnosti podrazumeva se svaka radnja ili skup radnji koje se vrše automatizovano ili neautomatizovano sa podacima o ličnosti ili njihovim skupovima, kao što su prikupljanje, beleženje, razvrstavanje, grupisanje, odnosno strukturisanje, pohranjivanje, upodobljavanje ili menjanje, otkrivanje, uvid, upotreba, otkrivanje prenosom, odnosno dostavljanjem, umnožavanje, širenje ili na drugi način činjenje dostupnim, upoređivanje, ograničavanje, brisanje ili uništavanje.</p>
<p>Obrađivačem podataka, u skladu sa zakonom, u konkretnom smislu smatra se platforma rentaj.rs.</p>
<h2>2. Podaci koje platforma rentaj.rs prikuplja</h2>
<p>Podaci koje platforma rentaj.rs prikuplja podeljeni su u dve grupe: podaci o oglašivačima i podaci o krajnjim korisnicima.</p>
<p>Podaci o oglašivačima su:</p>
<ul>
<li>adresa elektronske pošte (u daljem tekstu: e-mail)</li>
<li>korisničko ime</li>
<li>lozinka</li>
<li>broj telefona oglašivača</li>
<li>lokacija objekta oglašivača ili lokacija usluge oglašivača</li>
</ul>
<p>Takođe, oglašivači mogu ostavljati i druge podatke, na sopstvenu odgovornost, kao što su, na primer, podaci o načinu uplate za usluge koje oglašivači pružaju, te sve druge informacije neophodne za svrhu zbog koje su isti registrovani na platformi rentaj.rs.</p>
<p>Podaci o krajnjim korisnicima su:</p>
<ul>
<li>adresa elektronske pošte (u daljem tekstu: e-mail)</li>
<li>korisničko ime</li>
<li>lozinka</li>
<li>broj telefona krajnjeg korisnika</li>
</ul>
<p>Ukoliko se prijava — registracija na platformu rentaj.rs vrši posredstvom neke druge platforme (npr. Google, Facebook, Outlook i sl.), platforma rentaj.rs prikuplja podatke koji su dostupni od strane tih drugih platformi. U skladu sa politikama privatnosti drugih platformi sa kojih se prikupljaju podaci, platforma rentaj.rs neće prikupljati lozinku sa drugih platformi, budući da ona predstavlja tajni podatak.</p>
<p>Pored ovih podataka, platforma rentaj.rs omogućava oglašivačima i krajnjim korisnicima mogućnost razmene međusobnih poruka. Platforma rentaj.rs neće otkrivati sadržaj poruka trećim licima, niti će činiti dostupnim razmenjene podatke, sem u slučajevima predviđenim Zakonom. Razmenjene poruke između oglašivača i krajnjih korisnika predstavljaju tajnu.</p>
<h2>3. Svrha i način prikupljanja i obrade podataka</h2>
<p>Svi podaci koji su navedeni u prethodnom odeljku prikupljaju se u svrhu funkcionisanja platforme rentaj.rs, u svemu u skladu sa Opštim uslovima poslovanja platforme rentaj.rs, a sve radi upravljanja korisničkim nalozima, međusobne komunikacije korisnika platforme, te radi eventualnog sprečavanja zloupotrebe korišćenja platforme rentaj.rs.</p>
<p>Podaci se prikupljaju direktno od korisnika prilikom same registracije na platformu rentaj.rs, kao i automatski posredstvom kolačića („cookies") prilikom korišćenja platforme rentaj.rs. Platforma rentaj.rs koristi neophodne kolačiće koji su neophodni za osnovno funkcionisanje sajta, kao i opcione kolačiće (npr. analitičke) koji se koriste isključivo uz saglasnost korisnika. Korisnicima je omogućeno da prilikom prve posete sajtu prihvate ili odbiju upotrebu kolačića koji nisu neophodni, putem odgovarajućeg obaveštenja (cookie banner).</p>
<p>Podaci svih registrovanih lica čuvaju se u skladu sa propisima Republike Srbije i mogu biti dostupni trećim licima samo na način predviđen zakonima Republike Srbije, a svako lice ima pravo da traži brisanje svojih podataka, pri čemu je platforma rentaj.rs dužna da, prilikom brisanja registracije lica na platformi rentaj.rs, izbriše podatke u svemu u skladu sa čl. 30 Zakona o zaštiti podataka o ličnosti.</p>
<p>Podaci o ličnosti mogu se deliti u sledećim slučajevima:</p>
<ul>
<li>oglašivač – krajnji korisnik – a sve u cilju funkcionisanja platforme, budući da bez vidljivih podataka (npr. ime oglašivača, vrsta usluge, mesto usluge ili objekta, e-mail i dr.) nije moguće pružanje usluga od strane platforme rentaj.rs;</li>
<li>zakonska obaveza davanja podataka – u slučaju da nadležni državni organ u Republici Srbiji zahteva od platforme rentaj.rs da se dostave određeni podaci;</li>
<li>uz izričitu saglasnost registrovanih lica.</li>
</ul>
<p><strong>Podaci o platnim karticama:</strong></p>
<p>Platforma rentaj.rs ne prikuplja, ne obrađuje, ne čuva niti arhivira podatke o platnim karticama korisnika, uključujući broj platne kartice, datum isteka i sigurnosni kod (CVC2/CVV), ni u elektronskom ni u bilo kom drugom obliku.</p>
<p>Prilikom unošenja podataka o platnoj kartici, poverljive informacije se prenose putem javne mreže u zaštićenoj (kriptovanoj) formi upotrebom SSL protokola i PKI sistema, kao trenutno najsavremenije kriptografske tehnologije.</p>
<p>Sigurnost podataka prilikom kupovine garantuje procesor platnih kartica, Banca Intesa ad Beograd, pa se tako kompletan proces naplate obavlja na stranicama banke. Ni u jednom trenutku podaci o platnoj kartici nisu dostupni našem sistemu.</p>
<h2>4. Čuvanje podataka, odricanje od odgovornosti</h2>
<p>Platforma rentaj.rs obavezuje se da podatke čuva u skladu sa važećim propisima u Republici Srbiji. Ukoliko dođe do promene propisa koji znatno utiču na zaštitu prava podataka o ličnosti, platforma rentaj.rs obavezuje se da sva registrovana lica čiji su podaci registrovani na samoj platformi obavesti i predoči im nove uslove poslovanja i politike privatnosti.</p>
<p>Platforma rentaj.rs ne ulazi u istinitost i tačnost podataka koji su registrovani na samoj platformi. U vezi sa tim, platforma rentaj.rs nije odgovorna za obradu plaćanja koja se vrše direktno na račun oglašivača ili putem platforme, budući da ista nema uvid u finansijske tokove oglašivač-korisnik, niti ima mehanizam provere tačnosti unetih podataka. Takođe, platforma rentaj.rs ne garantuje ni oglašivačima da će obaveza plaćanja od strane krajnjih korisnika biti ispunjena, niti je u obavezi da dostavlja oglašivačima podatke krajnjih korisnika, i obrnuto.</p>
<p>Trećim licima onemogućen je pristup registrovanim podacima koji se čuvaju u skladu sa propisima Republike Srbije, te se u tom smislu platforma rentaj.rs obavezuje da obezbedi da treća lica ne mogu doći do tih podataka, i u tom cilju preduzima tehničke i druge mere za zaštitu svih podataka koji se štite Zakonom o zaštiti podataka o ličnosti.</p>
<p>Internet prodajno mesto ne koristi linkove ka spoljnim sajtovima trećih strana, osim kada je to neophodno za obradu porudžbine i uz prethodno obaveštavanje korisnika. Platforma rentaj.rs preduzima tehničke i organizacione mere kako bi zaštitila podatke korisnika i ne preuzima odgovornost za sadržaje i funkcionalnosti trećih strana.</p>
<h2>5. Prava oglašivača i krajnjih korisnika</h2>
<p>Oglašivači i krajnji korisnici platforme rentaj.rs imaju sledeća prava:</p>
<ul>
<li>Pravo na pristup platformi rentaj.rs uz korišćenje podataka;</li>
<li>Pravo na informisanje – registrovani korisnici imaju pravo da se informišu na koji način se njihovi podaci obrađuju i za koju svrhu;</li>
<li>Pravo na pristup korisničkom nalogu i pravo na uvid u istoriju komunikacije sa trećim licima, pravo na uvid u prethodne transakcije, te pravo na brisanje poruka na platformi;</li>
<li>Pravo na ispravljanje podataka i pravo na brisanje podataka – svi registrovani podaci mogu biti ispravljeni na zahtev registrovanih lica, ali i obrisani ukoliko su netačni ili neistiniti, s tim da, ukoliko registrovano lice ima nameru da i dalje koristi platformu rentaj.rs, minimum podataka mora postojati da bi se ostvarila svrha same registracije;</li>
<li>Pravo na prigovor;</li>
<li>Pravo na opozivanje pristanka za obradu;</li>
<li>Pravo na trajno brisanje podataka kroz opciju na svom profilu „brisanje korisničkog naloga" (brisanjem korisničkog naloga brišu se i podaci);</li>
<li>Pravo da ne pristanu na marketinške aktivnosti – korisnici platforme imaju pravo da u svakom trenutku odbiju ili povuku saglasnost za prijem promotivnih i marketinških obaveštenja. Davanje saglasnosti za marketinške aktivnosti nije uslov za korišćenje platforme rentaj.rs.</li>
</ul>
<p>Prigovori i zahtevi u vezi sa Vašim podacima ostvarivaće se putem e-mail adrese <a href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>6. Završne odredbe</h2>
<p>Prihvatanjem Opštih uslova poslovanja i ove Politike privatnosti, saglasni ste sa svim gore navedenim, te samim tim dajete svoj pristanak na ovakav način obrade podataka o ličnosti.</p>`.trim(),
    },
    en: {
      title: 'Privacy Policy',
      bodyHtml: `
<h2>1. Who the data controller is</h2>
<p>The rentaj.rs platform (operated by Tamara Božović preduzetnik Veb portali RENTAJ.RS Nova Pazova, Company Registration No. (MB) 68188032, Tax ID (PIB) 115213635, with registered office in Nova Pazova, Janka Čmelika St. no. 2) undertakes to protect the data of all platform users in the manner prescribed by the legislation of the Republic of Serbia, in particular in accordance with the Law on Personal Data Protection ("Official Gazette of RS", No. 87/2018). Data is processed exclusively by the rentaj.rs platform.</p>
<p>Personal data means any data relating to a natural person whose identity is determined or determinable, directly or indirectly, in particular by reference to an identifier such as a name and identification number, location data, an identifier in electronic communication networks, or one or more factors specific to that person's physical, physiological, genetic, mental, economic, cultural, or social identity.</p>
<p>Processing of personal data means any operation or set of operations performed on personal data or sets of personal data, whether automated or not, such as collection, recording, classification, grouping or structuring, storage, adaptation or alteration, retrieval, consultation, use, disclosure by transmission or otherwise making available, alignment or combination, restriction, erasure, or destruction.</p>
<p>The data processor, in accordance with the law, is in this specific case the rentaj.rs platform.</p>
<h2>2. What data the rentaj.rs platform collects</h2>
<p>The data collected by the rentaj.rs platform is divided into two groups: data about advertisers and data about end users.</p>
<p>Data about advertisers:</p>
<ul>
<li>email address</li>
<li>username</li>
<li>password</li>
<li>advertiser's phone number</li>
<li>the location of the advertiser's property or the location of the advertiser's service</li>
</ul>
<p>Advertisers may also provide other data, at their own responsibility, such as details of how they wish to be paid for the services they provide, and any other information necessary for the purpose for which they registered on the rentaj.rs platform.</p>
<p>Data about end users:</p>
<ul>
<li>email address</li>
<li>username</li>
<li>password</li>
<li>end user's phone number</li>
</ul>
<p>If registration on the rentaj.rs platform is carried out through another platform (e.g. Google, Facebook, Outlook, etc.), the rentaj.rs platform collects the data made available by those other platforms. In accordance with the privacy policies of the other platforms from which data is collected, the rentaj.rs platform will not collect the password from other platforms, as it is confidential information.</p>
<p>In addition to this data, the rentaj.rs platform enables advertisers and end users to exchange messages with each other. The rentaj.rs platform will not disclose the content of messages to third parties, nor make the exchanged data available, except in cases provided for by law. Messages exchanged between advertisers and end users are confidential.</p>
<h2>3. Purpose and manner of collecting and processing data</h2>
<p>All data listed in the previous section is collected for the purpose of the functioning of the rentaj.rs platform, entirely in accordance with the rentaj.rs platform's General Terms of Business, for the purposes of managing user accounts, communication between platform users, and preventing potential misuse of the rentaj.rs platform.</p>
<p>Data is collected directly from users during registration on the rentaj.rs platform, as well as automatically through cookies while using the rentaj.rs platform. The rentaj.rs platform uses cookies necessary for the basic functioning of the site, as well as optional cookies (e.g. analytics) used only with the user's consent. Users are able, on their first visit to the site, to accept or decline the use of non-essential cookies via the appropriate notice (cookie banner).</p>
<p>Data of all registered persons is stored in accordance with the regulations of the Republic of Serbia and may be made available to third parties only in a manner provided for by the laws of the Republic of Serbia. Every person has the right to request the deletion of their data, and the rentaj.rs platform is obliged, when deleting a person's registration on the platform, to delete such data entirely in accordance with Article 30 of the Law on Personal Data Protection.</p>
<p>Personal data may be shared in the following cases:</p>
<ul>
<li>advertiser – end user – all for the purpose of the platform's functioning, since without visible data (e.g. the advertiser's name, type of service, location of the service or property, email, etc.) the platform could not provide its services;</li>
<li>a legal obligation to provide data – where a competent state authority in the Republic of Serbia requires the rentaj.rs platform to provide certain data;</li>
<li>with the explicit consent of the registered persons.</li>
</ul>
<p><strong>Payment card data:</strong></p>
<p>The rentaj.rs platform does not collect, process, store, or archive users' payment card data, including the card number, expiry date, and security code (CVC2/CVV), either electronically or in any other form.</p>
<p>When entering payment card data, confidential information is transmitted over the public network in protected (encrypted) form using the SSL protocol and PKI system, currently the most advanced cryptographic technology available.</p>
<p>The security of your data during a purchase is guaranteed by the payment card processor, Banca Intesa ad Beograd, meaning the entire billing process takes place on the bank's own pages. At no point is your payment card data available to our system.</p>
<h2>4. Data retention, disclaimer</h2>
<p>The rentaj.rs platform undertakes to store data in accordance with applicable regulations in the Republic of Serbia. Should regulations change in a way that significantly affects the protection of personal data rights, the rentaj.rs platform undertakes to inform all registered persons whose data is registered on the platform and to present them with the new terms of business and privacy policy.</p>
<p>The rentaj.rs platform does not assess the truthfulness or accuracy of the data registered on the platform. In this regard, the rentaj.rs platform is not responsible for the processing of payments made directly to an advertiser's account or through the platform, as it has no insight into the financial flows between advertiser and user, nor a mechanism for verifying the accuracy of entered data. Likewise, the rentaj.rs platform does not guarantee advertisers that end users will fulfil their payment obligations, nor is it obliged to provide advertisers with end users' data, or vice versa.</p>
<p>Third parties are prevented from accessing registered data stored in accordance with the regulations of the Republic of Serbia; in this regard, the rentaj.rs platform undertakes to ensure that third parties cannot access such data, and to that end takes technical and other measures to protect all data protected under the Law on Personal Data Protection.</p>
<p>The online store does not use links to external third-party websites, except where necessary to process an order and after prior notice to the user. The rentaj.rs platform takes technical and organizational measures to protect user data and does not assume responsibility for the content and functionality of third parties.</p>
<h2>5. Rights of advertisers and end users</h2>
<p>Advertisers and end users of the rentaj.rs platform have the following rights:</p>
<ul>
<li>The right to access the rentaj.rs platform using their data;</li>
<li>The right to be informed – registered users have the right to be informed of how their data is processed and for what purpose;</li>
<li>The right to access their user account and to view the history of communication with third parties, the right to view past transactions, and the right to delete messages on the platform;</li>
<li>The right to correct data and the right to delete data – all registered data may be corrected at the request of the registered person, and also deleted if inaccurate or untrue, provided that, if the registered person intends to continue using the rentaj.rs platform, a minimum amount of data must remain so the purpose of registration can still be fulfilled;</li>
<li>The right to object;</li>
<li>The right to withdraw consent to processing;</li>
<li>The right to permanent deletion of data through the "delete account" option in their profile (deleting the user account also deletes the data);</li>
<li>The right not to consent to marketing activities – platform users have the right, at any time, to decline or withdraw consent to receive promotional and marketing messages. Consenting to marketing activities is not a condition for using the rentaj.rs platform.</li>
</ul>
<p>Objections and requests regarding your data may be submitted via email at <a href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>6. Final provisions</h2>
<p>By accepting the General Terms of Business and this Privacy Policy, you agree with everything stated above, and thereby give your consent to this manner of processing personal data.</p>`.trim(),
    },
  },
];
