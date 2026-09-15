<template>
  <div class="contact-page">
    <div class="container">
      <header class="contact-hero">
        <h1 class="contact-title">
          {{ t('contactPage.titleLead') }} <span class="contact-title-muted">{{ t('contactPage.titleMuted') }}</span>
        </h1>
        <p class="contact-subtitle">{{ t('contactPage.subtitle') }}</p>
      </header>

      <div class="contact-split">
        <div class="contact-main">
          <div v-if="sent" class="contact-sent-banner" role="status">{{ t('contactPage.sent') }}</div>

          <form class="contact-form" @submit.prevent="submit" @invalid.capture="onInvalidCapture" @input.capture="onInputCapture">
            <div class="contact-row">
              <div class="contact-field">
                <label for="contact-name" class="contact-label">{{ t('contactPage.nameLabel') }}<span class="contact-required">*</span></label>
                <input id="contact-name" v-model="form.name" name="name" type="text" class="contact-input" autocomplete="name" required maxlength="100" />
              </div>
              <div class="contact-field">
                <label for="contact-email" class="contact-label">{{ t('contactPage.emailLabel') }}<span class="contact-required">*</span></label>
                <input id="contact-email" v-model="form.email" name="email" type="email" class="contact-input" autocomplete="email" required />
              </div>
            </div>

            <div class="contact-field">
              <label for="contact-subject" class="contact-label">{{ t('contactPage.subjectLabel') }}<span class="contact-required">*</span></label>
              <input id="contact-subject" v-model="form.subject" name="subject" type="text" class="contact-input" required maxlength="200" />
            </div>

            <div class="contact-field">
              <label for="contact-message" class="contact-label">{{ t('contactPage.messageLabel') }}<span class="contact-required">*</span></label>
              <textarea id="contact-message" v-model="form.message" name="message" class="contact-input contact-textarea" required maxlength="5000" />
            </div>

            <!-- Honeypot — hidden from real visitors via CSS, not display:none/type=hidden
                 (bots skip fields they detect as unrenderable, but tend to still fill this). -->
            <div class="form-honeypot" aria-hidden="true">
              <label>Website</label>
              <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
            </div>

            <label class="contact-consent">
              <input v-model="form.consent" name="consent" type="checkbox" class="contact-checkbox" required />
              <span class="contact-consent-text">
                {{ t('contactPage.consentPrefix') }}
                <NuxtLink to="/politika-privatnosti" target="_blank">{{ t('contactPage.consentLinkText') }}</NuxtLink>{{ t('contactPage.consentSuffix') }}
              </span>
            </label>

            <p v-if="error" class="form-error">{{ error }}</p>

            <button type="submit" class="contact-submit" :disabled="submitting">
              {{ submitting ? t('common.loading') : t('contactPage.send') }}
              <img src="/images/icons/arrow-right-white.svg" alt="" class="contact-submit-icon" />
            </button>
          </form>
        </div>

        <aside class="contact-aside">
          <div class="contact-support">
            <div class="contact-support-row">
              <span class="contact-support-icon"><img src="/images/icons/mail-line.svg" alt="" /></span>
              <div class="contact-support-text">
                <p class="contact-support-label">{{ t('contactPage.supportEmailLabel') }}</p>
                <a href="mailto:office@rentaj.rs" class="contact-support-email">office@rentaj.rs</a>
              </div>
            </div>

            <div class="contact-support-divider" />

            <div class="contact-support-row">
              <span class="contact-support-icon"><img src="/images/icons/clock-line.svg" alt="" /></span>
              <div class="contact-support-text">
                <p class="contact-support-label">{{ t('contactPage.responseTimeLabel') }}</p>
                <p class="contact-support-hours">{{ t('contactPage.responseTimeValue') }}</p>
              </div>
            </div>
          </div>

          <div class="contact-quicklinks">
            <p class="contact-quicklinks-title">{{ t('contactPage.quickLinksTitle') }}</p>
            <NuxtLink to="/faq" class="contact-quicklink">
              {{ t('contactPage.faqLink') }}
              <img src="/images/icons/arrow-right-brand-sm.svg" alt="" />
            </NuxtLink>
            <NuxtLink to="/uslovi-koriscenja" class="contact-quicklink">
              {{ t('footer.termsLong') }}
              <img src="/images/icons/arrow-right-brand-sm.svg" alt="" />
            </NuxtLink>
            <NuxtLink to="/politika-privatnosti" class="contact-quicklink">
              {{ t('footer.privacy') }}
              <img src="/images/icons/arrow-right-brand-sm.svg" alt="" />
            </NuxtLink>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 15 (Figma "Kontakt · Desktop 1440", node 212:287). Layout only — the
// /contact submission, honeypot and validation below are unchanged.
const { t } = useI18n()
const api = useApi()
const { onInvalidCapture, onInputCapture } = useLocalizedFormValidation()

