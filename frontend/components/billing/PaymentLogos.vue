<template>
  <div class="payment-logos" :class="stacked ? 'payment-logos-stacked' : 'payment-logos-adaptive'">
    <div class="payment-logos-group">
      <img src="/images/payment/maestro.svg" alt="Maestro" class="payment-logo" />
      <img src="/images/payment/mastercard.svg" alt="Mastercard" class="payment-logo" />
      <img src="/images/payment/dinacard.png" alt="DinaCard" class="payment-logo" />
      <img src="/images/payment/visa.png" alt="Visa" class="payment-logo payment-logo-visa" />
      <img src="/images/payment/amex.png" alt="American Express" class="payment-logo" />
    </div>

    <a href="https://www.bancaintesa.rs" target="_blank" rel="noopener" class="payment-logos-link">
      <img src="/images/payment/banca-intesa.png" alt="Banca Intesa" class="payment-logo" />
    </a>

    <div class="payment-logos-group">
      <a href="https://www.mastercard.rs/sr-rs/korisnici/pronadite-karticu.html" target="_blank" rel="noopener" class="payment-logos-link">
        <img src="/images/payment/mastercard-id-check.svg" alt="Mastercard ID Check" class="payment-logo" />
      </a>
      <a
        href="https://rs.visa.com/pay-with-visa/security-and-assistance/protected-everywhere.html"
        target="_blank"
        rel="noopener"
        class="payment-logos-link"
      >
        <img src="/images/payment/visa-secure.png" alt="Visa Secure" class="payment-logo" />
      </a>
      <img src="/images/payment/amex-safekey.svg" alt="American Express SafeKey" class="payment-logo" />
      <img src="/images/payment/dinacard-secure.png" alt="DinaCard Secure" class="payment-logo" />
    </div>
  </div>
</template>

<script setup>
// Banca Intesa's card marks, as its "Uputstvo za rad EPM" (v3.4, section 2.2)
// and its branding samples of 2026-10 ask for them: the five card marks, the
// bank's logo, then the four security programs. Footer and checkout share it.
defineProps({
  // Always the three rows of the bank's vertical sample (the checkout column);
  // otherwise one row from lg up, as in its horizontal sample.
  stacked: { type: Boolean, default: false },
})
</script>

<style lang="scss" scoped>
// The bank's samples draw every mark at one height with even gaps, the bank's
// logo keeping the two groups apart. The files are the bank's own; maestro,
// mastercard, visa, ID Check, SafeKey and DinaCard Secure have had their empty
// margin cropped, so a gap here is the gap one sees.
.payment-logos {
  --logo-h: 25px;
  --logo-gap: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--logo-gap);
}

.payment-logos-group {
  display: flex;
  align-items: center;
  gap: var(--logo-gap);
}

.payment-logos-link {
  display: flex;
  flex: none;
}

// flex: none keeps every mark in its own shape; a squeezed logo breaks the
// bank's rule that the marks are shown unchanged.
.payment-logo {
  display: block;
  flex: none;
  width: auto;
  height: var(--logo-h);
}

// The Visa wordmark stands at about two thirds of the others in both samples.
.payment-logo-visa {
  height: calc(var(--logo-h) * 0.64);
}

// The widest row, the four programs, is 9.16 heights and three gaps: 283px at
// these values, inside a 320px phone's 288.
@include respond-above(sm) {
  .payment-logos {
    --logo-h: 28px;
    --logo-gap: 20px;
  }
}

// One row of 21.86 heights and nine gaps: 854px in lg's 912 column, 1030 in
// xl's 1092 and 1144 in the 1216 one, the span the earlier strip had.
@include respond-above(lg) {
  .payment-logos-adaptive {
    --logo-h: 30px;
    --logo-gap: 22px;
    flex-direction: row;
    justify-content: center;
  }
}

@include respond-above(xl) {
  .payment-logos-adaptive {
    --logo-h: 36px;
    --logo-gap: 27px;
  }
}

@include respond-above(xxl) {
  .payment-logos-adaptive {
    --logo-h: 40px;
    --logo-gap: 30px;
  }
}
</style>
