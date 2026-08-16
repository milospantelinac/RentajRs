<template>
  <div class="legal-page">
    <section class="legal-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('legalPages.aboutTitle') }}</h1>
        <p class="text-body legal-subtitle">{{ t('legalPages.aboutSubtitle') }}</p>
      </div>
    </section>

    <section class="container legal-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <article class="legal-content">
            <p class="lead-paragraph">
              Rentaj spaja oglasnik i rezervacioni sistem na jednom mestu. Vlasnik objavljuje ono što izdaje —
              stan, salu, igraonicu, vozilo, mašinu, magacin ili opremu — i prima rezervacije direktno, bez
              posrednika i bez provizije.
            </p>

            <h2 class="text-section-title">Zašto smo napravili Rentaj</h2>
            <p>
              Vlasnici koji izdaju jedan do nekoliko objekata najčešće biraju između oglasnika bez alata za
              rezervisanje i platformi koje uzimaju procenat od svake rezervacije. Rentaj radi drugačije:
              plaćate jednu fiksnu pretplatu za oglas, a rezervacioni sistem — kalendar, potvrda uplate, iCal
              sinhronizacija, poruke sa gostima — dolazi uz njega.
            </p>

            <h2 class="text-section-title">Kako zarađujemo</h2>
            <p>
              Isključivo od pretplate koju plaća vlasnik oglasa. Rentaj nikada ne uzima procenat od
              rezervacije i nikada ne dodiruje novac gosta — gost plaća vlasnika direktno, kešom ili uplatom
              na tekući račun. To je razlog zašto poruka „0% provizije" nešto zaista znači, a ne samo marketinški slogan.
            </p>

            <h2 class="text-section-title">Za koga je Rentaj</h2>
            <p>
              Prvenstveno za vlasnike koji izdaju jedan do četiri objekta — apartman, vozilo, salu za
              proslave, igraonicu, mašinu ili magacin — i za goste koji traže overen, pregledan način da ih
              pronađu i rezervišu.
            </p>

            <h2 class="text-section-title">Kontakt</h2>
            <p>
              Pišite nam na <a href="mailto:podrska@rentaj.rs">podrska@rentaj.rs</a> — rado čujemo pitanja,
              predloge i prijave problema.
            </p>
          </article>

          <nav class="about-quick-links mt-4" :aria-label="t('legalPages.aboutQuickLinks')">
            <NuxtLink to="/cenovnik" class="btn btn-tertiary btn-sm">{{ t('nav.pricing') }}</NuxtLink>
            <NuxtLink to="/politika-privatnosti" class="btn btn-tertiary btn-sm">{{ t('footer.privacy') }}</NuxtLink>
            <NuxtLink to="/uslovi-koriscenja" class="btn btn-tertiary btn-sm">{{ t('footer.terms') }}</NuxtLink>
            <NuxtLink to="/faq" class="btn btn-tertiary btn-sm">{{ t('nav.faq') }}</NuxtLink>
            <NuxtLink to="/kontakt" class="btn btn-tertiary btn-sm">{{ t('footer.contact') }}</NuxtLink>
          </nav>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()

useSeoMeta({ title: t('legalPages.aboutTitle'), description: t('legalPages.aboutSubtitle') })
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

.legal-body {
  padding: 32px 0 64px;
}

.lead-paragraph {
  font-size: $font-size-page-title;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 32px;
}

.legal-content h2 {
  margin-top: 32px;
  margin-bottom: 12px;
}

.legal-content p {
  color: $color-text;
  line-height: 1.7;
}

.about-quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