const form = reactive({ name: '', email: '', subject: '', message: '', consent: false, website: '' })
const error = ref('')
const submitting = ref(false)
const sent = ref(false)

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await api.post('/contact', {
      name: form.name,
      email: form.email,
      subject: form.subject,
      message: form.message,
      consent: form.consent,
      website: form.website || undefined,
    })
    sent.value = true
    form.name = ''
    form.email = ''
    form.subject = ''
    form.message = ''
    form.consent = false
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submitting.value = false
  }
}

useSeoMeta({ title: t('contactPage.title'), description: t('contactPage.subtitle') })
</script>

<style lang="scss" scoped>
// Every value here is read off frame 212:287. The shared .form-control / .btn /
// .card classes don't match this frame (56px fields, gradient CTA, bordered
// card), so the page carries its own.

// 212:317 — 72 under the header, 96 above the footer.
.contact-page {
  padding: 72px 0 96px;
}

// 212:318
.contact-hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 48px;
}

.contact-title {
  font-size: 52px;
  font-weight: 400;
  line-height: 58px;
  letter-spacing: -1.82px;
  color: $color-text;
}

.contact-title-muted {
  color: $color-text-muted;
}

.contact-subtitle {
  max-width: 680px;
  font-size: 18px;
  line-height: 28px;
  color: $color-text-muted;
}

// 212:321 — 760 | 56 | 400. No class here may contain "col": _grid.scss pads
// every [class*='col'] element by 12px on each side.
.contact-split {
  display: grid;
  grid-template-columns: minmax(0, 760fr) minmax(0, 400fr);
  gap: 56px;
  align-items: start;
}

.contact-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.contact-sent-banner {
  padding: 16px 18px;
  border: 1px solid rgba($color-success, 0.35);
  border-radius: 12px;
  background: rgba($color-success, 0.1);
  color: $color-success;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
}

// 212:322
.contact-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.contact-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
}

.contact-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.contact-label {
  display: flex;
  gap: 4px;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.contact-required {
  color: $color-primary;
}

// 214:292 — 56 tall, 18 side padding, no stroke. The transparent border is
// only there so focus can colour it without moving the text.
.contact-input {
  display: block;
  width: 100%;
  height: 56px;
  margin: 0;
  padding: 0 17px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  line-height: normal;
  transition: border-color 0.15s ease;
}

.contact-input:focus {
  outline: none;
  border-color: $color-primary;
}

// 214:310
.contact-textarea {
  height: 190px;
  padding: 15px 17px;
  line-height: 24px;
  resize: none;
}

// 214:312
.contact-consent {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

// 214:313 — the frame only draws the checked box; unchecked follows the
// checkout checkbox (white, 1.5px #E4EBF2).
.contact-checkbox {
  appearance: none;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin: 0;
  border: 1.5px solid $color-border;
  border-radius: 8px;
  background: $color-surface center / 13px 13px no-repeat;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.contact-checkbox:checked {
  border-color: $color-primary;
  background-color: $color-primary;
  background-image: url('/images/icons/check-white.svg');
}

.contact-checkbox:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.contact-consent-text {
  font-size: 14px;
  line-height: 21px;
  color: $color-text-muted;
}

.contact-consent-text a {
  color: $color-primary;
}

.contact-consent-text a:hover {
  text-decoration: underline;
}

// 214:318
.contact-submit {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  align-self: flex-start;
  height: 52px;
  padding: 0 34px 0 36px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 55%, $color-gradient-end 100%);
  color: $color-surface;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.contact-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.contact-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.contact-submit:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.contact-submit-icon {
  width: 16px;
  height: 16px;
}

.contact-aside {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// 214:322 — Figma's stroke sits inside the frame, so its 26px padding is 25
// plus the 1px border here.
.contact-support {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 25px;
  border: 1px solid $color-border;
  border-radius: 16px;
  background: $color-surface;
}

.contact-support-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.contact-support-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: $color-background;
}

.contact-support-icon img {
  width: 20px;
  height: 20px;
}

.contact-support-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.contact-support-label {
  font-size: 13px;
  line-height: normal;
  color: $color-text-muted;
}

.contact-support-email {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.contact-support-email:hover {
  color: $color-primary;
}

.contact-support-hours {
  font-size: 15px;
  line-height: 22px;
  color: $color-text;
}

.contact-support-divider {
  height: 1px;
  background: $color-border;
}

// 214:340
.contact-quicklinks {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding-top: 22px;
}

.contact-quicklinks-title {
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.contact-quicklink {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

.contact-quicklink:hover {
  text-decoration: underline;
}

.contact-quicklink img {
  width: 14px;
  height: 14px;
}

@include respond-below(lg) {
  .contact-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .contact-aside {
    max-width: 400px;
  }
}

@include respond-below(md) {
  .contact-page {
    padding: 40px 0 56px;
  }

  .contact-title {
    font-size: 34px;
    line-height: 42px;
    letter-spacing: -1.19px;
  }

  .contact-subtitle {
    font-size: 16px;
    line-height: 26px;
  }

  .contact-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .contact-aside {
    max-width: none;
  }

  .contact-submit {
    align-self: stretch;
    justify-content: center;
  }
}
</style>
