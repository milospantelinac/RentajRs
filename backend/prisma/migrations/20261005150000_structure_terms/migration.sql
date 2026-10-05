-- Dizajn 49: the general terms keep every word of the text that was live on
-- rentaj.dev (saved through Administracija > Sadrzaj on 2026-08-24) and only
-- their markup changes: the eighteen uppercase bold paragraphs become h2,
-- "Rokovi za postupanje" and "Nacin resavanja reklamacije" become h3, the
-- two registration lines become a list (dropping the "·" they started with,
-- as the ticket asks), the VAT note becomes a note block, and italics, bold
-- inside links and Word leftovers go. The page builds its "Sadrzaj" list and
-- the section anchors from the h2s.
--
-- The row changes only while it still holds that live text or the older
-- seed text, so terms edited in the admin since are left alone. updatedAt is
-- not touched, so the page keeps "Poslednja izmena: 24. 8. 2026.".
UPDATE "StaticPage"
SET "bodyHtml" = $body$<h2>UVOD</h2>
<p>Opštim uslovima poslovanja (u daljem tekstu: ,,OUP“) reguliše se korišćenje web sajta <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> (u daljem tekstu: ,,web sajt“), kojom upravlja preduzetnik Tamara Božović preduzetnik Veb portali <a target="_blank" rel="noopener noreferrer nofollow" href="http://RENTAJ.RS">RENTAJ.RS</a> Nova Pazova PIB 115213635, MB 68188032 sa sedištem u Novoj Pazovi, ul. Janka Čmelika br. 2</p>
<p>Korišćenjem plaforme korisnici (oglašivači i krajnji korisnici) prihvataju ove opšte uslove poslovanja i saglasni su sa njihovom daljom primenom prilikom korišćenja web sajta.</p>
<h2>OSNOVNI POJMOVI</h2>
<ol>
<li><p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://Rentaj.rs">Rentaj.rs</a>, kojom upravlja preduzetnik Tamara Božović preduzetnik Veb portali <a target="_blank" rel="noopener noreferrer nofollow" href="http://RENTAJ.RS">RENTAJ.RS</a> Nova Pazova, je internet stranica na koju korisnici (oglašivači) postavljaju oglase za rentiranje (iznajmljivanje) objekata i dr.</p></li>
<li><p>Korisnik (oglašivač) je lice koje je registrovano na platformi <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> i koje koristi isti u cilju postavljanja oglasa za rentiranje (iznajmljivanje) objekata i dr. i koje može biti u pretplatničkom odnosu prema platformi <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a></p></li>
<li><p>Krajnji korisnici (posetioci) platforme su treća lica koja posredstvom platforme <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> iznajmljuju objekte i dr. u cilju boravka u istima (kratkoročno ili dugoročno)</p></li>
</ol>
<h2>USLUGE</h2>
<p>Web sajt <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> omogućava oglašivačima (vlasicima objekata ili korisnicima objekata, ali i drugih stvari podobnih za iznajmljivanje) da posredstvom platforme <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> oglašavaju svoje objekte namenjene rentiranju (jednokratnom ili dugoročnom rentiranju), a krajnji korisnici (posetioci web sajta) putem istog rezervišu usluge pružene od strane oglašivača koristeći web sajt <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a></p>
<p>Usluge se sastoje u sledećem:</p>
<ul>
<li><p>platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> omogućava vlasnicima objekta da, pod ovim OUP, koriste platformu na taj način što će oglašavati svoje objekte namenjene kratkoročnom ili dugoročnom zakupu;</p></li>
<li><p>platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> omogućava krajnjim korisnicima da, putem platforme <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a>, rezervišu objekat (ili objekte) oglašivača pod ovim OUP;</p></li>
<li><p>ovi OUP se odnose na teritoriju Republike Srbije na smeštajne turističke i neturističke objekte namenjene izdavanju trećim licima (korisnicima), kao i druge usluge koje su podobne za izdavanje u zakup i sl;</p></li>
</ul>
<h2>REGISTRACIJA</h2>
<p>Korisnici se registruju putem web sajta <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a>, ostavljajući svoju e-mail adresu, pri čemu kreiraju korisnički nalog sa zaštitnom lozinkom kako bi mogli pristupiti sajtu. Korisničko ime je dostupno trećim licima, dok je lozinka tajni podatak dostupan isključivo korisniku i može se menjati u toku trajanja naloga. Prilikom registracije isti nalog omogućava korisniku da rezerviše objekte kao krajnji korisnik i/ili da postavlja sopstvene oglase i tako postane oglašivač, u zavisnosti od toga kako koristi platformu.</p>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> nudi sledeće načine registracije:</p>
<ul>
<li><p>registracija putem e-mail adrese;</p></li>
<li><p>registracija putem Google naloga;</p></li>
</ul>
<p>Registracija je besplatna i trajna.</p>
<p>Korisnički nalog može se obrisati u svako doba, bez naknade.</p>
<h2>PLAĆANJE USLUGA</h2>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> omogućava korisnicima usluge da rezervišu objekat (objekte) i druge usluge u skladu sa ovim Opštim uslovima, oglašene od strane oglašivača. Isplate za usluge rezervacije i zakupa vrše se direktno na račun oglašivača koji je naveden u registracionoj prijavi oglašivača, dok postoji i mogućnost plaćanja u kešu, koju opciju oglašivač može navesti kao metod plaćanja.</p>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> ne preuzima odgovoronost za procesuiranje plaćanja, tačnost unetih podataka od strane oglašivača niti garantuje oglašivačima isplatu od strane korisnika.</p>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> ne naplaćuje proviziju od zakupa niti ima uvid u finansijske transakcije oglašivača i trećih lica.</p>
<p>Sva plaćanja biće izvršena u lokalnoj valuti Republike Srbije – dinar (RSD).Za informativni prikaz cena u drugim valutama koristi se srednji kurs Narodne Banke Srbije. Iznos za koji će biti zadužena Vaša platna kartica biće izražen u Vašoj lokalnoj valuti kroz konverziju u istu po kursu koji koriste kartičarske organizacije, a koji nama u trenutku transakcije ne može biti poznat. Kao rezultat ove konverzije postoji mogućnost neznatne razlike od originalne cene navedene na našem sajtu. i one koju možete videti na izvodu po računu vaše platne kartice.</p>
<p class="legal-note">Napomena: <a target="_blank" rel="noopener noreferrer nofollow" href="http://Rentaj.rs">Rentaj.rs</a> nije u sistemu PDV-a, pa su cene oglasa iskazane bez PDV-a.</p>
<h2>REALIZACIJA USLUGE</h2>
<p>Nakon izvršene kupovine i uspešne autorizacije plaćanja, kupcu se na registrovanu e-mail adresu dostavlja potvrda o realizaciji usluge. Usluga se smatra realizovanom u trenutku slanja navedene potvrde.</p>
<h2>NAKNADA ZA OGLAŠAVANJE</h2>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> ostvaruje prihode isključivo naplaćivanjem svog oglasnog prostora na web sajtu. Naknada se razlikuje u zavisnosti od paketa koji bira oglašivač, a može, pod određenim uslovima biti i besplatna (u smislu promo perioda i dr.).</p>
<p>Naknada se uplaćuje na poslovni račun lica koje upravlja platformom i koje je registrovano u APR u skladu sa zakonom koji reguliše postupak registacije privrednih subjekata u nadležnom registru.</p>
<p>Poslovni račun na koji se vrše uplate od strane oglašivača je 160600000255740355 i vodi se kod Banca Intesa ad Beograd.</p>
<h2>PAKETI USLUGA</h2>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> omogućava oglašivačima izbor sledećih paketa usluga:</p>
<ul>
<li><p>Osnovni (mesečni za jedan oglas)</p></li>
<li><p>Standardni (mesečni za jedan oglas)</p></li>
<li><p>Pro (mesečni, isplativo za 3-4 oglasa)</p></li>
<li><p>Godišnji paket usluga (za koji se naplaćuje cena od 11 meseci, sa trajanjem 12 meseci)</p></li>
</ul>
<p>Oglašivač može, u svako doba promeniti paket ili pak, za dva različita oglašavanja koristiti dva različita paketa. Svaki paket važi 30 dana od dana aktivacije i ne obnavlja se automatski – oglašivač sam odlučuje da li i kada će produžiti paket nakon isteka.</p>
<p>Paketi traju ograničeno, u skladu sa onim što je naglašeno na samom web sajtu.</p>
<p>Paket koji sadrži promo period i koji je besplatan može se koristiti samo jednom od strane jednog oglašivača.</p>
<p>Takođe na platformi će biti dostupna i opcija ,,istaknuti oglas“ koji će imati priroritet odnosu na ostale (neistaknute oglase) i bolju vidljivost, a cena ove opcije biće istaknuta na samoj platformi.</p>
<h2>ODGOVORNOST PLATFORME I ODRICANJE OD ODGOVORNOSTI</h2>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> ne odgovara za sadržaj koji je unet od strane oglašivača. Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> odgovara jedino za ispravno funkcionisanje same platforme i u tom smislu pruža, kako oglašivačima, tako i drugim korisnicima podršku putem e-mail adrese koja je označena na samoj web prezentaciji.</p>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> garantuje, svojom politikom privatnosti, tajnost određenih podataka.</p>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> ne odgovara ukoliko do nefunkcionisanja web prezentacije dođe usled više sile, tehničkih problema kod trećih lica, prekida internet konekcije ili drugih okolnosti koje se nisu mogle predvideti ili izbeći.</p>
<p>Eventualne reklamacije korisnika u vezi tehničkog funkcionisanja platforme ili nepravilnog obračuna paketa mogu se podneti putem e-mail adrese <a target="_blank" rel="noopener noreferrer nofollow" href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>POLITIKA REKLAMACIJA</h2>
<p>Ova Politika reklamacija definiše način ostvarivanja prava korisnika u vezi sa uslugama rezervacije putem platforme <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a>.</p>
<p>Korisnik ima pravo da podnese reklamaciju u slučaju:</p>
<ul>
<li><p>tehničkih grešaka na platformi,</p></li>
<li><p>nepravilnog obračuna plaćenih oglasa,</p></li>
<li><p>drugih opravdanih razloga u skladu sa važećim propisima Republike Srbije.</p></li>
</ul>
<p>Reklamacija se podnosi elektronskim putem na e-mail adresu <a target="_blank" rel="noopener noreferrer nofollow" href="mailto:office@rentaj.rs">office@rentaj.rs</a> i treba da sadrži:</p>
<ul>
<li><p>ime i prezime korisnika,</p></li>
<li><p>broj korisničkog naloga ili identifikacioni broj transakcije,</p></li>
<li><p>datum i opis problema,</p></li>
<li><p>dokaz o izvršenoj uplati (ukoliko je primenljivo).</p></li>
</ul>
<p>Korisnik je u obavezi da reklamaciju podnese najkasnije u roku od 10 dana od dana nastanka razloga za reklamaciju.</p>
<h3>Rokovi za postupanje</h3>
<p>Platforma će bez odlaganja potvrditi prijem reklamacije. Odgovor na reklamaciju biće dostavljen korisniku najkasnije u roku od 8 dana od dana prijema reklamacije.</p>
<p>Rok za rešavanje reklamacije ne može biti duži od 14 dana od dana podnošenja reklamacije.</p>
<h3>Način rešavanja reklamacije</h3>
<p>U zavisnosti od prirode zahteva, reklamacija može biti rešena:</p>
<ul>
<li><p>otklanjanjem tehničke greške na platformi,</p></li>
<li><p>korekcijom obračuna plaćenih oglasa,</p></li>
<li><p>pružanjem podrške korisnicima u vezi sa korišćenjem platforme.</p></li>
</ul>
<p>Podnošenje reklamacije ne proizvodi dodatne troškove za korisnika.</p>
<h2>POVRAĆAJ SREDSTAVA</h2>
<p>U slučaju povraćaja plaćenih oglasa kupcu koji je prethodno platio nekom od platnih kartica, delimično ili u celosti, iz razloga navedenih u Politici reklamacija, platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> je u obavezi da povraćaj vrši isključivo preko VISA, EC/MC, Amex i Dinacard metoda plaćanja, što znači da će banka na zahtev platforme izvršiti povraćaj sredstava na račun korisnika platne kartice.</p>
<h2>ODGOVORNOST OGLAŠIVAČA I KORISNIKA</h2>
<p>Oglašivač je odgovoran za uneti sadržaj na platformu <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a>. Oglašivač je isključivi vlasnik unetog sadržaja i ukoliko dođe do propusta ili greške prilikom unosa sadržaja od strane oglašivača, platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> nije odgovorna ni po kakvom osnovu.</p>
<p>Oglašivači i korisnici sajta ne smeju:</p>
<ul>
<li><p>objavljivati neistinite, netačne podatke i informacije;</p></li>
<li><p>objavljivati obmanjujuće poruke koje mogu dovesti u zabludu ostale korisnike;</p></li>
<li><p>objavljivati nezakonit sadržaj i koristiti web prezentaciju <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> za druge nezakonite aktivnosti;</p></li>
</ul>
<p>Obaveze svih, kako korisnika, tako i oglašivača je da poštuju pravo intelektualne svojine drugih korisnika web sajta.</p>
<h2>ODUSTAJANJE OD KUPOVINE</h2>
<p>Plaćeni oglasi na platformi <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> nisu predmet prava na odustanak u roku od 14 dana, jer se radi o naknadi za oglašavanje, a usluga je izvršena odmah nakon uplate.</p>
<h2>IZMENE USLOVA</h2>
<p>Platforma <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> i operator platforme zadržava pravo da u svako doba izmeni ove OUP, ali se obavezuje da o izmenama obaveštava registrovana lica na samoj platformi. Nastavak korišćenja usluga smatra se pristankom na nove ili izmenjene OUP.</p>
<h2>KORESPODENCIJA</h2>
<p>Korespodencija između platforme <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> i trećih lica obavljaće se putem kontakt forme na samom web sajtu, putem kontakt telefona 064/2-7777-40 ili putem e-maila <a target="_blank" rel="noopener noreferrer nofollow" href="mailto:office@rentaj.rs">office@rentaj.rs</a>.</p>
<h2>PRIMENA ZAKONA</h2>
<p>Na sve što nije regulisano ovim OUP primenjivaće se propisi Republike Srbije.</p>
<h2>REŠAVANJE SPOROVA</h2>
<p>Svi sporovi rešavaće se sporazumno, a za slučaj sudskog spora nadležan je Privredni sud u Sremskoj Mitrovici.</p>
<h2>VAŽENJE OPŠTIH USLOVA</h2>
<p>Ovi OUP važe od dana objavljivanja na internet prezetaciji <a target="_blank" rel="noopener noreferrer nofollow" href="http://rentaj.rs">rentaj.rs</a> i nisu vremenski ograničeni.</p>$body$
WHERE "slug" = 'uslovi-koriscenja'
  AND "language" = 'SR'
  AND md5("bodyHtml") IN (
    'e8c34efed4e4ca2bccf96ba8d8e65629', -- rentaj.dev, saved 2026-08-24
    '69e2a4d9314f9eb6dee9a771d1c71c4b'  -- the seed text of 2026-08-20
  );
