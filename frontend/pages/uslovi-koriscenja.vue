<template>
  <div class="legal-page">
    <section class="legal-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('legalPages.termsTitle') }}</h1>
        <p class="text-body legal-subtitle">{{ t('legalPages.termsSubtitle') }}</p>
        <p class="text-muted legal-updated">{{ t('legalPages.lastUpdated', { date: lastUpdated }) }}</p>
      </div>
    </section>

    <section class="container legal-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <div class="card legal-notice mb-4">
            <div class="card-body">
              <p class="text-muted mb-0">{{ t('legalPages.reviewNotice') }}</p>
            </div>
          </div>

          <article class="legal-content">
            <h2 class="text-section-title">1. Šta je Rentaj</h2>
            <p>
              Rentaj je platforma koja spaja oglasnik i rezervacioni sistem. Vlasnik objavljuje ono što izdaje
              — stan, salu, igraonicu, vozilo, mašinu, magacin ili opremu — i prima rezervacije bez posrednika
              i bez provizije. Rentaj ne naplaćuje procenat od rezervacije; prihod platforme dolazi isključivo
              od mesečne ili godišnje pretplate koju plaća vlasnik oglasa.
            </p>

            <h2 class="text-section-title">2. Nalog i uloge</h2>
            <p>
              Registracijom postajete korisnik Platforme. Nema posebnog izbora „gost" ili „vlasnik" prilikom
              registracije — svaki nalog može i da rezerviše kod drugih i da izdaje sopstvene oglase. Uloga
              vlasnika nastaje objavljivanjem prvog oglasa i ne isključuje mogućnost rezervisanja kod drugih
              korisnika.
            </p>
            <p>Odgovorni ste za tačnost podataka koje unesete i za bezbednost svoje lozinke.</p>

            <h2 class="text-section-title">3. Objavljivanje oglasa</h2>
            <p>
              Svaki oglas prolazi kroz administratorsko odobrenje pre nego što postane javno vidljiv, u roku
              od 24 časa. Vlasnik garantuje da su podaci u oglasu tačni i da ima pravo da izdaje ono što
              oglašava. Rentaj zadržava pravo da odbije ili ukloni oglas koji krši ova pravila ili važeće
              propise.
            </p>

            <h2 class="text-section-title">4. Rezervacije i plaćanje</h2>
            <p>
              Rentaj evidentira zahtev za rezervaciju, generiše IPS QR kod za uplatu i vodi status rezervacije,
              ali <strong>nikada ne prima, ne prosleđuje niti vraća novac</strong>. Gost plaća vlasnika
              direktno — kešom ili uplatom na tekući račun vlasnika. Vlasnik ručno potvrđuje prijem uplate;
              Rentaj ne verifikuje da je uplata izvršena.
            </p>
            <p>
              Uslovi otkazivanja rezervacije su izjava vlasnika, prikazana pre uplate — Platforma nema
              sopstvenu politiku otkazivanja i ne posreduje u eventualnom sporu oko novca. Administrator može
              da razmatra ponašanje korisnika na Platformi (npr. neopravdano neprihvatanje uplate) i po potrebi
              izrekne upozorenje, ograničenje ili blokadu naloga.
            </p>

            <h2 class="text-section-title">5. Pretplate i naplata</h2>
            <ul>
              <li>Objavljivanje oglasa zahteva aktivnu pretplatu na jedan od dostupnih paketa.</li>
              <li>Pretplata se automatski obnavlja do otkazivanja, osim za pravna lica koja plaćaju virmanom.</li>
              <li>Otkazivanje je moguće u svakom trenutku kroz kontrolnu tablu; oglas ostaje aktivan do kraja plaćenog perioda.</li>
              <li>Povraćaj sredstava nije moguć, osim u slučaju tehničke greške na strani Platforme.</li>
              <li>Rentaj ne čuva podatke o platnim karticama — naplatu obrađuje ovlašćeni platni servis.</li>
            </ul>

            <h2 class="text-section-title">6. Zabranjeno ponašanje</h2>
            <ul>
              <li>Objavljivanje netačnih, obmanjujućih ili tuđih oglasa.</li>
              <li>Zaobilaženje Platforme radi izbegavanja pretplate razmenom kontakt podataka pre rezervacije.</li>
              <li>Automatizovano prikupljanje podataka sa Platforme (grabbing/scraping) ili automatski unos naloga.</li>
              <li>Uznemiravanje ili neprimereno ponašanje prema drugim korisnicima kroz poruke ili recenzije.</li>
            </ul>
            <p>Kršenje ovih pravila može dovesti do uklanjanja sadržaja, upozorenja ili blokade naloga.</p>

            <h2 class="text-section-title">7. Ograničenje odgovornosti</h2>
            <p>
              Rentaj nije strana u ugovoru o izdavanju između gosta i vlasnika i ne garantuje za kvalitet,
              bezbednost ili zakonitost onoga što se oglašava. Platforma obezbeđuje prostor za oglašavanje i
              rezervisanje, ali stvarni dogovor i njegovo izvršenje su isključivo stvar gosta i vlasnika.
            </p>

            <h2 class="text-section-title">8. Izmene uslova</h2>
            <p>
              Ovi uslovi se mogu povremeno izmeniti. O svakoj izmeni koja bitno utiče na vaša prava bićete
              obavešteni, a nastavak korišćenja Platforme nakon izmene smatra se prihvatanjem novih uslova.
            </p>

            <h2 class="text-section-title">9. Kontakt</h2>
            <p>
              Pitanja u vezi sa ovim uslovima možete poslati na
              <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a>.
            </p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()

const lastUpdated = new Date().toLocaleDateString('sr-RS')

useSeoMeta({ title: t('legalPages.termsTitle'), description: t('legalPages.termsSubtitle'), robots: 'noindex,follow' })
</script>

<style lang="scss" scoped>
.legal-hero {
  background: $color-background;
  padding: 56px 0 24px;
}

.legal-subtitle {
  color: $color-text-muted;
  max-width: 480px;
  margin: 0 auto;
}

.legal-updated {
  font-size: $font-size-muted;
  margin-top: 8px;
}

.legal-body {
  padding: 32px 0 64px;
}

.legal-notice .card-body {
  background: rgba($color-warning, 0.08);
}

.legal-content h2 {
  margin-top: 32px;
  margin-bottom: 12px;
}

.legal-content h2:first-child {
  margin-top: 0;
}

.legal-content p,
.legal-content li {
  color: $color-text;
  line-height: 1.7;
}

.legal-content ul {
  padding-left: 20px;
  margin-bottom: 16px;
}
</style>
