<template>
  <div class="contact-page">
    <section class="contact-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('contactPage.title') }}</h1>
        <p class="text-body contact-subtitle">{{ t('contactPage.subtitle') }}</p>
      </div>
    </section>

    <section class="container contact-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-6">
          <div v-if="sent" class="card">
            <div class="card-body text-center">
              <p class="text-body">{{ t('contactPage.sent') }}</p>
            </div>
          </div>

          <form v-else class="card" @submit.prevent="submit">
            <div class="card-body">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('contactPage.nameLabel') }}</label>
                <input v-model="form.name" type="text" class="form-control" required maxlength="100" />
              </div>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('contactPage.emailLabel') }}</label>
                <input v-model="form.email" type="email" class="form-control" required />
              </div>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('contactPage.subjectLabel') }}</label>
                <input v-model="form.subject" type="text" class="form-control" required maxlength="200" />
              </div>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('contactPage.messageLabel') }}</label>
                <textarea v-model="form.message" class="form-control" rows="5" required maxlength="5000" />
              </div>

              <!-- Honeypot — hidden from real visitors via CSS, not display:none/type=hidden
                   (bots skip fields they detect as unrenderable, but tend to still fill this). -->
              <div class="contact-honeypot" aria-hidden="true">
                <label>Website</label>
                <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
              </div>

              <label class="form-row-inline contact-consent mb-3">
                <input v-model="form.consent" type="checkbox" class="form-checkbox" required />
                <span class="text-muted">
                  {{ t('contactPage.consentPrefix') }}
                  <NuxtLink to="/politika-privatnosti" target="_blank">{{ t('contactPage.consentLinkText') }}</NuxtLink>
                  {{ t('contactPage.consentSuffix') }}
                </span>
              </label>

              <p v-if="error" class="form-error mb-3">{{ error }}</p>

              <button type="submit" class="btn btn-primary-flat btn-block" :disabled="submitting">
                {{ submitting ? t('common.loading') : t('contactPage.send') }}
              </button>
            </div>
          </form>

          <div class="card mt-4">
            <div class="card-body text-center">
              <p class="text-label mb-2">{{ t('contactPage.emailLabel') }}</p>
              <a href="mailto:office@rentaj.rs" class="contact-email">office@rentaj.rs</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

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
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submitting.value = false
  }
}

useSeoMeta({ title: t('contactPage.title'), description: t('contactPage.subtitle') })
</script>

<style lang="scss" scoped>
.contact-hero {
  background: $color-background;
  padding: 56px 0 32px;
}

.contact-subtitle {
  color: $color-text-muted;
  max-width: 480px;
  margin: 0 auto;
}

.contact-body {
  padding: 48px 0 64px;
}

.contact-email {
  font-size: $font-size-page-title;
  font-weight: 600;
  color: $color-primary;
}

.contact-honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.contact-consent {
  align-items: flex-start;
}
</style>
