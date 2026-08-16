<template>
  <div class="legal-page">
    <section class="legal-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('legalPages.privacyTitle') }}</h1>
        <p class="text-body legal-subtitle">{{ t('legalPages.privacySubtitle') }}</p>
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
            <h2 class="text-section-title">1. Ko je rukovalac podataka</h2>
            <p>
              Rukovalac podataka koje prikupljamo prilikom korišćenja platforme Rentaj (u daljem tekstu:
              „Platforma") je Rentaj. Podatke obrađujemo u skladu sa Zakonom o zaštiti podataka o ličnosti
              Republike Srbije.
            </p>

            <h2 class="text-section-title">2. Koje podatke prikupljamo</h2>
            <ul>
              <li>Osnovni podaci naloga: ime, prezime, e-mail adresa, lozinka (u kriptovanom obliku).</li>
              <li>Opcioni podaci profila: telefon, profilna slika, jezik.</li>
              <li>
                Podaci za naplatu ako objavljujete oglas: telefon, tekući račun za IPS QR kod, a za pravna lica
                naziv firme, PIB i matični broj.
              </li>
              <li>Sadržaj koji sami unosite: oglasi, poruke, recenzije, prijave i sporovi.</li>
              <li>Tehnički podaci: IP adresa, vrsta uređaja i kolačići — videti odeljak 6.</li>
            </ul>
            <p>
              Podatke o platnim karticama Rentaj nikada ne prikuplja niti čuva. Naplatu pretplate obrađuje
              ovlašćeni platni servis (Banca Intesa NestPay); Rentaj dobija samo potvrdu o uspešnoj uplati.
            </p>

            <h2 class="text-section-title">3. Zašto obrađujemo vaše podatke</h2>
            <ul>
              <li>Da bismo vam omogućili registraciju, objavu oglasa i slanje zahteva za rezervaciju.</li>
              <li>Da bismo omogućili komunikaciju između gosta i vlasnika oglasa.</li>
              <li>Da bismo naplatili pretplatu za objavljene oglase i izdali fiskalni račun ili e-Fakturu.</li>
              <li>Da bismo sprečili zloupotrebu, lažne naloge i automatski unos podataka.</li>
              <li>Da bismo vas obavestili o statusu vaših rezervacija, oglasa i naloga.</li>
            </ul>

            <h2 class="text-section-title">4. Rentaj ne posreduje u novcu gostiju</h2>
            <p>
              Gost plaća vlasnika oglasa direktno — keš ili uplatom na tekući račun vlasnika. Rentaj nikada ne
              prima, ne prosleđuje i ne vraća taj novac, i ne procesuira podatke o platnim karticama gostiju.
              Platforma naplaćuje isključivo pretplatu vlasnika oglasa.
            </p>

            <h2 class="text-section-title">5. Vlasnik oglasa kao samostalan rukovalac</h2>
            <p>
              Kada pošaljete zahtev za rezervaciju, vaše ime, kontakt podaci i poruka se dele sa vlasnikom
              oglasa radi realizacije rezervacije. Od tog trenutka, vlasnik postaje samostalan rukovalac tim
              podacima i odgovoran je za njihovu dalju obradu van Platforme.
            </p>

            <h2 class="text-section-title">6. Kolačići</h2>
            <p>
              Platforma koristi kolačiće neophodne za rad sajta i, uz vašu saglasnost, kolačiće za analitiku.
              Svoj izbor možete promeniti u svakom trenutku preko obaveštenja o kolačićima. Odbijanje
              neobaveznih kolačića ne utiče na osnovnu funkcionalnost Platforme.
            </p>

            <h2 class="text-section-title">7. Vaša prava</h2>
            <ul>
              <li>Pravo uvida u podatke koje čuvamo o vama.</li>
              <li>Pravo na ispravku netačnih podataka kroz podešavanja naloga.</li>
              <li>Pravo na preuzimanje svojih podataka u čitljivom formatu.</li>
              <li>
                Pravo na brisanje naloga — nalog se anonimizuje (lični podaci se trajno uklanjaju), dok
                evidencije potrebne iz zakonskih razloga (npr. izdati računi) ostaju bez ličnih podataka.
              </li>
            </ul>
            <p>Zahtev za ostvarivanje ovih prava možete podneti iz kontrolne table ili nam se obratiti na kontakt ispod.</p>

            <h2 class="text-section-title">8. Bezbednost podataka</h2>
            <p>
              Lozinke se čuvaju isključivo u kriptovanom obliku. Sav saobraćaj ide preko šifrovane veze.
              Administratorski nalozi zahtevaju dvofaktorsku autentikaciju.
            </p>

            <h2 class="text-section-title">9. Kontakt</h2>
            <p>
              Za sva pitanja o obradi ličnih podataka pišite nam na
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

useSeoMeta({ title: t('legalPages.privacyTitle'), description: t('legalPages.privacySubtitle'), robots: 'noindex,follow' })
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
