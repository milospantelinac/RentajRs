<template>
  <div class="wizard container">
    <!-- Dizajn 19: the shell of frame 185:287, the same on all nine steps. -->
    <div class="wizard-progress">
      <div class="wizard-progress-meta">
        <p class="wizard-step-of">{{ t('listing.wizardStepOf', { current: currentStep + 1, total: steps.length }) }}</p>
        <p class="wizard-autosave">
          <img src="/images/icons/autosave-cloud.svg" alt="" />
          {{ t('listing.autoSaveNotice') }}
        </p>
      </div>
      <!-- The frame's bar has no labels. A segment still opens any step the
           owner has already reached, as the old numbered stepper did. -->
      <div class="wizard-segments">
        <button
          v-for="(step, index) in steps"
          :key="step.key"
          type="button"
          class="wizard-segment"
          :class="{ 'is-filled': index <= currentStep }"
          :disabled="index > maxStepReached"
          :title="t(step.labelKey)"
          :aria-label="t(step.labelKey)"
          :aria-current="index === currentStep ? 'step' : undefined"
          @click="currentStep = index"
        />
      </div>
    </div>

    <div class="wizard-category">
      <template v-if="listing?.category">
        <span class="wizard-category-pill">
          <span class="wizard-category-icon" aria-hidden="true" v-html="categoryIconMarkup" />
          {{ listing.category.name }}
        </span>
        <!-- Only a draft can move to another category (novi.vue ?oglas=). -->
        <NuxtLink v-if="listing.status === 'DRAFT'" :to="`/oglasi/novi?oglas=${listingId}`" class="wizard-category-change">
          {{ t('listing.changeCategory') }}
        </NuxtLink>
      </template>
    </div>

    <header class="wizard-head">
      <h1 class="wizard-title">
        {{ t(steps[currentStep].labelKey) }}<span v-if="steps[currentStep].key === 'photos'" class="wizard-title-required"> *</span>
      </h1>
      <p class="wizard-subtitle">{{ stepSubtitle }}</p>
    </header>

    <div class="wizard-form">
      <!-- Dizajn 20: Osnovni podaci, the Forma column of 228:314. -->
      <div v-if="steps[currentStep].key === 'basics'" class="basics">
        <div class="basics-field">
          <label for="basics-title" class="basics-label">{{ t('listing.title') }}<span class="basics-required">*</span></label>
          <input
            id="basics-title"
            v-model="form.title"
            type="text"
            class="basics-input"
            :class="{ 'is-invalid': basicsErrors.title }"
            :maxlength="TITLE_MAX_LENGTH"
            @input="basicsErrors.title = ''"
          />
          <div class="basics-meta">
            <p v-if="basicsErrors.title" class="basics-error"><img src="/images/icons/field-error.svg" alt="" />{{ basicsErrors.title }}</p>
            <p v-else class="basics-hint">{{ t('listing.titleHint') }}</p>
            <span class="basics-count">{{ form.title.length }} / {{ TITLE_MAX_LENGTH }}</span>
          </div>
        </div>

        <div class="basics-field">
          <label for="basics-description" class="basics-label">{{ t('listing.description') }}<span class="basics-required">*</span></label>
          <textarea
            id="basics-description"
            v-model="form.description"
            class="basics-input basics-textarea"
            :class="{ 'is-invalid': basicsErrors.description }"
            :maxlength="DESCRIPTION_MAX_LENGTH"
            @input="basicsErrors.description = ''"
          />
          <div class="basics-meta">
            <p v-if="basicsErrors.description" class="basics-error"><img src="/images/icons/field-error.svg" alt="" />{{ basicsErrors.description }}</p>
            <p v-else class="basics-hint">{{ t('listing.descriptionHint') }}</p>
            <span class="basics-count">{{ form.description.length }} / {{ DESCRIPTION_MAX_LENGTH }}</span>
          </div>
        </div>

        <div class="basics-field">
          <label for="basics-video" class="basics-label">{{ t('listing.videoUrl') }}<span class="basics-optional">{{ t('common.optional') }}</span></label>
          <!-- 228:339: the whole row is the field; the input only fills its middle. -->
          <div class="basics-input basics-video" :class="{ 'is-invalid': basicsErrors.videoUrl }">
            <img src="/images/icons/youtube.svg" alt="" class="basics-video-icon" />
            <input
              id="basics-video"
              v-model="form.videoUrl"
              type="url"
              class="basics-video-input"
              placeholder="https://youtu.be/..."
              @input="basicsErrors.videoUrl = ''"
              @blur="checkVideoUrl"
            />
            <span v-if="videoUrlRecognized" class="basics-video-ok">
              <img src="/images/icons/check-success.svg" alt="" />{{ t('listing.videoUrlRecognized') }}
            </span>
          </div>
          <p v-if="basicsErrors.videoUrl" class="basics-error"><img src="/images/icons/field-error.svg" alt="" />{{ basicsErrors.videoUrl }}</p>
          <p v-else class="basics-hint">{{ t('listing.videoUrlHint') }}</p>
        </div>
      </div>

      <!-- Dizajn 21: Cena i način rezervacije, the Forma column of 231:345. -->
      <div v-else-if="steps[currentStep].key === 'pricing'" class="pricing">
        <!-- 249:287 -->
        <div class="pricing-choice" role="radiogroup" aria-labelledby="pricing-booking-label">
          <p id="pricing-booking-label" class="pricing-label">{{ t('listing.reservationMethod') }} <span class="pricing-required">*</span></p>
          <label
            v-for="option in bookingOptions"
            :key="option.value"
            class="pricing-option"
            :class="{ 'is-selected': bookingChoice === option.value }"
          >
            <input v-model="bookingChoice" type="radio" name="pricing-booking" :value="option.value" class="visually-hidden" />
            <span class="pricing-radio" aria-hidden="true" />
            <span class="pricing-option-text">
              <span class="pricing-option-title">{{ option.title }}</span>
              <span class="pricing-option-desc">{{ option.description }}</span>
            </span>
          </label>
        </div>

        <!-- 249:300 -->
        <div v-if="form.bookingModel === 'PER_SLOT'" class="pricing-choice" role="radiogroup" aria-labelledby="pricing-submode-label">
          <p id="pricing-submode-label" class="pricing-label">{{ t('listing.slotCreationMethod') }} <span class="pricing-required">*</span></p>
          <label
            v-for="option in slotSubmodeOptions"
            :key="option.value"
            class="pricing-option"
            :class="{ 'is-selected': form.slotSubmode === option.value }"
          >
            <input v-model="form.slotSubmode" type="radio" name="pricing-submode" :value="option.value" class="visually-hidden" />
            <span class="pricing-radio" aria-hidden="true" />
            <span class="pricing-option-text">
              <span class="pricing-option-title">{{ option.title }}</span>
              <span class="pricing-option-desc">{{ option.description }}</span>
            </span>
          </label>
          <p class="pricing-note">{{ t('listing.slotSubmodeNextStepNote', { step: t('listing.stepAvailability') }) }}</p>
        </div>

        <template v-if="showFlatPriceFields">
          <!-- 249:315 -->
          <div class="pricing-field">
            <label for="pricing-price" class="pricing-label">{{ t('listing.price') }} (RSD) <span class="pricing-required">*</span></label>
            <div class="pricing-price-row">
              <div class="pricing-input" :class="{ 'is-invalid': pricingErrors.price }">
                <input
                  id="pricing-price"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  class="pricing-input-control"
                  :value="formatRsdInput(form.price)"
                  @input="onRsdInput($event, 'price')"
                />
                <span class="pricing-input-currency">RSD</span>
              </div>
              <div class="pricing-unit">
                <label for="pricing-unit" class="pricing-unit-label">{{ t('listing.priceUnit') }}</label>
                <div class="pricing-select">
                  <select
                    id="pricing-unit"
                    v-model="form.priceUnit"
                    class="pricing-select-control"
                    :disabled="form.bookingModel === 'PER_SLOT' && !isPartyHallCategory"
                  >
                    <option v-for="unit in allowedPriceUnitsForChoice" :key="unit" :value="unit">
                      {{ t(`listing.unit${unitLabel(unit)}`) }}
                    </option>
                  </select>
                  <img src="/images/icons/chevron-down.svg" alt="" class="pricing-select-chevron" />
                </div>
              </div>
            </div>
            <p v-if="pricingErrors.price" class="pricing-error"><img src="/images/icons/field-error.svg" alt="" />{{ pricingErrors.price }}</p>
            <p v-else class="pricing-hint">{{ priceHint }}</p>
            <p v-if="form.priceUnit === 'MONTH'" class="pricing-hint">{{ t('listing.monthlyPricingNotice') }}</p>
          </div>

          <!-- 249:329 -->
          <div v-if="showWeekendPrice" class="pricing-field">
            <label for="pricing-weekend" class="pricing-label">
              {{ t('listing.weekendPrice') }} (RSD)<span class="pricing-optional">{{ t('common.optional') }}</span>
            </label>
            <div class="pricing-input">
              <input
                id="pricing-weekend"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                class="pricing-input-control"
                :value="formatRsdInput(form.weekendPrice)"
                :placeholder="formatRsdInput(form.price)"
                @input="onRsdInput($event, 'weekendPrice')"
              />
              <span class="pricing-input-currency">RSD</span>
            </div>
            <p class="pricing-hint pricing-hint-weekend">{{ t(`listing.weekendPriceHint${weekendRateKind}`) }}</p>
            <p class="pricing-suggestion">
              {{ t('listing.weekendPriceSuggestion') }}
              <img src="/images/icons/info-circle.svg" alt="" />
            </p>
          </div>
        </template>
        <template v-else>
          <!-- T111: DEFINED_SLOTS still prices each slot individually (next
               step), but the unit choice lives here since it changes how
               EVERY slot's price is interpreted, not just a field on this
               step. -->
          <div v-if="isPartyHallCategory" class="pricing-field">
            <label for="pricing-unit" class="pricing-label">{{ t('listing.priceUnit') }}</label>
            <div class="pricing-select pricing-select-alone">
              <select id="pricing-unit" v-model="form.priceUnit" class="pricing-select-control">
                <option v-for="unit in allowedPriceUnitsForChoice" :key="unit" :value="unit">
                  {{ t(`listing.unit${unitLabel(unit)}`) }}
                </option>
              </select>
              <img src="/images/icons/chevron-down.svg" alt="" class="pricing-select-chevron" />
            </div>
          </div>
          <p class="pricing-hint">{{ t('listing.definedSlotsPriceNotice', { step: t('listing.stepAvailability') }) }}</p>
        </template>
      </div>

      <!-- Dostupnost / termini -->
      <div v-else-if="steps[currentStep].key === 'availability'">
        <template v-if="form.bookingModel === 'PER_STAY'">
          <label class="form-label">{{ t('listing.calendarTitle') }}</label>
          <p class="text-muted mb-2">{{ t('listing.calendarHint') }}</p>
          <AvailabilityCalendar
            :listing-id="listingId"
            :base-price="form.price"
            :weekend-price="form.weekendPrice"
            :show-pricing="true"
            :mode="form.priceUnit === 'MONTH' ? 'month' : 'day'"
          />

          <div v-if="form.priceUnit !== 'MONTH'" class="form-group mt-4">
            <label class="form-label">{{ t('listing.icalSectionTitle') }}</label>
            <IcalSyncPanel v-if="listing?.status === 'ACTIVE'" :listing-id="listingId" :ical-export-token="listing?.icalExportToken" />
            <div v-else class="ical-locked">
              <span class="ical-locked-icon" aria-hidden="true">🔒</span>
              <p class="text-muted mb-0">{{ t('listing.icalLockedHint') }}</p>
            </div>
          </div>
        </template>

        <!-- Dizajn 22: 239:287 for working hours, 532:514 for defined slots. -->
        <template v-else-if="form.slotSubmode === 'WORKING_HOURS'">
          <WorkingHoursEditor
            ref="workingHoursEditorRef"
            :listing-id="listingId"
            :base-price="Number(form.price) || 0"
            :weekend-price="form.weekendPrice"
            :price-unit="form.priceUnit"
          />
        </template>
        <template v-else>
          <DefinedSlotsEditor ref="definedSlotsEditorRef" :listing-id="listingId" />
        </template>
      </div>

      <!-- Dizajn 23: Rezervaciona pravila, the Forma column of 256:345. A section only
           shows when its rules apply to this booking method and category. -->
      <div v-else-if="steps[currentStep].key === 'rules'" class="rules">
        <section v-for="section in rulesSections" :key="section.key" class="rules-section">
          <p class="rules-title">{{ section.title }}</p>
          <div class="rules-row">
            <div v-for="field in section.fields" :key="field.key" class="rules-field">
              <label :for="`rules-${field.key}`" class="rules-field-label">{{ field.label }}</label>
              <AvailabilityTimeSelect
                v-if="field.time"
                :id="`rules-${field.key}`"
                v-model="form[field.key]"
                variant="field"
                :placeholder="t('listing.rulesTimePlaceholder')"
              />
              <!-- 258:293: the unit sits inside the field, at its right edge. -->
              <div v-else class="rules-input" :class="{ 'is-invalid': field.invalid }">
                <input
                  :id="`rules-${field.key}`"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  class="rules-input-control"
                  :value="form[field.key] ?? ''"
                  @input="onRulesInput($event, field.key)"
                />
                <span class="rules-input-unit">{{ field.unit }}</span>
              </div>
              <p v-if="field.error" class="rules-error"><img src="/images/icons/field-error.svg" alt="" />{{ field.error }}</p>
              <p v-else-if="field.hint" class="rules-hint">{{ field.hint }}</p>
            </div>
          </div>
          <p v-if="section.error" class="rules-error"><img src="/images/icons/field-error.svg" alt="" />{{ section.error }}</p>
          <p v-else-if="section.hint" class="rules-row-hint">{{ section.hint }}</p>
          <p v-if="section.note" class="rules-note">{{ section.note }}</p>
        </section>
      </div>

      <!-- Dizajn 24: Plaćanje i otkazivanje, the Forma column of 262:345. The option cards
           are step 2's (249:290) and the advance fields step 4's (258:291). -->
      <div v-else-if="steps[currentStep].key === 'payment'" class="payment">
        <!-- 264:287 -->
        <div class="payment-group" role="radiogroup" aria-labelledby="payment-method-label">
          <p id="payment-method-label" class="pricing-label">{{ t('listing.paymentMethod') }} <span class="pricing-required">*</span></p>
          <label
            v-for="option in paymentMethodOptions"
            :key="option.value"
            class="pricing-option"
            :class="{ 'is-selected': form.paymentMethod === option.value }"
          >
            <input
              v-model="form.paymentMethod"
              type="radio"
              name="payment-method"
              :value="option.value"
              class="visually-hidden"
              @change="onPaymentMethodChange"
            />
            <span class="pricing-radio" aria-hidden="true" />
            <span class="pricing-option-text">
              <span class="pricing-option-title">{{ option.title }}</span>
              <span class="pricing-option-desc">{{ option.description }}</span>
            </span>
          </label>

          <!-- 264:305: the advance and the deadline only apply to a QR payment. -->
          <div v-if="paymentUsesQr" class="payment-advance">
            <p class="payment-advance-head">{{ t('listing.paymentAdvanceFor') }}</p>
            <div class="rules-row">
              <div v-for="field in paymentAdvanceFields" :key="field.key" class="rules-field">
                <label :for="`payment-${field.key}`" class="rules-field-label">{{ field.label }}</label>
                <div class="rules-input payment-input" :class="{ 'is-invalid': paymentErrors[field.key] }">
                  <input
                    :id="`payment-${field.key}`"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    class="rules-input-control"
                    :value="form[field.key] ?? ''"
                    :placeholder="field.placeholder"
                    @input="onPaymentInput($event, field.key, 3)"
                  />
                  <span class="rules-input-unit">{{ field.unit }}</span>
                </div>
                <p v-if="paymentErrors[field.key]" class="rules-error"><img src="/images/icons/field-error.svg" alt="" />{{ paymentErrors[field.key] }}</p>
                <p v-else class="rules-hint">{{ field.hint }}</p>
              </div>
            </div>
          </div>

          <!-- No frame: without a bank account no QR code goes out, and step 9 holds the listing back. -->
          <p v-if="paymentUsesQr && !hasBankAccount" class="payment-note">
            {{ t('listing.paymentBankAccountMissing') }}
            <NuxtLink to="/kontrolna-tabla/podesavanja">{{ t('listing.paymentBankAccountAdd') }}</NuxtLink>
          </p>
        </div>

        <!-- 264:321 -->
        <div class="payment-group" role="radiogroup" aria-labelledby="payment-handling-label">
          <p id="payment-handling-label" class="pricing-label">{{ t('listing.requestHandling') }} <span class="pricing-required">*</span></p>
          <label
            v-for="option in requestHandlingOptions"
            :key="String(option.value)"
            class="pricing-option"
            :class="{ 'is-selected': form.requiresApproval === option.value, 'is-disabled': option.disabled }"
          >
            <input
              v-model="form.requiresApproval"
              type="radio"
              name="payment-handling"
              :value="option.value"
              :disabled="option.disabled"
              class="visually-hidden"
            />
            <span class="pricing-radio" aria-hidden="true" />
            <span class="pricing-option-text">
              <span class="pricing-option-title">{{ option.title }}</span>
              <span class="pricing-option-desc">{{ option.description }}</span>
            </span>
          </label>
          <!-- 264:334: why a cash request always waits for approval. -->
          <p v-if="form.paymentMethod !== 'BANK_TRANSFER'" class="payment-note">{{ t('listing.requestHandlingCashNotice') }}</p>
        </div>

        <!-- 264:336 -->
        <div class="payment-group" role="radiogroup" aria-labelledby="payment-cancellation-label">
          <p id="payment-cancellation-label" class="pricing-label">{{ t('listing.cancellationTerms') }}</p>
          <div class="payment-options">
            <template v-for="option in cancellationOptions" :key="option.value">
              <label class="pricing-option" :class="{ 'is-selected': form.cancellationPolicyType === option.value }">
                <input
                  v-model="form.cancellationPolicyType"
                  type="radio"
                  name="payment-cancellation"
                  :value="option.value"
                  class="visually-hidden"
                  @change="paymentErrors.cancellationThreshold = ''"
                />
                <span class="pricing-radio" aria-hidden="true" />
                <span class="pricing-option-text">
                  <span class="pricing-option-title">{{ option.title }}</span>
                  <span v-if="option.description" class="pricing-option-desc">{{ option.description }}</span>
                </span>
              </label>
              <!-- 264:349: the number, under the option that uses it. -->
              <div v-if="option.thresholdLabel && form.cancellationPolicyType === option.value" class="payment-threshold">
                <label for="payment-threshold" class="payment-threshold-label">{{ option.thresholdLabel }}</label>
                <div class="payment-threshold-input" :class="{ 'is-invalid': paymentErrors.cancellationThreshold }">
                  <input
                    id="payment-threshold"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    class="payment-threshold-control"
                    :value="form.cancellationThreshold ?? ''"
                    @input="onPaymentInput($event, 'cancellationThreshold')"
                  />
                  <span class="rules-input-unit">{{ option.thresholdUnit }}</span>
                </div>
                <p v-if="paymentErrors.cancellationThreshold" class="rules-error">
                  <img src="/images/icons/field-error.svg" alt="" />{{ paymentErrors.cancellationThreshold }}
                </p>
              </div>
            </template>
          </div>
        </div>

        <!-- 264:359 -->
        <p class="payment-money-note">{{ t('listing.noPaymentThroughPlatformNotice') }}</p>
      </div>

      <!-- Dizajn 25: Detalji, the Forma column of the category's own frame: 266:401 for
           Igraonice, 545:576 and its seven siblings for the rest. -->
      <div v-else-if="steps[currentStep].key === 'attributes'" class="details" :class="{ 'details-playroom': detailsPlayroomLook }">
        <template v-for="block in detailsBlocks" :key="block.key">
          <!-- 605:514 -->
          <div v-if="block.type === 'row'" class="details-row" :class="{ 'is-full': block.fields.length === 3 }">
            <div v-for="attr in block.fields" :key="attr.id" class="details-field">
              <label :for="`details-${attr.id}`" class="details-label">{{ attr.name }}</label>
              <!-- 605:550 -->
              <div
                v-if="attr.type === 'LIST'"
                class="details-select"
                :class="{ 'is-empty': !attributeValues[attr.id].singleOption, 'is-invalid': detailsErrors[attr.id] }"
              >
                <select
                  :id="`details-${attr.id}`"
                  v-model="attributeValues[attr.id].singleOption"
                  class="details-select-control"
                  @change="detailsErrors[attr.id] = ''"
                >
                  <option value="">{{ t('listing.detailsSelectPlaceholder') }}</option>
                  <option v-for="opt in attr.options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                </select>
                <img src="/images/icons/chevron-down.svg" alt="" class="details-select-chevron" />
              </div>
              <!-- 605:518: the whole box is the field, so a press beside the number lands in it. -->
              <div
                v-else
                class="details-input"
                :class="{ 'has-unit': detailsUnit(attr), 'is-invalid': detailsErrors[attr.id] }"
                @mousedown="focusDetailsInput"
              >
                <span class="details-input-value" :data-value="detailsInputText(attr)">
                  <input
                    :id="`details-${attr.id}`"
                    type="text"
                    size="1"
                    :inputmode="attr.type === 'TEXT' ? 'text' : attr.type === 'YEAR' ? 'numeric' : 'decimal'"
                    autocomplete="off"
                    class="details-input-control"
                    :value="detailsInputText(attr)"
                    @input="onDetailsInput(attr, $event)"
                  />
                </span>
                <span v-if="detailsUnit(attr)" class="details-input-unit">{{ detailsUnit(attr) }}</span>
              </div>
              <p v-if="detailsErrors[attr.id]" class="rules-error">
                <img src="/images/icons/field-error.svg" alt="" />{{ detailsErrors[attr.id] }}
              </p>
              <p v-else-if="detailsHint(attr)" class="details-hint">{{ detailsHint(attr) }}</p>
            </div>
          </div>

          <!-- No frame draws a text box; it takes the fields' look. -->
          <div v-else-if="block.type === 'textarea'" class="details-group">
            <label :for="`details-${block.attr.id}`" class="details-label">{{ block.attr.name }}</label>
            <textarea
              :id="`details-${block.attr.id}`"
              v-model="attributeValues[block.attr.id].valueText"
              class="details-textarea"
              :class="{ 'is-invalid': detailsErrors[block.attr.id] }"
              @input="detailsErrors[block.attr.id] = ''"
            />
            <p v-if="detailsErrors[block.attr.id]" class="rules-error">
              <img src="/images/icons/field-error.svg" alt="" />{{ detailsErrors[block.attr.id] }}
            </p>
          </div>

          <!-- 607:731, and 269:295 for Igraonice's age brackets. -->
          <div
            v-else-if="block.type === 'pills'"
            class="details-group"
            role="group"
            :aria-labelledby="`details-label-${block.attr.id}`"
          >
            <p class="details-group-label">
              <span :id="`details-label-${block.attr.id}`">{{ detailsGroupLabel(block.attr) }}</span>
              <span class="details-group-note">
                {{ t(block.attr.type === 'BOOLEAN' ? 'listing.detailsNoteSingle' : 'listing.detailsNoteMultiple') }}
              </span>
            </p>
            <div class="details-pills">
              <template v-if="block.attr.type === 'BOOLEAN'">
                <label
                  v-for="(answer, index) in [true, false]"
                  :key="String(answer)"
                  class="details-pill details-pill-single"
                  :class="{ 'is-selected': attributeValues[block.attr.id].valueBoolean === answer }"
                >
                  <input
                    :id="index === 0 ? `details-${block.attr.id}` : undefined"
                    type="radio"
                    class="visually-hidden"
                    :name="`details-${block.attr.id}`"
                    :checked="attributeValues[block.attr.id].valueBoolean === answer"
                    @change="attributeValues[block.attr.id].valueBoolean = answer"
                  />
                  <span class="details-check" aria-hidden="true">
                    <img v-if="attributeValues[block.attr.id].valueBoolean === answer" :src="detailsCheckIcon" alt="" />
                  </span>
                  {{ t(answer ? 'common.yes' : 'common.no') }}
                </label>
              </template>
              <template v-else>
                <label
                  v-for="(opt, index) in block.attr.options"
                  :key="opt.id"
                  class="details-pill"
                  :class="{ 'is-selected': attributeValues[block.attr.id].valueOptionIds.includes(opt.id) }"
                >
                  <input
                    :id="index === 0 ? `details-${block.attr.id}` : undefined"
                    v-model="attributeValues[block.attr.id].valueOptionIds"
                    type="checkbox"
                    class="visually-hidden"
                    :value="opt.id"
                    @change="detailsErrors[block.attr.id] = ''"
                  />
                  <span class="details-check" aria-hidden="true">
                    <img v-if="attributeValues[block.attr.id].valueOptionIds.includes(opt.id)" :src="detailsCheckIcon" alt="" />
                  </span>
                  {{ opt.name }}
                </label>
              </template>
            </div>
            <p v-if="detailsErrors[block.attr.id]" class="rules-error">
              <img src="/images/icons/field-error.svg" alt="" />{{ detailsErrors[block.attr.id] }}
            </p>
          </div>

          <!-- 605:555, and 269:316 for Igraonice. -->
          <div v-else class="details-group" role="group" :aria-labelledby="`details-label-${block.attr.id}`">
            <p class="details-group-label">
              <span :id="`details-label-${block.attr.id}`">{{ detailsGroupLabel(block.attr) }}</span>
              <span v-if="!detailsPlayroomLook" class="details-group-note">{{ t('listing.detailsNoteMultiple') }}</span>
            </p>
            <div class="details-tiles">
              <label
                v-for="(opt, index) in block.attr.options"
                :key="opt.id"
                class="details-tile"
                :class="{ 'is-selected': attributeValues[block.attr.id].valueOptionIds.includes(opt.id) }"
              >
                <input
                  :id="index === 0 ? `details-${block.attr.id}` : undefined"
                  v-model="attributeValues[block.attr.id].valueOptionIds"
                  type="checkbox"
                  class="visually-hidden"
                  :value="opt.id"
                  @change="detailsErrors[block.attr.id] = ''"
                />
                <span class="details-check" aria-hidden="true">
                  <img v-if="attributeValues[block.attr.id].valueOptionIds.includes(opt.id)" :src="detailsCheckIcon" alt="" />
                </span>
                <span class="details-tile-text">{{ opt.name }}</span>
              </label>
            </div>
            <p v-if="detailsErrors[block.attr.id]" class="rules-error">
              <img src="/images/icons/field-error.svg" alt="" />{{ detailsErrors[block.attr.id] }}
            </p>
          </div>
        </template>
        <p v-if="!detailsBlocks.length" class="details-empty">{{ t('listing.noAttributesForCategory') }}</p>
      </div>

      <!-- Lokacija -->
      <div v-else-if="steps[currentStep].key === 'location'">
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.region') }} *</label>
          <select v-model="location.regionId" class="form-control form-select" @change="onRegionChange">
            <option value="">—</option>
            <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.city') }} *</label>
          <select v-model="location.cityId" class="form-control form-select" @change="onCityChange">
            <option value="">—</option>
            <option v-for="c in citiesInRegion" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div v-if="cityAreas.length" class="form-group mb-3">
          <label class="form-label">{{ t('listing.cityArea') }} *</label>
          <select v-model="location.cityAreaId" class="form-control form-select">
            <option value="">—</option>
            <option v-for="a in cityAreas" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.address') }} *</label>
          <input v-model="location.address" type="text" class="form-control" @blur="previewLocationOnMap" />
        </div>

        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.mapPinLabel') }}</label>
          <p class="text-muted mb-2">{{ t('listing.mapPinHint') }}</p>
          <LocationPickerMap
            :latitude="location.latitude"
            :longitude="location.longitude"
            @update:position="onPinDragged"
          />
        </div>

        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.googlePlaceIdLabel') }}</label>
          <p class="text-muted mb-2">{{ t('listing.googlePlaceIdHint') }}</p>
          <input v-model="location.googlePlaceId" type="text" class="form-control" placeholder="ChIJ..." />
        </div>
      </div>

      <!-- Fotografije -->
      <div v-else-if="steps[currentStep].key === 'photos'">
        <p class="text-muted mb-3">{{ t('listing.photoCountRecommendation') }}</p>
        <div
          class="dropzone"
          :class="{ 'dropzone-active': dropzoneActive }"
          @click="fileInput.click()"
          @dragover.prevent="dropzoneActive = true"
          @dragleave.prevent="dropzoneActive = false"
          @drop.prevent="onDropFiles"
        >
          <div class="dropzone-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="white" stroke-width="2" stroke-linecap="round" /></svg>
          </div>
          <strong>{{ t('listing.dropzoneTitle') }}</strong>
          <span>{{ t('listing.dropzoneHint') }}</span>
          <input ref="fileInput" type="file" accept="image/*" multiple class="d-none" @change="onFileInputChange" />
        </div>

        <div class="photo-grid">
          <div
            v-for="(photo, index) in photos"
            :key="photo.id"
            class="photo"
            draggable="true"
            @dragstart="onPhotoDragStart(index)"
            @dragover.prevent
            @drop.prevent="onPhotoDrop(index)"
          >
            <img :src="photo.url" :alt="photo.altText || ''" />
            <button
              class="photo-badge"
              :class="{ 'photo-badge-inactive': index !== 0 }"
              :title="index === 0 ? t('listing.coverPhotoBadge') : t('listing.setCoverPhotoHint')"
              @click.stop="setCoverPhoto(index)"
            >
              ★ {{ index === 0 ? t('listing.coverPhotoBadge') : '' }}
            </button>
            <button class="photo-remove" :aria-label="t('listing.removePhoto')" @click.stop="removePhoto(photo.id)">✕</button>
            <span class="photo-drag" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="6" r="1.6" fill="#334155" /><circle cx="16" cy="6" r="1.6" fill="#334155" /><circle cx="8" cy="12" r="1.6" fill="#334155" /><circle cx="16" cy="12" r="1.6" fill="#334155" /><circle cx="8" cy="18" r="1.6" fill="#334155" /><circle cx="16" cy="18" r="1.6" fill="#334155" /></svg>
            </span>
          </div>
          <div class="photo photo-add" @click="fileInput.click()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#0957df" stroke-width="2.2" stroke-linecap="round" /></svg>
            {{ t('listing.addMorePhotos') }}
          </div>
        </div>

        <div v-if="photos.length > 1" class="grid-hint">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          {{ t('listing.setCoverPhotoHint') }}
        </div>
      </div>

      <!-- Pregled -->
      <div v-else-if="steps[currentStep].key === 'review'">
        <ul class="wizard-checklist mb-4">
          <li v-for="(ok, key) in readiness?.checklist" :key="key" :class="ok ? 'text-success' : 'text-error'">
            {{ ok ? '✓' : '✗' }} {{ t(`listing.checklist.${key}`) }}
            <NuxtLink v-if="!ok && key === 'hasPhone'" to="/kontrolna-tabla/podesavanja">{{ t('common.edit') }} →</NuxtLink>
            <!-- T33 — name the specific missing attribute(s) instead of leaving
                 the owner to guess which of the category's fields is empty. -->
            <span v-if="!ok && key === 'requiredAttributesFilled' && readiness?.missingAttributeNames?.length" class="text-muted">
              ({{ t('listing.missingAttributesPrefix') }}: {{ readiness.missingAttributeNames.join(', ') }})
            </span>
          </li>
        </ul>
        <p v-if="!readiness?.ready" class="text-muted mb-3">{{ t('listing.notReadyYet') }}</p>

        <div class="review-actions">
          <NuxtLink :to="`/oglasi/${listingId}/pregled`" class="btn btn-tertiary">{{ t('listing.previewListing') }}</NuxtLink>
          <NuxtLink v-if="!listing?.subscriptionId" to="/kontrolna-tabla/oglasi" class="btn btn-tertiary">{{ t('listing.saveAsDraft') }}</NuxtLink>
          <!-- T41 — a listing that already has a package attached (editing an
               existing/published listing) never needs to go through package
               selection again; every step already saved as the owner went,
               so "finishing" here is just a confirmation, no purchase. -->
          <button
            v-if="readiness?.ready && listing?.subscriptionId"
            class="btn btn-primary-flat"
            :disabled="finishing"
            @click="finishEditing"
          >
            {{ finishing ? t('common.loading') : t('listing.saveChanges') }}
          </button>
          <!-- T42 — a brand-new listing whose owner already has an active PRO
               subscription with a free slot attaches to it directly instead
               of detouring through a package purchase they don't need. -->
          <button
            v-else-if="readiness?.ready && freeSlotSubscription"
            class="btn btn-primary-flat"
            :disabled="finishing"
            @click="publishWithFreeSlot"
          >
            {{ finishing ? t('common.loading') : t('listing.publishWithExistingPackage') }}
          </button>
          <NuxtLink v-else-if="readiness?.ready" :to="`/oglasi/${listingId}/paket`" class="btn btn-primary-flat">
            {{ t('listing.goToPackages') }}
          </NuxtLink>
        </div>
        <p class="text-muted mt-2">{{ t('listing.draftSavedExplain') }}</p>
      </div>

      <p v-if="error" class="wizard-error" role="alert"><img src="/images/icons/field-error.svg" alt="" />{{ error }}</p>
    </div>

    <!-- 228:316: step 1's tips, in the grid's 400 column beside the form. -->
    <aside v-if="steps[currentStep].key === 'basics'" class="wizard-tips">
      <p class="wizard-tips-title">
        {{ t('listing.basicsTipsTitle') }}
        <span class="wizard-tips-info" aria-hidden="true"><img src="/images/icons/info-circle.svg" alt="" /></span>
      </p>
      <ul class="wizard-tips-list">
        <li v-for="tip in basicsTips" :key="tip" class="wizard-tips-item">
          <img src="/images/icons/check-brand-16.svg" alt="" />
          <span>{{ tip }}</span>
        </li>
      </ul>
    </aside>

    <!-- 231:380: step 2's preview and tips, in the grid's 400 column beside the form. -->
    <aside v-if="steps[currentStep].key === 'pricing'" class="wizard-aside">
      <!-- 237:295 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.pricingPreviewTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <!-- 237:300: ListingBookingPanel as a guest sees it, as far as this step decides it. -->
        <div class="pricing-preview">
          <p v-if="showFlatPriceFields" class="pricing-preview-price">
            <span class="pricing-preview-amount">{{ previewPrice }}</span>
            <span class="pricing-preview-unit">{{ previewUnit }}</span>
          </p>
          <template v-if="bookingChoice === 'ONLINE'">
            <span class="pricing-preview-cta">{{ t('listing.sendRequest') }}</span>
            <p class="pricing-preview-note">{{ t('booking.requestGoesToOwner') }}</p>
          </template>
          <p v-else class="pricing-preview-note">{{ t('booking.noOnlineBooking') }}</p>
        </div>
        <p class="wizard-aside-caption">{{ t('listing.pricingPreviewCaption') }}</p>
      </section>

      <!-- 237:308 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.stepTipsTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <ul class="wizard-aside-tips">
          <li v-for="tip in pricingTips" :key="tip" class="wizard-aside-tip">
            <img src="/images/icons/check-brand-tips.svg" alt="" />
            <span>{{ tip }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 239:386 and 532:729: step 3's preview and tips beside the slot editors. -->
    <aside v-if="steps[currentStep].key === 'availability' && form.bookingModel === 'PER_SLOT'" class="wizard-aside">
      <!-- 254:287, 532:730 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.availabilityPreviewTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <template v-if="isDefinedSlotsModel">
          <!-- 534:515: the guest's list for the first day that has open slots. -->
          <div v-if="definedSlotsPreview" class="slots-preview">
            <p class="slots-preview-date">{{ definedSlotsPreview.date }}</p>
            <span
              v-for="(slot, index) in definedSlotsPreview.slots"
              :key="slot.id"
              class="slots-preview-slot"
              :class="{ 'is-selected': index === definedSlotsPreview.selectedIndex }"
            >
              <span class="slots-preview-time">{{ slot.time }}</span>
              <span class="slots-preview-price">{{ slot.price }}</span>
            </span>
            <span class="availability-preview-cta">{{ t('listing.sendRequest') }}</span>
          </div>
          <p v-else class="wizard-aside-caption">{{ t('listing.availabilityPreviewNoSlots') }}</p>
          <p class="wizard-aside-caption availability-preview-caption">{{ t('listing.availabilityPreviewCaptionDs') }}</p>
        </template>
        <template v-else>
          <!-- 254:292: the next open day, priced the way a booking would be. -->
          <div class="hours-preview">
            <div class="hours-preview-box">
              <span class="hours-preview-label">{{ t('listing.availabilityPreviewDate') }}</span>
              <span class="hours-preview-value">{{ workingHoursPreview?.date || t('listing.availabilityPreviewNoDays') }}</span>
            </div>
            <div class="hours-preview-times">
              <div class="hours-preview-box">
                <span class="hours-preview-label">{{ t('listing.availabilityPreviewFrom') }}</span>
                <span class="hours-preview-value">{{ workingHoursPreview?.from || '-' }}</span>
              </div>
              <div class="hours-preview-box">
                <span class="hours-preview-label">{{ t('listing.availabilityPreviewTo') }}</span>
                <span class="hours-preview-value">{{ workingHoursPreview?.to || '-' }}</span>
              </div>
            </div>
            <p v-if="workingHoursPreview" class="hours-preview-sum">
              <span class="hours-preview-line">{{ workingHoursPreview.line }}</span>
              <span class="hours-preview-total">{{ workingHoursPreview.total }}</span>
            </p>
            <span class="availability-preview-cta">{{ t('listing.sendRequest') }}</span>
          </div>
          <p class="wizard-aside-caption availability-preview-caption">
            {{ t(availabilityWeekendApplies ? 'listing.availabilityPreviewCaptionWh' : 'listing.availabilityPreviewCaptionWhNoWeekend') }}
          </p>
        </template>
      </section>

      <!-- 254:309, 532:752 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.stepTipsTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <ul class="wizard-aside-tips">
          <li v-for="tip in availabilityTips" :key="tip" class="wizard-aside-tip">
            <img src="/images/icons/check-brand-tips.svg" alt="" />
            <span>{{ tip }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 256:498: step 4's summary and tips, in the grid's 400 column beside the form. -->
    <aside v-if="steps[currentStep].key === 'rules'" class="wizard-aside">
      <!-- 260:287 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.rulesSummaryTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <!-- 260:292: the rules the way the guest is held to them. -->
        <dl class="rules-summary">
          <div v-for="row in rulesSummary" :key="row.key" class="rules-summary-row">
            <dt class="rules-summary-label">{{ row.label }}</dt>
            <dd class="rules-summary-value">{{ row.value }}</dd>
          </div>
        </dl>
        <p class="wizard-aside-caption rules-caption">{{ t('listing.rulesSummaryCaption') }}</p>
      </section>

      <!-- 260:309 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.stepTipsTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <ul class="wizard-aside-tips">
          <li v-for="tip in rulesTips" :key="tip" class="wizard-aside-tip">
            <img src="/images/icons/check-brand-tips.svg" alt="" />
            <span>{{ tip }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 262:406: step 5's booking flow and tips, in the grid's 400 column beside the form. -->
    <aside v-if="steps[currentStep].key === 'payment'" class="wizard-aside">
      <!-- 266:287 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.paymentFlowTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <ol class="payment-flow">
          <li v-for="(flowStep, index) in paymentFlowSteps" :key="flowStep.key" class="payment-flow-step">
            <span class="payment-flow-number">{{ index + 1 }}</span>
            <span class="payment-flow-text">
              <span class="payment-flow-title">{{ flowStep.title }}</span>
              <span class="payment-flow-desc">{{ flowStep.description }}</span>
            </span>
          </li>
        </ol>
      </section>

      <!-- 266:317 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.stepTipsTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <ul class="wizard-aside-tips">
          <li v-for="tip in paymentTips" :key="tip" class="wizard-aside-tip">
            <img src="/images/icons/check-brand-tips.svg" alt="" />
            <span>{{ tip }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 266:476, 545:668: step 6's preview of the listing's Detalji section and the tips, in the
         grid's 400 column beside the form. -->
    <aside v-if="steps[currentStep].key === 'attributes'" class="wizard-aside">
      <!-- 545:669, and 273:287 for Igraonice -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.detailsPreviewTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <!-- The rows ListingPublicView shows, and the number of Opremljenost items. -->
        <dl v-if="detailsPreviewRows.length" class="details-summary" :class="{ 'is-lined': detailsPlayroomLook }">
          <div v-for="row in detailsPreviewRows" :key="row.key" class="details-summary-row">
            <dt class="details-summary-label">{{ row.label }}</dt>
            <dd class="details-summary-value">{{ row.value }}</dd>
          </div>
        </dl>
        <p v-else class="wizard-aside-caption">{{ t('listing.detailsPreviewEmpty') }}</p>
        <!-- 545:684 -->
        <div v-if="detailsFilterChips.length" class="details-filters" :class="{ 'is-playroom': detailsPlayroomLook }">
          <p class="wizard-aside-caption">{{ detailsFiltersCaption }}</p>
          <ul class="details-chips">
            <li v-for="chip in detailsFilterChips" :key="chip" class="details-chip">{{ chip }}</li>
          </ul>
        </div>
      </section>

      <!-- 545:693 -->
      <section class="wizard-aside-card">
        <p class="wizard-aside-title">
          {{ t('listing.stepTipsTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <ul class="wizard-aside-tips">
          <li v-for="tip in detailsTips" :key="tip" class="wizard-aside-tip">
            <img src="/images/icons/check-brand-tips.svg" alt="" />
            <span>{{ tip }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 228:376 -->
    <div class="wizard-actions">
      <div class="wizard-actions-back">
        <button type="button" class="wizard-back" :disabled="currentStep === 0" @click="currentStep--">
          <img src="/images/icons/arrow-left.svg" alt="" />
          {{ t('listing.back') }}
        </button>
        <span class="wizard-count">{{ t('listing.wizardStepsProgress', { current: currentStep + 1, total: steps.length }) }}</span>
      </div>
      <button v-if="currentStep < steps.length - 1" type="button" class="wizard-next" :disabled="saving" @click="saveCurrentStep">
        {{ saving ? t('common.loading') : t('listing.saveAndContinue') }}
        <img src="/images/icons/arrow-right-white.svg" alt="" />
      </button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const listingId = route.params.id
const currentStep = ref(0)
// How far the user is *allowed* to jump ahead — steps beyond this are
// disabled tabs. Advances automatically as each step saves successfully;
// never decreases, so a completed step stays reachable for editing even
// after moving on.
const maxStepReached = ref(0)
const saving = ref(false)
const error = ref('')
const listing = ref(null)
const readiness = ref(null)
// T72 — lets saveCurrentStep() reach WorkingHoursEditor's save() when the
// step is left via the main CTA instead of the editor's own button.
const workingHoursEditorRef = ref(null)
// T26 — lets validateCurrentStep() check whether at least one defined slot
// exists before letting the owner leave the availability step.
const definedSlotsEditorRef = ref(null)
const photos = ref([])
const regions = ref([])
const cities = ref([])
const cityAreas = ref([])
const fileInput = ref(null)
const dropzoneActive = ref(false)
const draggedPhotoIndex = ref(null)
const mySubscriptions = ref([])
const finishing = ref(false)
// Dizajn 20 (228:325, 228:334): the counters' limits, the same as UpdateListingDto's.
const TITLE_MAX_LENGTH = 70
const DESCRIPTION_MAX_LENGTH = 1200
// Step 1 shows its errors under each field (Dizajn 6) instead of under the form.
const basicsErrors = reactive({ title: '', description: '', videoUrl: '' })

// Declared before the steps/watchers below since watch()'s source getter
// (unlike computed()) runs eagerly at setup time — referencing `form` in
// one before this declaration is a temporal-dead-zone error, not just a
// stale-closure bug.
const form = reactive({
  bookingModel: 'PER_STAY',
  slotSubmode: null,
  title: '',
  description: '',
  videoUrl: '',
  priceUnit: 'NIGHT',
  price: 0,
  weekendPrice: null,
  paymentMethod: 'CASH',
  requiresApproval: true,
  advancePercent: null,
  paymentDeadlineHours: 48,
  minDuration: null,
  maxDuration: null,
  minGuests: null,
  maxGuests: null,
  gapAfterMinutes: null,
  pickupTime: '',
  returnTime: '',
  earliestBookingHours: null,
  maxAdvanceBookingDays: null,
  cancellationPolicyType: null,
  cancellationThreshold: null,
})

// Dodavanje Oglasa spec's KONAČNI FLOW — a fixed 9-step order (basics
// first, then price+booking-method combined, then availability/rules/
// payment, which are the only steps "Bez rezervacije" ever skips), rather
// than the old free-choice bookingModel step 0 + a separate pricing step 5.
const ALL_STEPS = [
  { key: 'basics', labelKey: 'listing.stepBasics', descKey: 'listing.stepBasicsDesc' },
  { key: 'pricing', labelKey: 'listing.stepPricing', descKey: 'listing.stepPricingDesc' },
  { key: 'availability', labelKey: 'listing.stepAvailability', descKey: 'listing.stepAvailabilityDesc', skipIfNoBooking: true },
  { key: 'rules', labelKey: 'listing.stepRules', descKey: 'listing.stepRulesDesc', skipIfNoBooking: true },
  { key: 'payment', labelKey: 'listing.stepPayment', descKey: 'listing.stepPaymentDesc', skipIfNoBooking: true },
  { key: 'attributes', labelKey: 'listing.stepAttributes', descKey: 'listing.stepAttributesDesc' },
  { key: 'location', labelKey: 'listing.stepLocation', descKey: 'listing.stepLocationDesc' },
  { key: 'photos', labelKey: 'listing.stepPhotos', descKey: 'listing.stepPhotosDesc' },
  { key: 'review', labelKey: 'listing.stepReview', descKey: 'listing.stepReviewDesc' },
]
const steps = computed(() => ALL_STEPS.filter((s) => !s.skipIfNoBooking || form.bookingModel !== 'NO_BOOKING'))

// Toggling "bez rezervacije" removes 3 steps from the array — keep the user
// on a valid index instead of landing on whatever step now shares that slot.
watch(
  () => form.bookingModel,
  () => {
    nextTick(() => {
      if (currentStep.value >= steps.value.length) currentStep.value = steps.value.length - 1
    })
  },
)

// T42 — an active PRO subscription with fewer published listings than its
// listingLimit has a free slot; a brand-new listing can attach to it instead
// of buying a new package. Same condition pretplate.vue already uses for its
// "attach free" action, just reached from the create wizard this time.
const freeSlotSubscription = computed(() =>
  (mySubscriptions.value || []).find(
    (s) => s.status === 'ACTIVE' && s.package?.key === 'PRO' && (s.listings?.length || 0) < (s.package?.listingLimit || 0),
  ),
)

// Refetch readiness any time the review step becomes active — via
// save-and-advance, a tab click, or returning to an already-unlocked review
// step after fixing something elsewhere (e.g. adding a phone number) — not
// just the one path that used to call it inline in saveCurrentStep().
watch(currentStep, async (step) => {
  if (step === steps.value.length - 1) {
    readiness.value = await api.get(`/listings/${listingId}/readiness`)
  }
})

// "Način rezervacije" (Dodavanje Oglasa spec §0/§2) — the owner never picks
// PER_STAY vs PER_SLOT directly; that always comes from the category. This
// binary choice is all that's actually theirs: online (whichever model the
// category has) or no booking system at all.
const bookingChoice = ref('ONLINE')
watch(bookingChoice, (val) => {
  form.bookingModel = val === 'ONLINE' ? listing.value?.category?.defaultBookingModel || 'PER_STAY' : 'NO_BOOKING'
  if (form.bookingModel === 'PER_SLOT' && !form.slotSubmode) form.slotSubmode = 'WORKING_HOURS'
})
// Dizajn 21 (249:287, 249:300): both choices as option cards. The online card is
// worded for the category's own booking model.
const bookingOptions = computed(() => {
  const perSlot = listing.value?.category?.defaultBookingModel === 'PER_SLOT'
  return [
    {
      value: 'ONLINE',
      title: t(perSlot ? 'listing.pricingBookingOnlineSlot' : 'listing.pricingBookingOnlineStay'),
      description: t(perSlot ? 'listing.pricingBookingOnlineSlotDesc' : 'listing.pricingBookingOnlineStayDesc'),
    },
    { value: 'NONE', title: t('listing.pricingBookingNone'), description: t('listing.pricingBookingNoneDesc') },
  ]
})
const slotSubmodeOptions = computed(() => [
  { value: 'WORKING_HOURS', title: t('listing.slotSubmodeWorkingHours'), description: t('listing.slotSubmodeWorkingHoursDesc') },
  { value: 'DEFINED_SLOTS', title: t('listing.slotSubmodeDefined'), description: t('listing.slotSubmodeDefinedDesc') },
])

// PER_SLOT never shows a free price-unit choice (always HOUR for working
// hours, SLOT for defined slots — each slot carries its own price instead) —
// T111's exception: Sale za proslave may opt into GUEST instead, and that
// choice should survive switching between the two submodes, not get
// silently reset back to HOUR/SLOT by this same watcher.
watch(
  () => [form.bookingModel, form.slotSubmode],
  () => {
    if (form.bookingModel === 'PER_SLOT' && form.priceUnit !== 'GUEST') {
      form.priceUnit = form.slotSubmode === 'DEFINED_SLOTS' ? 'SLOT' : 'HOUR'
    }
  },
)

const showFlatPriceFields = computed(() => !(form.bookingModel === 'PER_SLOT' && form.slotSubmode === 'DEFINED_SLOTS'))

// T35 — a per-model rule (Definisani termini has no single "duration" to
// bound), unlike T36/T37 below which are per-category — kept as separate
// computeds rather than merged, per the tickets' explicit instruction not to
// conflate the two root causes.
const isDefinedSlotsModel = computed(() => form.bookingModel === 'PER_SLOT' && form.slotSubmode === 'DEFINED_SLOTS')
// T36/T37 — rented as a whole unit, not per guest.
const NO_GUEST_COUNT_CATEGORY_SLUGS = ['putnicka-vozila', 'dostavna-vozila', 'gradjevinske-masine', 'magacini-i-skladista']
const showGuestCount = computed(() => !NO_GUEST_COUNT_CATEGORY_SLUGS.includes(listing.value?.category?.slug))
// T37 only — T36 explicitly keeps "Razmak posle rezervacije" for Vozila/Mašine.
const showGapAfter = computed(() => !isDefinedSlotsModel.value && listing.value?.category?.slug !== 'magacini-i-skladista')

// Bug fix (found while working T36): listings always belong to a leaf
// category (Putnička/Dostavna vozila), never the "Vozila" parent itself, so
// comparing against the parent slug here meant these fields could never
// actually show for a real listing.
const VEHICLE_CATEGORY_SLUGS = ['putnicka-vozila', 'dostavna-vozila']
const showVehicleTimes = computed(() => VEHICLE_CATEGORY_SLUGS.includes(listing.value?.category?.slug))
// T111 — the only category allowed to charge "po gostu" instead of the
// submode's usual per-hour/per-term rate.
const isPartyHallCategory = computed(() => listing.value?.category?.slug === 'sale-za-proslave')
const autoSlotPriceUnit = computed(() => (form.slotSubmode === 'DEFINED_SLOTS' ? 'SLOT' : 'HOUR'))
const allowedPriceUnitsForChoice = computed(() => {
  if (form.bookingModel === 'PER_SLOT') {
    return isPartyHallCategory.value ? [autoSlotPriceUnit.value, 'GUEST'] : [autoSlotPriceUnit.value]
  }
  return listing.value?.category?.allowedPriceUnits || []
})
// A listing without booking is never charged, so its weekend price stays hidden
// (and kept) until online booking is back on.
const weekendPriceApplies = computed(() => showFlatPriceFields.value && ['NIGHT', 'DAY', 'HOUR'].includes(form.priceUnit))
const showWeekendPrice = computed(() => weekendPriceApplies.value && form.bookingModel !== 'NO_BOOKING')

// "Vikend cena automatski se popunjava istom vrednošću kao obična cena"
// (Dodavanje Oglasa spec §2). Dizajn 21 (249:337): it keeps following the base
// price until the owner enters a different one, which then never gets overwritten.
watch(
  () => form.price,
  (price, previousPrice) => {
    const following = form.weekendPrice === null || form.weekendPrice === undefined || form.weekendPrice === previousPrice
    if (weekendPriceApplies.value && following) form.weekendPrice = price || null
  },
)

// Which prices beat the weekend one (249:336) depends on how the listing is
// booked: a stay's calendar dates, or a slot listing's own priced hours.
const weekendRateKind = computed(() => {
  if (form.bookingModel === 'PER_SLOT') return 'Slot'
  return form.priceUnit === 'NIGHT' ? 'Night' : 'Day'
})

// Dizajn 21 (249:319): prices read "3.500", grouped the way ListingCard prints them.
const rsdFormatter = new Intl.NumberFormat('sr-RS')
const pricingErrors = reactive({ price: '' })

// utils/rsdInput.js keeps only the digits, grouped, with the caret where it was.
function onRsdInput(event, field) {
  form[field] = applyRsdInput(event)
  if (field === 'price') pricingErrors.price = ''
}

// 249:328: the unit sentence only where the owner can't pick another unit, then
// the price exactly as ListingCard prints it.
const PRICE_UNIT_FIXED_CATEGORY = {
  igraonice: 'playrooms',
  stanovi: 'apartments',
  'kuce-i-vikendice': 'houses',
  sobe: 'rooms',
  'sale-za-proslave': 'partyHalls',
  'konferencijske-sale': 'conferenceRooms',
  'putnicka-vozila': 'cars',
  'dostavna-vozila': 'vans',
  'gradjevinske-masine': 'machines',
  'magacini-i-skladista': 'warehouses',
}
const priceHint = computed(() => {
  const cardPrice = `${rsdFormatter.format(form.price || 0)} RSD ${getCardPriceUnitSuffix(form.priceUnit, t)}`.trim()
  const cardSentence = t('listing.priceCardHint', { price: cardPrice })
  if (allowedPriceUnitsForChoice.value.length !== 1 || !form.priceUnit) return cardSentence
  const category = t(`listing.priceUnitFixedCategory.${PRICE_UNIT_FIXED_CATEGORY[listing.value?.category?.slug] || 'default'}`)
  return `${t('listing.priceUnitFixedHint', { category, unit: t(`listing.unit${unitLabel(form.priceUnit)}`) })} ${cardSentence}`
})

// 237:301: ListingBookingPanel's price line.
const previewPrice = computed(() => `${rsdFormatter.format(Math.round(form.price || 0))} RSD`)
const previewUnit = computed(() => {
  if (!form.priceUnit) return ''
  return form.priceUnit === 'GUEST' ? t('listing.pricePerGuestSuffix') : `/ ${t(`listing.unit${unitLabel(form.priceUnit)}`)}`
})

// 237:313 is drawn for Igraonice: the submode tip only applies while slots are
// on, and the weekend tip only where its field shows.
const pricingTips = computed(() => {
  const tips = [t('listing.pricingTipOnline')]
  if (form.bookingModel === 'PER_SLOT') tips.push(t('listing.pricingTipSlotSubmode'))
  if (form.priceUnit) tips.push(t('listing.pricingTipNoCommission', { unit: t(`listing.pricingTipUnit.${form.priceUnit}`) }))
  if (showWeekendPrice.value) tips.push(t(`listing.pricingTipWeekend${weekendRateKind.value}`))
  tips.push(t('listing.pricingTipChangeLater'))
  return tips
})

// Dizajn 22 (254:292, 534:515): each editor works out what a guest would be offered.
const workingHoursPreview = computed(() => workingHoursEditorRef.value?.preview || null)
const definedSlotsPreview = computed(() => definedSlotsEditorRef.value?.preview || null)
// resolveHourlyPrice only applies the weekend price to the hourly rate.
const availabilityWeekendApplies = computed(() => form.priceUnit === 'HOUR' && Number(form.weekendPrice) > 0)

// 254:314 is drawn for Igraonice and 532:757 repeats it word for word, so
// defined slots get tips about their own rules instead.
const availabilityTips = computed(() => {
  if (isDefinedSlotsModel.value) {
    return ['dsTipCopy', 'dsTipBooked', 'dsTipBlocked', 'dsTipRemove', 'dsTipDuration'].map((key) => t(`listing.${key}`))
  }
  const unit = t(`listing.whPriceUnitPhrase.${form.priceUnit === 'GUEST' ? 'GUEST' : 'HOUR'}`)
  const weekend = availabilityWeekendApplies.value
  return [
    t('listing.whTipDayOff'),
    t(weekend ? 'listing.whTipRangesWeekend' : 'listing.whTipRanges', { unit }),
    t(weekend ? 'listing.whTipSpecialPrice' : 'listing.whTipSpecialPriceNoWeekend'),
    t('listing.whTipBlocked'),
    t('listing.whTipDuration'),
  ]
})

// Dizajn 23: 256:287 is drawn for Igraonice. The gap's hint and tip name what the
// owner gets ready between bookings in each category.
const RULES_CATEGORY_KIND = {
  igraonice: 'playroom',
  stanovi: 'stay',
  'kuce-i-vikendice': 'stay',
  sobe: 'stay',
  'sale-za-proslave': 'eventSpace',
  'konferencijske-sale': 'eventSpace',
  'putnicka-vozila': 'vehicle',
  'dostavna-vozila': 'vehicle',
  'gradjevinske-masine': 'machine',
}
const rulesCategoryKind = computed(() => RULES_CATEGORY_KIND[listing.value?.category?.slug] || 'default')
// The frame's slot wording ("termin") only fits slot listings; stays get their own.
const rulesSlotWording = computed(() => form.bookingModel === 'PER_SLOT')
// "Kapacitet ljudi" or "Kapacitet dece", when the category asks for one in step Detalji.
const capacityAttribute = computed(
  () => (listing.value?.category?.attributes || []).find((attr) => isGuestCapacityKey(attr.key)) || null,
)
const rulesChildren = computed(() => capacityAttribute.value?.key === 'kapacitet_dece')
// 258:295: working hours count in hours even when the price is per guest.
const rulesDurationUnit = computed(() => getDurationUnit(form))
const rulesDurationTitle = computed(() =>
  t(rulesSlotWording.value ? 'listing.rulesDurationTitleSlot' : 'listing.rulesDurationTitleStay'),
)

// 256:345 in the frame's order: duration, when a guest can book, guests, the gap.
// Vehicles add their pickup and return times, which the frame doesn't draw.
const rulesSections = computed(() => {
  const field = (key, label, unit, hint) => ({ key, label, unit, hint, error: rulesErrors[key], invalid: !!rulesErrors[key] })
  const sections = []
  if (!isDefinedSlotsModel.value) {
    const unit = rulesDurationUnit.value ? t(`listing.unit${unitLabel(rulesDurationUnit.value)}`) : ''
    const max = field('maxDuration', t('listing.maxDuration'), unit)
    max.invalid = max.invalid || !!rulesErrors.duration
    let note = t('listing.rulesDurationNote')
    if (rulesSlotWording.value) {
      note = t(form.priceUnit === 'GUEST' ? 'listing.rulesDurationNoteGuestPrice' : 'listing.rulesDurationNoteSlot')
    }
    sections.push({
      key: 'duration',
      title: rulesDurationTitle.value,
      fields: [field('minDuration', t('listing.minDuration'), unit), max],
      error: rulesErrors.duration,
      note,
    })
  }
  const hintSuffix = rulesSlotWording.value ? '' : 'Stay'
  sections.push({
    key: 'when',
    title: t('listing.rulesWhenTitle'),
    fields: [
      field(
        'earliestBookingHours',
        t('listing.earliestBookingHours'),
        t('listing.rulesUnitHours'),
        t(`listing.earliestBookingHoursHint${hintSuffix}`),
      ),
      field(
        'maxAdvanceBookingDays',
        t('listing.maxAdvanceBookingDays'),
        t('listing.rulesUnitDays'),
        t(`listing.maxAdvanceBookingDaysHint${hintSuffix}`),
      ),
    ],
  })
  if (showGuestCount.value) {
    const unit = t(rulesChildren.value ? 'listing.rulesUnitChildren' : 'listing.rulesUnitGuests')
    const max = field('maxGuests', t('listing.maxGuests'), unit)
    max.invalid = max.invalid || !!rulesErrors.guests
    sections.push({
      key: 'guests',
      title: t('listing.rulesGuestsTitle'),
      fields: [field('minGuests', t('listing.minGuests'), unit), max],
      error: rulesErrors.guests,
      hint: t('listing.rulesGuestsHint'),
    })
  }
  if (showGapAfter.value) {
    const hint = t(`listing.rulesGapHint.${rulesCategoryKind.value}`)
    sections.push({
      key: 'gap',
      title: t('listing.rulesGapTitle'),
      fields: [field('gapAfterMinutes', t('listing.gapAfterMinutes'), t('listing.rulesUnitMinutes'), hint)],
    })
  }
  if (showVehicleTimes.value) {
    sections.push({
      key: 'vehicleTimes',
      title: t('listing.rulesVehicleTimesTitle'),
      fields: [
        { key: 'pickupTime', label: t('listing.pickupTime'), time: true },
        { key: 'returnTime', label: t('listing.returnTime'), time: true },
      ],
    })
  }
  return sections
})

function termCount(key, count) {
  return t(`listing.${key}${srPluralCategory(count)}`, { count })
}

// The lower of the maximum and the capacity from step Detalji, as the booking card applies it.
const rulesGuestCap = computed(() => {
  const capacity = capacityAttribute.value
  const valueNumber = capacity ? attributeValues[capacity.id]?.valueNumber : null
  return getGuestCap({ maxGuests: form.maxGuests, attributes: capacity ? [{ key: capacity.key, value: { valueNumber } }] : [] })
})

// 260:292: each rule the way the guest meets it.
const rulesSummary = computed(() => {
  const noLimit = t('listing.rulesSummaryNoLimit')
  const rows = []
  if (!isDefinedSlotsModel.value) {
    const unit = rulesDurationUnit.value
    const withUnit = (count) => `${count} ${srDurationUnitWord(unit, count)}`
    const { minDuration: min, maxDuration: max } = form
    let value = noLimit
    if (min && max) value = `${min} - ${withUnit(max)}`
    else if (min) value = t('listing.rulesSummaryAtLeast', { value: withUnit(min) })
    else if (max) value = t('listing.rulesSummaryAtMost', { value: withUnit(max) })
    rows.push({ key: 'duration', label: rulesDurationTitle.value, value })
  }
  const horizon = form.maxAdvanceBookingDays
  rows.push({
    key: 'horizon',
    label: t('listing.rulesSummaryHorizon'),
    value: horizon ? t('listing.rulesSummaryAhead', { days: termCount('termDays', horizon) }) : noLimit,
  })
  const notice = form.earliestBookingHours
  rows.push({
    key: 'notice',
    label: t('listing.rulesSummaryNotice'),
    value: notice
      ? t('listing.rulesSummaryBeforeStart', { hours: termCount('termHours', notice) })
      : t('listing.rulesSummaryUntilStart'),
  })
  if (showGuestCount.value) {
    const min = form.minGuests || 1
    const max = rulesGuestCap.value
    let value = noLimit
    if (max && min > 1) value = `${min} - ${max}`
    else if (max) value = t('listing.rulesSummaryAtMost', { value: max })
    else if (min > 1) value = t('listing.rulesSummaryAtLeast', { value: min })
    rows.push({ key: 'guests', label: t(rulesChildren.value ? 'listing.rulesSummaryChildren' : 'listing.rulesGuestsTitle'), value })
  }
  if (showGapAfter.value) {
    rows.push({
      key: 'gap',
      label: t(rulesSlotWording.value ? 'listing.rulesSummaryGapSlot' : 'listing.gapAfterMinutes'),
      value: form.gapAfterMinutes
        ? t('listing.rulesSummaryMinutes', { count: form.gapAfterMinutes })
        : t('listing.rulesSummaryNoGap'),
    })
  }
  if (showVehicleTimes.value) {
    const byArrangement = t('listing.rulesSummaryByArrangement')
    rows.push({
      key: 'pickup',
      label: t('listing.pickupTime'),
      value: form.pickupTime ? t('listing.termFromTime', { time: form.pickupTime }) : byArrangement,
    })
    rows.push({
      key: 'return',
      label: t('listing.returnTime'),
      value: form.returnTime ? t('listing.termUntilTime', { time: form.returnTime }) : byArrangement,
    })
  }
  return rows
})

// 260:314: each tip shows with the rule it's about. The frame's last tip warns about
// half-hour bookings, which a guest can't make, so it says one hour instead.
const rulesTips = computed(() => {
  const tips = [
    t('listing.rulesTipNotice'),
    t(rulesSlotWording.value ? 'listing.rulesTipHorizonSlot' : 'listing.rulesTipHorizonStay'),
  ]
  if (showGuestCount.value) {
    const variant = !capacityAttribute.value ? 'default' : rulesChildren.value ? 'children' : 'guests'
    tips.push(t(`listing.rulesTipCapacity.${variant}`, { step: t('listing.stepAttributes') }))
  }
  if (isDefinedSlotsModel.value) tips.push(t('listing.rulesTipDefinedSlots'))
  if (showGapAfter.value) tips.push(t(`listing.rulesTipGap.${rulesCategoryKind.value}`))
  if (showVehicleTimes.value) tips.push(t('listing.rulesTipVehicleTimes'))
  if (!isDefinedSlotsModel.value) {
    const unit = ['HOUR', 'NIGHT', 'DAY', 'MONTH'].includes(rulesDurationUnit.value) ? rulesDurationUnit.value : 'default'
    tips.push(t(`listing.rulesTipMinDuration.${unit}`))
  }
  return tips
})

// Dizajn 24: 262:287 is drawn for Igraonice with "Oba" and approval picked. The options
// keep the frame's wording; what follows them depends on the choice.
const PAYMENT_METHOD_TITLES = {
  CASH: 'listing.paymentCash',
  BANK_TRANSFER: 'listing.paymentBankTransfer',
  BOTH: 'listing.paymentBoth',
}
// 264:290
const paymentMethodOptions = computed(() =>
  Object.entries(PAYMENT_METHOD_TITLES).map(([value, titleKey]) => ({
    value,
    title: t(titleKey),
    description: t(`listing.paymentMethodDesc${value}`),
  })),
)
// Cash has no QR code, so no advance, no deadline and no instant confirmation.
const paymentUsesQr = computed(() => form.paymentMethod !== 'CASH')

// 264:309, 264:315: empty means the full amount, and the 48 hours BookingsService falls back to.
const paymentAdvanceFields = computed(() => [
  {
    key: 'advancePercent',
    label: t('listing.advancePercent'),
    unit: '%',
    placeholder: '100',
    hint: t('listing.advancePercentHint'),
  },
  {
    key: 'paymentDeadlineHours',
    label: t('listing.paymentDeadlineHours'),
    unit: t('listing.rulesUnitHours'),
    placeholder: '48',
    hint: t('listing.paymentDeadlineHoursHint'),
  },
])

// 264:324, 264:329: RNT-028 keeps a cash listing on approval.
const requestHandlingOptions = computed(() => [
  { value: true, title: t('listing.requestHandlingApproval'), description: t('listing.requestHandlingApprovalDesc') },
  {
    value: false,
    title: t('listing.requestHandlingInstant'),
    description: t('listing.requestHandlingInstantDesc'),
    disabled: !paymentUsesQr.value,
  },
])

// 264:340, 264:345, 264:355: the free options take their number in 264:349.
const cancellationOptions = computed(() => [
  { value: 'NO_CANCELLATION', title: t('listing.cancellationNone'), description: t('listing.cancellationNoneDesc') },
  {
    value: 'FREE_UNTIL_DAYS',
    title: t('listing.cancellationOptionDays'),
    thresholdLabel: t('listing.cancellationThresholdDays'),
    thresholdUnit: t('listing.rulesUnitDays'),
  },
  {
    value: 'FREE_UNTIL_HOURS',
    title: t('listing.cancellationOptionHours'),
    thresholdLabel: t('listing.cancellationThresholdHours'),
    thresholdUnit: t('listing.rulesUnitHours'),
  },
])

// 266:292: what a request goes through with the choices on the left. On "Oba" the guest
// picks cash or the QR code in the request itself, and approving a cash request confirms it.
const paymentFlowSteps = computed(() => {
  const method = form.paymentMethod
  const both = method === 'BOTH'
  const approval = method === 'CASH' || form.requiresApproval
  const flowStep = (key, descriptionKey) => ({
    key,
    title: t(`listing.paymentFlow.${key}Title`),
    description: t(`listing.paymentFlow.${descriptionKey}`),
  })
  const qrDescription = form.advancePercent ? 'qrDescAdvance' : 'qrDescFull'
  const flow = [flowStep('request', both ? 'requestDescChoice' : 'requestDesc')]
  if (approval) flow.push(flowStep('approve', 'approveDesc'))
  if (method === 'CASH') return [...flow, flowStep('cashConfirmed', 'cashConfirmedDesc')]
  if (approval) flow.push(flowStep(both ? 'confirmationOrQr' : 'qr', qrDescription))
  else flow.push(flowStep('qrInstant', both ? 'qrInstantDescBoth' : qrDescription))
  flow.push(flowStep('payment', both ? 'paymentDescQr' : 'paymentDesc'))
  return flow
})

// 266:322: the advance and deadline tips show with their fields, and the first tip says
// what "Oba" still leaves to the owner.
const paymentTips = computed(() => {
  const instant = paymentUsesQr.value && !form.requiresApproval
  const tips = [t(instant ? 'listing.paymentTipBothInstant' : 'listing.paymentTipBoth')]
  if (paymentUsesQr.value) tips.push(t('listing.paymentTipAdvance'), t('listing.paymentTipDeadline'))
  tips.push(t('listing.paymentTipCancellation'), t('listing.paymentTipMoney'))
  return tips
})

// Dizajn 25: a year is typed now, within the sixty years the old select offered.
const currentYear = new Date().getFullYear()
const DETAILS_YEAR_MIN = currentYear - 59

// Kategorije spec §5 (Mašine) — an attribute conditioned on a sibling's
// selected option (e.g. "Maksimalna dubina kopanja" only when tip_masine =
// bager) only shows once that option is actually selected; new machine
// types are then just data (a new option + a few dependent attributes), no
// wizard code change needed.
const visibleCategoryAttributes = computed(() => {
  const attrs = listing.value?.category?.attributes || []
  const byKey = new Map(attrs.map((a) => [a.key, a]))
  return attrs.filter((attr) => {
    if (!attr.dependsOnAttrKey) return true
    const parent = byKey.get(attr.dependsOnAttrKey)
    if (!parent) return true
    const selected = attributeValues[parent.id]?.singleOption
    const selectedOption = parent.options?.find((o) => o.id === selected)
    return selectedOption?.key === attr.dependsOnOptionKey
  })
})

// Dizajn 25: step 6 is drawn once per category. 266:343 (Igraonice) came before the other
// eight (545:514 on) and differs from them in details, so Igraonice keeps that look. The
// kind also picks the subtitle, the hints, the tips and the filters caption.
const DETAILS_CATEGORY_KIND = {
  igraonice: 'playroom',
  stanovi: 'apartment',
  'kuce-i-vikendice': 'house',
  sobe: 'room',
  'sale-za-proslave': 'partyHall',
  'konferencijske-sale': 'conferenceRoom',
  'putnicka-vozila': 'car',
  'dostavna-vozila': 'van',
  'gradjevinske-masine': 'machine',
  'magacini-i-skladista': 'warehouse',
}
const detailsKind = computed(() => DETAILS_CATEGORY_KIND[listing.value?.category?.slug] || 'default')
// Both halls sit under Prostori za proslave, whose frame is 545:1557.
const detailsCopyKind = computed(() =>
  detailsKind.value === 'partyHall' || detailsKind.value === 'conferenceRoom' ? 'eventSpace' : detailsKind.value,
)
const detailsPlayroomLook = computed(() => detailsKind.value === 'playroom')
const detailsCheckIcon = computed(() =>
  detailsPlayroomLook.value ? '/images/icons/check-white-18.svg' : '/images/icons/check-small.svg',
)

// The frames stack up to three short fields a row, then the single choices (607:731), then
// the groups to check (605:555). Each part keeps the category's own order.
const DETAILS_SHORT_TYPES = ['NUMBER', 'YEAR', 'TEXT', 'LIST']
// 269:299: Igraonice's age brackets are pills rather than tiles.
const DETAILS_PILL_GROUP_KEYS = ['uzrast_dece']
const detailsBlocks = computed(() => {
  const attrs = visibleCategoryAttributes.value
  const short = attrs.filter((attr) => DETAILS_SHORT_TYPES.includes(attr.type))
  const blocks = []
  for (let i = 0; i < short.length; i += 3) blocks.push({ key: short[i].id, type: 'row', fields: short.slice(i, i + 3) })
  for (const attr of attrs.filter((a) => a.type === 'TEXTAREA')) blocks.push({ key: attr.id, type: 'textarea', attr })
  for (const attr of attrs.filter((a) => a.type === 'BOOLEAN' || DETAILS_PILL_GROUP_KEYS.includes(a.key))) {
    blocks.push({ key: attr.id, type: 'pills', attr })
  }
  for (const attr of attrs) {
    const group = attr.type === 'CHECKBOX_GROUP' || attr.type === 'MULTISELECT'
    if (group && !DETAILS_PILL_GROUP_KEYS.includes(attr.key)) blocks.push({ key: attr.id, type: 'tiles', attr })
  }
  return blocks
})

// 605:520: the unit inside a number field. The frames decline the counts with the value;
// people in a stay, guests in a hall.
const DETAILS_COUNT_UNITS = { kapacitet_dece: 'children', broj_soba: 'rooms', broj_kreveta: 'beds', broj_kupatila: 'bathrooms' }
function detailsUnit(attr) {
  if (attr.type !== 'NUMBER') return ''
  const unit =
    attr.key === 'kapacitet_ljudi' ? (detailsCopyKind.value === 'eventSpace' ? 'guests' : 'people') : DETAILS_COUNT_UNITS[attr.key]
  if (!unit) return attr.unit || ''
  return t(`listing.detailsUnit.${unit}${srPluralCategory(attributeValues[attr.id]?.valueNumber ?? 0)}`)
}

// 605:902, 605:827: the two hints the frames put under a field.
const DETAILS_FIELD_HINTS = { eventSpace: { kapacitet_ljudi: 'seating' }, room: { kupatilo: 'bathroom' } }
function detailsHint(attr) {
  const hint = DETAILS_FIELD_HINTS[detailsCopyKind.value]?.[attr.key]
  return hint ? t(`listing.detailsHint.${hint}`) : ''
}

// 605:557: Sadržaji reads "Opremljenost", as on the listing page. Oprema and Priključci
// keep their names (607:765, 607:799).
function detailsGroupLabel(attr) {
  return attr.key === 'sadrzaji' ? t('listing.amenities') : attr.name
}

// What a number, year or text field shows. A number keeps what is being typed, "58." too.
const detailsText = reactive({})
function detailsInputText(attr) {
  return attr.type === 'TEXT' ? attributeValues[attr.id].valueText : (detailsText[attr.id] ?? '')
}

// Digits and one decimal point, a comma counting as one, with the caret kept after the
// character it followed. Returns the number, or null once emptied.
function applyDecimalInput(event, maxLength = 9) {
  const input = event.target
  const clean = (text) => text.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const caretText = clean(input.value.slice(0, input.selectionStart ?? input.value.length))
  let text = clean(input.value)
  const point = text.indexOf('.')
  if (point !== -1) text = text.slice(0, point + 1) + text.slice(point + 1).replace(/\./g, '')
  text = text.slice(0, maxLength)
  if (input.value !== text) {
    input.value = text
    const caret = Math.min(text.length, caretText.length)
    input.setSelectionRange(caret, caret)
  }
  return text === '' || text === '.' ? null : Number(text)
}

function onDetailsInput(attr, event) {
  detailsErrors[attr.id] = ''
  if (attr.type === 'TEXT') {
    attributeValues[attr.id].valueText = event.target.value
    return
  }
  attributeValues[attr.id].valueNumber = attr.type === 'YEAR' ? applyIntegerInput(event, 4) : applyDecimalInput(event)
  detailsText[attr.id] = event.target.value
}

// A press on the box around the text puts the caret at the end of the field.
function focusDetailsInput(event) {
  const input = event.currentTarget.querySelector('input')
  if (!input || event.target === input) return
  event.preventDefault()
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}

// Dizajn 6 errors under a required field left empty and under a year outside the sixty
// the old select offered. Focuses the first field that needs attention.
const detailsErrors = reactive({})
function validateDetails() {
  let first = null
  for (const attr of visibleCategoryAttributes.value) {
    const value = attributeValues[attr.id]
    const yearOutOfRange =
      attr.type === 'YEAR' && value.valueNumber !== null && (value.valueNumber < DETAILS_YEAR_MIN || value.valueNumber > currentYear)
    let message = ''
    if (attr.required && !isAttributeValueFilled(attr, value)) message = t('validation.required')
    else if (yearOutOfRange) message = t('listing.detailsYearRange', { min: DETAILS_YEAR_MIN, max: currentYear })
    detailsErrors[attr.id] = message
    if (message && !first) first = attr
  }
  if (first) document.getElementById(`details-${first.id}`)?.focus()
  return !first
}

// What the listing page will read once the step saves: only the value that matches the
// attribute's type, and nothing for a field left empty (ListingsService.upsertAttributes).
const detailsPreviewAttributes = computed(() =>
  visibleCategoryAttributes.value.map((attr) => {
    const v = attributeValues[attr.id]
    if (!v || !isAttributeValueFilled(attr, v)) return { ...attr, value: null }
    if (attr.type === 'NUMBER' || attr.type === 'YEAR') return { ...attr, value: { valueNumber: v.valueNumber } }
    if (attr.type === 'TEXT' || attr.type === 'TEXTAREA') return { ...attr, value: { valueText: v.valueText } }
    if (attr.type === 'BOOLEAN') return { ...attr, value: { valueBoolean: v.valueBoolean } }
    return { ...attr, value: { valueOptionIds: attr.type === 'LIST' ? [v.singleOption] : v.valueOptionIds } }
  }),
)

// 545:674: the rows of ListingPublicView's Detalji section, then the frame's count of the
// Opremljenost items.
const detailsPreviewRows = computed(() => {
  const rows = getDetailAttributes(detailsPreviewAttributes.value, t).map((attr) => ({
    key: attr.id,
    label: attr.name,
    value: formatAttributeValue(attr, t),
  }))
  const amenities = getAmenityItems(detailsPreviewAttributes.value).length
  if (amenities) {
    rows.push({
      key: 'amenities',
      label: t('listing.amenities'),
      value: t(`listing.detailsPreviewItems${srPluralCategory(amenities)}`, { count: amenities }),
    })
  }
  return rows
})

// 545:686: the filters the search panel really has for this category, in its order:
// ranges, single choices, switches, then the groups to check. The eight newer frames
// start with the price.
const detailsFilterChips = computed(() => {
  const rank = (attr) =>
    attr.filterType === 'RANGE' ? 0 : attr.filterType === 'TOGGLE' ? 2 : attr.type === 'CHECKBOX_GROUP' ? 3 : 1
  const labels = (listing.value?.category?.attributes || [])
    .filter((attr) => attr.isFilter && (attr.filterType === 'RANGE' || attr.filterType === 'TOGGLE' || attr.options?.length))
    .sort((a, b) => rank(a) - rank(b))
    .map((attr) => getFilterAttributeLabel(attr, t))
  if (!labels.length || detailsPlayroomLook.value) return labels
  return [t('listing.price'), ...labels]
})

// 545:685
const detailsFiltersCaption = computed(() =>
  detailsKind.value === 'default'
    ? t('listing.detailsFiltersCaptionDefault')
    : t('listing.detailsFiltersCaption', { category: t(`listing.detailsFiltersCategory.${detailsKind.value}`) }),
)

// 545:698: five tips a category, three for a category added later.
const detailsTips = computed(() => {
  const kind = detailsCopyKind.value
  return Array.from({ length: kind === 'default' ? 3 : 5 }, (_, i) =>
    t(`listing.detailsTips.${kind}.tip${i + 1}`, { step: t('listing.stepRules') }),
  )
})

const location = reactive({ regionId: '', cityId: '', cityAreaId: '', address: '', latitude: null, longitude: null, googlePlaceId: '' })

async function previewLocationOnMap() {
  const city = cities.value.find((c) => c.id === location.cityId)
  if (!location.address?.trim() || !city) return
  try {
    const coords = await api.get(`/geocoding/preview?address=${encodeURIComponent(location.address)}&city=${encodeURIComponent(city.name)}`)
    if (coords) {
      location.latitude = coords.latitude
      location.longitude = coords.longitude
    }
  } catch {
    // Preview is a convenience, not a required step — the final save still
    // auto-geocodes server-side if no pin was ever placed.
  }
}

function onPinDragged({ latitude, longitude }) {
  location.latitude = latitude
  location.longitude = longitude
}
const attributeValues = reactive({})
const hasBankAccount = computed(() => !!auth.user?.bankAccount)

const citiesInRegion = computed(() => cities.value.filter((c) => c.regionId === location.regionId))

// Dizajn 19: every wizard frame is drawn for Igraonice, a slot category, so the
// frames' subtitles for the pricing, availability and rules steps talk about
// time slots. Stay listings keep the general wording on those three steps.
const stepSubtitle = computed(() => {
  const step = steps.value[currentStep.value]
  if (step.key === 'pricing' && listing.value?.category?.defaultBookingModel === 'PER_SLOT') {
    return t('listing.stepPricingDescSlot')
  }
  if (step.key === 'availability' && form.bookingModel === 'PER_SLOT') {
    return t(form.slotSubmode === 'DEFINED_SLOTS' ? 'listing.stepAvailabilityDescDefinedSlots' : 'listing.stepAvailabilityDescWorkingHours')
  }
  if (step.key === 'rules' && form.bookingModel === 'PER_SLOT') return t('listing.stepRulesDescSlot')
  // Dizajn 25: each category's frame words step 6 for that category.
  if (step.key === 'attributes' && detailsCopyKind.value !== 'default') {
    return t(`listing.stepAttributesDescCategory.${detailsCopyKind.value}`)
  }
  return t(step.descKey)
})

const categoryIconMarkup = computed(() => getWizardPillCategoryIconMarkup(listing.value?.category?.slug))

// Dizajn 20: 228:316 is drawn for Igraonice. Its second tip names what guests
// look for first, so each category the wizard knows gets its own version, and a
// category added later from the admin panel gets a general one.
const FIRST_PARAGRAPH_TIP = {
  igraonice: 'playroom',
  stanovi: 'apartment',
  'kuce-i-vikendice': 'apartment',
  sobe: 'room',
  'sale-za-proslave': 'eventSpace',
  'konferencijske-sale': 'eventSpace',
  'putnicka-vozila': 'car',
  'dostavna-vozila': 'van',
  'gradjevinske-masine': 'machine',
  'magacini-i-skladista': 'warehouse',
}
const basicsTips = computed(() => [
  t('listing.basicsTipLocation'),
  t(`listing.basicsTipFirstParagraph.${FIRST_PARAGRAPH_TIP[listing.value?.category?.slug] || 'default'}`),
  t('listing.basicsTipCaps'),
  t('listing.basicsTipPhone'),
  t('listing.basicsTipVideo'),
])

const videoUrlRecognized = computed(() => !!getYoutubeVideoId(form.videoUrl))

// The link is optional, but a filled-in one has to be a video ListingGallery can play.
function checkVideoUrl() {
  basicsErrors.videoUrl = form.videoUrl?.trim() && !videoUrlRecognized.value ? t('listing.videoUrlInvalid') : ''
}

function requiredTextError(value, maxLength) {
  if (!value?.trim()) return t('validation.required')
  if (value.length > maxLength) return t('validation.maxLength', { max: maxLength })
  return ''
}

// Title and description stay required, now within Dizajn 20's limits. Focuses
// the first field that needs attention.
function validateBasics() {
  basicsErrors.title = requiredTextError(form.title, TITLE_MAX_LENGTH)
  basicsErrors.description = requiredTextError(form.description, DESCRIPTION_MAX_LENGTH)
  checkVideoUrl()
  const fieldIds = { title: 'basics-title', description: 'basics-description', videoUrl: 'basics-video' }
  const firstInvalid = Object.keys(fieldIds).find((field) => basicsErrors[field])
  if (firstInvalid) document.getElementById(fieldIds[firstInvalid])?.focus()
  return !firstInvalid
}

// Dizajn 21: the price shows its error under its own row, like step 1's fields.
function validatePricing() {
  pricingErrors.price = showFlatPriceFields.value && !(Number(form.price) > 0) ? t('listing.validationPriceRequired') : ''
  if (pricingErrors.price) document.getElementById('pricing-price')?.focus()
  return !pricingErrors.price
}

// Dizajn 23: Dizajn 6 errors under the field, or under the row for a minimum above
// its maximum, which would turn every request away.
const rulesErrors = reactive({
  minDuration: '',
  maxDuration: '',
  maxAdvanceBookingDays: '',
  minGuests: '',
  maxGuests: '',
  duration: '',
  guests: '',
})

// utils/integerInput.js keeps whole numbers only; an emptied field is null.
function onRulesInput(event, field) {
  form[field] = applyIntegerInput(event)
  rulesErrors[field] = ''
  if (field === 'minDuration' || field === 'maxDuration') rulesErrors.duration = ''
  if (field === 'minGuests' || field === 'maxGuests') rulesErrors.guests = ''
}

// The rules this listing uses. The others stay hidden and are cleared on save.
const rulesFieldsShown = computed(() => ({
  minDuration: !isDefinedSlotsModel.value,
  maxDuration: !isDefinedSlotsModel.value,
  earliestBookingHours: true,
  maxAdvanceBookingDays: true,
  minGuests: showGuestCount.value,
  maxGuests: showGuestCount.value,
  gapAfterMinutes: showGapAfter.value,
  pickupTime: showVehicleTimes.value,
  returnTime: showVehicleTimes.value,
}))

// UpdateListingDto takes 0 only for the notice and the gap. Focuses the first field
// that needs attention.
function validateRules() {
  const shown = rulesFieldsShown.value
  for (const field of ['minDuration', 'maxDuration', 'maxAdvanceBookingDays', 'minGuests', 'maxGuests']) {
    rulesErrors[field] = shown[field] && form[field] === 0 ? t('listing.rulesValuePositive') : ''
  }
  const aboveMax = (min, max) => shown[min] && form[min] > 0 && form[max] > 0 && form[min] > form[max]
  rulesErrors.duration = aboveMax('minDuration', 'maxDuration') ? t('listing.rulesDurationMaxBelowMin') : ''
  rulesErrors.guests = aboveMax('minGuests', 'maxGuests') ? t('listing.rulesGuestsMaxBelowMin') : ''
  const order = [['minDuration'], ['maxDuration', 'duration'], ['maxAdvanceBookingDays'], ['minGuests'], ['maxGuests', 'guests']]
  const first = order.find((keys) => keys.some((key) => rulesErrors[key]))
  if (first) document.getElementById(`rules-${first[0]}`)?.focus()
  return !first
}

// Every rule goes out, null when emptied or hidden, so that rule stops applying.
function rulesPayload() {
  return Object.fromEntries(
    Object.entries(rulesFieldsShown.value).map(([field, shown]) => {
      const value = form[field]
      return [field, shown && value !== '' && value !== null && value !== undefined ? value : null]
    }),
  )
}

// Dizajn 24: Dizajn 6 errors under the advance and the deadline, in UpdateListingDto's
// ranges, and beside the number a free cancellation needs.
const paymentErrors = reactive({ advancePercent: '', paymentDeadlineHours: '', cancellationThreshold: '' })
const FREE_CANCELLATION_POLICIES = ['FREE_UNTIL_DAYS', 'FREE_UNTIL_HOURS']

function onPaymentInput(event, field, maxDigits) {
  form[field] = applyIntegerInput(event, maxDigits)
  paymentErrors[field] = ''
}

// Focuses the first field that needs attention.
function validatePayment() {
  const outside = (value, min, max) => value !== null && value !== undefined && (value < min || value > max)
  const qr = paymentUsesQr.value
  paymentErrors.advancePercent = qr && outside(form.advancePercent, 1, 100) ? t('listing.advancePercentRange') : ''
  paymentErrors.paymentDeadlineHours =
    qr && outside(form.paymentDeadlineHours, 12, 168) ? t('listing.paymentDeadlineHoursRange') : ''
  const threshold = form.cancellationThreshold
  let thresholdError = ''
  if (FREE_CANCELLATION_POLICIES.includes(form.cancellationPolicyType)) {
    if (threshold === null || threshold === undefined) thresholdError = t('validation.required')
    else if (threshold < 1) thresholdError = t('listing.rulesValuePositive')
  }
  paymentErrors.cancellationThreshold = thresholdError
  const fieldIds = {
    advancePercent: 'payment-advancePercent',
    paymentDeadlineHours: 'payment-paymentDeadlineHours',
    cancellationThreshold: 'payment-threshold',
  }
  const first = Object.keys(fieldIds).find((field) => paymentErrors[field])
  if (first) document.getElementById(fieldIds[first])?.focus()
  return !first
}

// The step sends its own fields, with null for what the choice doesn't use: an emptied
// advance is the full amount again, and an old number of days doesn't stay behind.
function paymentPayload() {
  const qr = paymentUsesQr.value
  const threshold = FREE_CANCELLATION_POLICIES.includes(form.cancellationPolicyType) ? form.cancellationThreshold : null
  return {
    paymentMethod: form.paymentMethod,
    requiresApproval: qr ? form.requiresApproval : true,
    advancePercent: qr ? (form.advancePercent ?? null) : null,
    paymentDeadlineHours: qr ? (form.paymentDeadlineHours ?? null) : null,
    cancellationPolicyType: form.cancellationPolicyType || null,
    cancellationThreshold: threshold ?? null,
  }
}

// RNT-028 — "send QR code instantly" only makes sense for bank-transfer
// payment (the QR *is* the bank-transfer payment slip); a cash-only listing
// switching to it left a request auto-confirmed with no actual payment
// instructions ever sent.
function onPaymentMethodChange() {
  if (form.paymentMethod === 'CASH') form.requiresApproval = true
  paymentErrors.advancePercent = ''
  paymentErrors.paymentDeadlineHours = ''
}

function unitLabel(unit) {
  return unit.charAt(0) + unit.slice(1).toLowerCase()
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null))
}

function isAttributeValueFilled(attr, v) {
  if (attr.type === 'NUMBER' || attr.type === 'YEAR') return v.valueNumber !== null && v.valueNumber !== undefined && v.valueNumber !== ''
  if (attr.type === 'TEXT' || attr.type === 'TEXTAREA') return !!v.valueText
  if (attr.type === 'BOOLEAN') return true // false is a real answer, not an empty one
  if (attr.type === 'LIST') return !!v.singleOption
  return (v.valueOptionIds || []).length > 0 // MULTISELECT / CHECKBOX_GROUP
}

// RNT-022/023 — the wizard used to save-and-advance on every step no matter
// what was in it (or wasn't), only surfacing missing required fields as a
// checklist on the very last step. Blocking here catches it right where the
// owner can actually fix it.
function validateCurrentStep() {
  const step = steps.value[currentStep.value].key
  if (step === 'location') {
    if (!location.regionId || !location.cityId || !location.address?.trim()) return t('listing.validationLocationRequired')
  } else if (step === 'photos') {
    if (!photos.value.length) return t('listing.validationPhotosRequired')
  } else if (step === 'availability') {
    // T26 — the "*" on Cena (RSD) inside the defined-slots editor did
    // nothing on its own; the wizard let the owner reach step 4 with zero
    // slots defined, publishing a "bookable" listing with nothing to book.
    if (
      form.bookingModel === 'PER_SLOT' &&
      form.slotSubmode === 'DEFINED_SLOTS' &&
      !definedSlotsEditorRef.value?.slots?.length
    ) {
      return t('listing.validationSlotsRequired')
    }
  }
  return ''
}

async function loadListing() {
  listing.value = await api.get(`/listings/${listingId}`)

  // /listings/:id returns the raw category row (no resolved/inherited
  // attributes — that's TaxonomyService's job); fetch the definitions
  // separately and merge in this listing's already-saved values by id.
  if (listing.value.category?.slug) {
    const categoryDetail = await api.get(`/categories/${listing.value.category.slug}`)
    const valueByAttributeId = new Map((listing.value.attributes || []).map((v) => [v.attributeId, v]))
    listing.value.category.name = categoryDetail.name
    listing.value.category.attributes = categoryDetail.attributes.map((attr) => ({
      ...attr,
      value: valueByAttributeId.get(attr.id) || null,
    }))
  }

  Object.assign(form, {
    bookingModel: listing.value.bookingModel,
    slotSubmode: listing.value.slotSubmode,
    title: listing.value.title,
    description: listing.value.description,
    videoUrl: listing.value.videoUrl || '',
    priceUnit: listing.value.priceUnit,
    price: listing.value.price || 0,
    weekendPrice: listing.value.weekendPrice ? Number(listing.value.weekendPrice) : null,
    paymentMethod: listing.value.paymentMethod || 'CASH',
    requiresApproval: listing.value.requiresApproval ?? true,
    advancePercent: listing.value.advancePercent ?? null,
    // Dizajn 24: an emptied deadline is saved as null, which the field shows as a grey 48.
    paymentDeadlineHours: listing.value.paymentDeadlineHours ?? null,
    minDuration: listing.value.minDuration,
    maxDuration: listing.value.maxDuration,
    minGuests: listing.value.minGuests,
    maxGuests: listing.value.maxGuests,
    gapAfterMinutes: listing.value.gapAfterMinutes,
    pickupTime: listing.value.pickupTime || '',
    returnTime: listing.value.returnTime || '',
    earliestBookingHours: listing.value.earliestBookingHours,
    maxAdvanceBookingDays: listing.value.maxAdvanceBookingDays,
    cancellationPolicyType: listing.value.cancellationPolicyType || null,
    cancellationThreshold: listing.value.cancellationThreshold,
  })
  bookingChoice.value = listing.value.bookingModel === 'NO_BOOKING' ? 'NONE' : 'ONLINE'
  // The bookingChoice watcher only fires on an actual toggle — a freshly
  // created PER_SLOT draft loads with slotSubmode still null (never set at
  // creation) and bookingChoice starting at its already-'ONLINE' default,
  // so nothing would otherwise pick WORKING_HOURS as the default submode.
  if (form.bookingModel === 'PER_SLOT' && !form.slotSubmode) form.slotSubmode = 'WORKING_HOURS'
  Object.assign(location, {
    regionId: listing.value.regionId || '',
    cityId: listing.value.cityId || '',
    cityAreaId: listing.value.cityAreaId || '',
    address: listing.value.address || '',
    latitude: listing.value.latitude !== null && listing.value.latitude !== undefined ? Number(listing.value.latitude) : null,
    longitude: listing.value.longitude !== null && listing.value.longitude !== undefined ? Number(listing.value.longitude) : null,
    googlePlaceId: listing.value.googlePlaceId || '',
  })
  photos.value = listing.value.photos || []

  for (const attr of listing.value.category?.attributes || []) {
    // valueNumber is a Decimal column, so it arrives as a string.
    const valueNumber = attr.value?.valueNumber ?? null
    detailsText[attr.id] = valueNumber === null ? '' : String(Number(valueNumber))
    attributeValues[attr.id] = {
      valueNumber: valueNumber === null ? null : Number(valueNumber),
      valueText: attr.value?.valueText ?? '',
      valueBoolean: attr.value?.valueBoolean ?? false,
      valueOptionIds: attr.value?.valueOptionIds ?? [],
      singleOption: attr.value?.valueOptionIds?.[0] ?? '',
    }
  }

  // RNT-032/T108 — loadListing() only ever runs once, in onMounted; a
  // returning user opening this URL directly used to always land back on
  // step 1 even though every earlier step was already saved. Resume from the
  // server-persisted wizardStep (set as the owner actually advances through
  // saveCurrentStep) rather than guessing progress from which fields happen
  // to be non-empty — availability/rules/payment/attributes are all-optional
  // steps whose fields already exist with defaults long before the owner
  // ever opens them, so "field is set" can't tell "visited" from "never
  // opened this step" (T108: that false-positive made every draft resume at
  // Location regardless of how far the owner had actually gotten).
  const resumeStep = Math.min(listing.value.wizardStep || 0, steps.value.length - 1)
  currentStep.value = resumeStep
  maxStepReached.value = Math.max(maxStepReached.value, resumeStep)
}

async function onRegionChange() {
  location.cityId = ''
  location.cityAreaId = ''
  cityAreas.value = []
}

async function onCityChange() {
  location.cityAreaId = ''
  const city = cities.value.find((c) => c.id === location.cityId)
  cityAreas.value = city ? await api.get(`/locations/cities/${city.slug}/areas`) : []
}

// R160 — a phone photo can be several MB; shrinking it in the browser first
// (matching the server's own 1920px cap in UploadsService.saveImage) means a
// twenty-photo listing doesn't choke slow mobile uploads. Falls back to the
// original file untouched for anything that isn't a decodable raster image.
const DOWNSCALE_MAX_DIMENSION = 1920
const DOWNSCALE_QUALITY = 0.85

async function downscaleImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, DOWNSCALE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1) {
      bitmap.close?.()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_QUALITY))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    // Decoding failed (corrupt file, unsupported format) — let the backend's
    // own validation reject it with a proper error rather than failing silently here.
    return file
  }
}

async function uploadFile(rawFile) {
  const file = await downscaleImage(rawFile)
  const formData = new FormData()
  formData.append('file', file)
  const photo = await api.post(`/listings/${listingId}/photos`, formData)
  photos.value.push(photo)
}

async function onFileInputChange(evt) {
  const files = Array.from(evt.target.files || [])
  evt.target.value = ''
  for (const file of files) await uploadFile(file)
}

async function onDropFiles(evt) {
  dropzoneActive.value = false
  const files = Array.from(evt.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'))
  for (const file of files) await uploadFile(file)
}

async function removePhoto(photoId) {
  await api.delete(`/listings/${listingId}/photos/${photoId}`)
  photos.value = photos.value.filter((p) => p.id !== photoId)
}

async function persistPhotoOrder() {
  await api.patch(`/listings/${listingId}/photos/reorder`, { photoIds: photos.value.map((p) => p.id) })
}

function onPhotoDragStart(index) {
  draggedPhotoIndex.value = index
}

function onPhotoDrop(targetIndex) {
  if (draggedPhotoIndex.value === null || draggedPhotoIndex.value === targetIndex) return
  const arr = [...photos.value]
  const [moved] = arr.splice(draggedPhotoIndex.value, 1)
  arr.splice(targetIndex, 0, moved)
  photos.value = arr
  draggedPhotoIndex.value = null
  persistPhotoOrder()
}

function setCoverPhoto(index) {
  if (index === 0) return
  const arr = [...photos.value]
  const [moved] = arr.splice(index, 1)
  arr.unshift(moved)
  photos.value = arr
  persistPhotoOrder()
}

async function saveCurrentStep() {
  error.value = ''
  if (steps.value[currentStep.value].key === 'basics' && !validateBasics()) return
  if (steps.value[currentStep.value].key === 'pricing' && !validatePricing()) return
  if (steps.value[currentStep.value].key === 'rules' && !validateRules()) return
  if (steps.value[currentStep.value].key === 'payment' && !validatePayment()) return
  if (steps.value[currentStep.value].key === 'attributes' && !validateDetails()) return
  const validationError = validateCurrentStep()
  if (validationError) {
    error.value = validationError
    return
  }
  saving.value = true
  try {
    const step = steps.value[currentStep.value].key
    if (step === 'attributes') {
      // Dizajn 25: a field hidden by another field's choice (a machine type's own fields)
      // goes out empty, so the listing page stops showing what was filled in for another type.
      const visibleIds = new Set(visibleCategoryAttributes.value.map((attr) => attr.id))
      const values = Object.entries(attributeValues).map(([attributeId, v]) =>
        visibleIds.has(attributeId)
          ? {
              attributeId,
              valueNumber: v.valueNumber,
              valueText: v.valueText,
              valueBoolean: v.valueBoolean,
              valueOptionIds: v.singleOption ? [v.singleOption] : v.valueOptionIds,
            }
          : { attributeId, valueNumber: null, valueText: '', valueBoolean: null, valueOptionIds: [] },
      )
      await api.post(`/listings/${listingId}/attributes`, { values })
      // The step forgets them too.
      for (const [attributeId, v] of Object.entries(attributeValues)) {
        if (visibleIds.has(attributeId)) continue
        Object.assign(v, { valueNumber: null, valueText: '', valueBoolean: false, valueOptionIds: [], singleOption: '' })
        detailsText[attributeId] = ''
      }
    } else if (step === 'location') {
      await api.patch(`/listings/${listingId}/location`, {
        ...location,
        cityAreaId: location.cityAreaId || undefined,
        latitude: location.latitude ?? undefined,
        longitude: location.longitude ?? undefined,
      })
    } else if (step === 'availability') {
      // T72 — the calendar and defined-slots components already persist each
      // interaction immediately; only WorkingHoursEditor batches edits behind
      // its own button, so the main CTA has to trigger that explicitly or a
      // changed working-hours/day/price-range value is silently dropped.
      if (form.bookingModel === 'PER_SLOT' && form.slotSubmode === 'WORKING_HOURS' && workingHoursEditorRef.value) {
        // Dizajn 22: false means a required field is empty, and the editor says which.
        if ((await workingHoursEditorRef.value.save()) === false) return
      }
    } else if (step === 'rules') {
      const payload = rulesPayload()
      await api.patch(`/listings/${listingId}`, payload)
      // Later steps send the whole form, so it forgets the cleared rules too.
      Object.assign(form, payload, { pickupTime: payload.pickupTime || '', returnTime: payload.returnTime || '' })
    } else if (step === 'payment') {
      const payload = paymentPayload()
      await api.patch(`/listings/${listingId}`, payload)
      // Same as the rules: the form forgets what the step cleared.
      Object.assign(form, payload)
    } else if (step === 'photos' || step === 'review') {
      // photos: persisted per-upload/reorder already.
      // review: nothing to save — navigation handled by the link itself.
    } else {
      // Backend DTOs treat a field as "not provided" only when it's
      // undefined — an empty string still fails e.g. @IsUrl()/@Matches() on
      // an optional field. Strip empty strings here rather than loosening
      // those validators, so a real empty submission is still caught
      // elsewhere.
      const payload = compact(form)
      // compact() drops an emptied video field, which used to leave the old link
      // on the listing; null is what clears it.
      if (step === 'basics') payload.videoUrl = form.videoUrl.trim() || null
      // An emptied weekend price is null, which compact() drops too.
      if (step === 'pricing' && showWeekendPrice.value) payload.weekendPrice = form.weekendPrice ?? null
      await api.patch(`/listings/${listingId}`, payload)
    }

    if (currentStep.value < steps.value.length - 1) {
      currentStep.value++
      if (currentStep.value > maxStepReached.value) {
        maxStepReached.value = currentStep.value
        // T108 — persist real progress so a returning visit resumes here
        // instead of guessing from which fields happen to be non-empty
        // (best-effort: losing this write just means the next successful
        // step save catches it back up, not worth blocking on).
        api.patch(`/listings/${listingId}`, { wizardStep: maxStepReached.value }).catch(() => {})
        if (listing.value) listing.value.wizardStep = maxStepReached.value
      }
    }
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

// T41 — this listing already has a package attached (subscriptionId set), so
// there's nothing left to buy. Every step already persisted via
// saveCurrentStep as the owner went, so finishing is pure confirmation.
async function finishEditing() {
  await navigateTo('/kontrolna-tabla/oglasi?updated=1')
}

// T42 — attach this brand-new listing to the owner's existing PRO
// subscription's free slot instead of sending them through package
// purchase; mirrors kontrolna-tabla/pretplate.vue's attachFree().
async function publishWithFreeSlot() {
  error.value = ''
  finishing.value = true
  try {
    await api.post('/subscriptions/purchase', {
      listingId,
      existingSubscriptionId: freeSlotSubscription.value.id,
    })
    await navigateTo(`/oglasi/${listingId}/poslato`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    finishing.value = false
  }
}

onMounted(async () => {
  ;[regions.value, cities.value] = await Promise.all([api.get('/locations/regions'), api.get('/locations/cities')])
  api.get('/subscriptions/mine').then((subs) => { mySubscriptions.value = subs }).catch(() => {})
  await loadListing()
  if (location.cityId) {
    const city = cities.value.find((c) => c.id === location.cityId)
    if (city) cityAreas.value = await api.get(`/locations/cities/${city.slug}/areas`)
  }
})

// T98 — this wizard is reused for editing an already-published listing too
// (novi.vue just creates a DRAFT and drops the owner here), but it always
// said "Dodaj oglas" ("Add listing") even when the listing was long since
// live. Anything past DRAFT means they're editing, not adding.
const wizardTitle = computed(() =>
  listing.value?.status && listing.value.status !== 'DRAFT' ? t('listing.wizardEditTitle') : t('listing.wizardTitle'),
)
useSeoMeta({ title: () => wizardTitle.value })
</script>

<style lang="scss" scoped>
// Dizajn 19: every value in the shell is read off frame 185:287 (Content
// 228:287 and Wizard akcije 228:376). The step bodies keep their own styles
// until their own tickets.

// 44 under the header, and 228:376 ends 40 above the footer. One grid for the
// whole shell gives the form the frame's 760 column beside the 400 aside
// (228:314) without another wrapper around the step bodies.
.wizard {
  display: grid;
  grid-template-columns: minmax(0, 760fr) minmax(0, 400fr);
  column-gap: 56px;
  align-items: start;
  padding-top: 44px;
  padding-bottom: 40px;
}

.wizard > * {
  grid-column: 1 / -1;
}

.wizard > .wizard-form {
  grid-column: 1;
}

// Dizajn 20 and 21: step 1's tips (228:316) and step 2's aside (231:380) sit in the form's row.
.wizard > .wizard-tips,
.wizard > .wizard-aside {
  grid-column: 2;
}

// 228:288
.wizard-progress {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 34px;
}

.wizard-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.wizard-step-of {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: $color-text-muted;
}

// 228:291
.wizard-autosave {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
}

.wizard-autosave img {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

// 228:296: 4px bars, 6 apart. Every step up to the current one carries the
// gradient (231:326, 285:374), the rest are grey. The ::after only makes the
// thin bar easier to hit.
.wizard-segments {
  display: flex;
  gap: 6px;
}

.wizard-segment {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: $radius-pill;
  background: $color-border;
  cursor: pointer;
}

.wizard-segment::after {
  content: '';
  position: absolute;
  inset: -6px 0;
}

.wizard-segment.is-filled {
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
}

.wizard-segment:disabled {
  cursor: default;
}

// 228:306: the row keeps its height while the listing loads, so the title
// doesn't jump.
.wizard-category {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  min-height: 68px;
  padding-bottom: 28px;
}

// 228:307
.wizard-category-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 18px 0 14px;
  border-radius: $radius-pill;
  background: $color-background;
  color: $color-text;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.wizard-category-icon {
  display: flex;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.wizard-category-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

// 228:310
.wizard-category-change {
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  text-decoration: none;
  white-space: nowrap;
}

.wizard-category-change:hover {
  color: $color-primary;
  text-decoration: underline;
}

// 228:311
.wizard-head {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 38px;
}

.wizard-title {
  margin: 0;
  font-size: 44px;
  font-weight: 400;
  line-height: 50px;
  letter-spacing: -1.54px;
  color: $color-text;
}

// 281:317 draws the photos step's asterisk in blue.
.wizard-title-required {
  color: $color-primary;
}

.wizard-subtitle {
  max-width: 720px;
  margin: 0;
  font-size: 18px;
  line-height: 27px;
  color: $color-text-muted;
}

.wizard-form {
  min-width: 0;
}

// Dizajn 6 error message (214:438), the same as novi.vue's.
.wizard-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 24px 0 0;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

.wizard-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

// Dizajn 20: step 1's body, read off 228:315 (Forma) and 228:316 (Saveti). The
// field states are Dizajn 6's (214:429, 214:436), the same as novi.vue's.
$field-danger-bg: #fcd8e0;
$field-danger-border: #f43f5e;

.basics {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

// 228:317
.basics-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

// 228:318: the asterisk 4 after the label; 228:336 puts "opciono" 7 after it.
.basics-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.basics-required {
  color: $color-primary;
}

.basics-optional {
  margin-left: 3px;
  font-size: 14px;
  font-weight: 400;
  color: $color-text-muted;
}

// 228:321: 56 tall, 18 side padding, no stroke. Focus and error draw their
// 1.5px stroke as an inset shadow so the text never moves.
.basics-input {
  display: block;
  width: 100%;
  height: 56px;
  margin: 0;
  padding: 0 18px;
  border: 0;
  border-radius: $radius-input;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  line-height: normal;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.basics-input::placeholder,
.basics-video-input::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.basics-input:focus,
.basics-video:focus-within {
  outline: none;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.basics-input.is-invalid {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

// 228:330: 200 tall, the text 16 from the top on 25px lines.
.basics-textarea {
  height: 200px;
  padding: 16px 18px;
  line-height: 25px;
  resize: none;
}

// 228:339: the YouTube icon 12 before the link, 228:345 at the right edge.
.basics-video {
  display: flex;
  align-items: center;
  gap: 12px;
}

.basics-video-icon {
  display: block;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.basics-video-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
}

// 228:345
.basics-video-ok {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: #178c24;
  white-space: nowrap;
}

.basics-video-ok img {
  display: block;
  width: 15px;
  height: 15px;
}

// 228:323: Regular 13 on a 19px line, the counter at the right edge.
.basics-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.basics-hint {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  color: $color-text-muted;
}

.basics-count {
  flex-shrink: 0;
  font-size: 13px;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
}

// 214:438, on the hint's 19px line so nothing below moves.
.basics-error {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 7px;
  min-height: 19px;
  margin: 0;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

.basics-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

// 228:351: Figma's stroke sits inside the 24 padding.
.wizard-tips {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 23px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-surface;
}

// 228:352
.wizard-tips-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 228:354
.wizard-tips-info {
  display: flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: $radius-pill;
  background: #f1f4f8;
}

.wizard-tips-info img {
  display: block;
  width: 16px;
  height: 16px;
}

.wizard-tips-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 228:356: the check on the first line, 11 before the text.
.wizard-tips-item {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  font-size: 14px;
  line-height: 21px;
  color: $color-text-muted;
}

.wizard-tips-item img {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

// Dizajn 21: step 2's body, read off 231:345 (Forma) and 231:380 (Saveti). The
// field states are Dizajn 6's again (214:429, 214:436).
.pricing {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

// 249:287, 249:300: the options 12 under the label and 12 apart.
.pricing-choice {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// 249:315, 249:329
.pricing-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

// 249:289: Medium 14, the asterisk blue.
.pricing-label {
  display: block;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.pricing-required {
  color: $color-primary;
}

// 249:332: Light 13, 8 after the label.
.pricing-optional {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

// 249:290: 16/20 padding, the radio 14 before the text. Both strokes are inset
// shadows, so selecting a card never moves its text.
.pricing-option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin: 0;
  padding: 16px 20px;
  border-radius: $radius-input;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

// Hover draws the blue stroke, like novi.vue's option cards (Dizajn 18).
.pricing-option:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
}

// The 1.5 blue stroke and elevation/brand.
.pricing-option.is-selected {
  box-shadow:
    inset 0 0 0 1.5px $color-primary,
    0 4px 12px rgba($color-primary, 0.1);
}

.pricing-option:has(:focus-visible) {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

// 249:291: a 5.5 blue ring when selected, 1.5 grey otherwise.
.pricing-radio {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-border;
  transition: box-shadow 0.15s ease;
}

.pricing-option.is-selected .pricing-radio {
  box-shadow: inset 0 0 0 5.5px $color-primary;
}

// 249:292: 5 between the title and its description.
.pricing-option-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

// 249:293
.pricing-option-title {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 249:294
.pricing-option-desc {
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

// 249:313, and 258:301 on step 4.
.pricing-note,
.rules-note {
  margin: 0;
  padding: 10px 14px;
  border-radius: $radius-input;
  background: $color-accent-tint;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  color: $color-primary;
}

// 249:318: the unit column 220 wide, 16 after the field.
.pricing-price-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

// 249:319: 51 tall, 20 side padding, no stroke, "RSD" at the right edge. Focus
// and error draw their 1.5 stroke inside, as on step 1.
.pricing-input {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  height: 51px;
  padding: 0 20px;
  border-radius: $radius-input;
  background-color: $color-background;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.pricing-price-row .pricing-input {
  flex: 1 1 auto;
}

.pricing-input:focus-within {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.pricing-input.is-invalid {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

.pricing-input-control {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
}

.pricing-input-control::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

// 249:321
.pricing-input-currency {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text-muted;
}

// 249:322: the label 6 above the select.
.pricing-unit {
  display: flex;
  flex: 0 0 220px;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

// 249:323
.pricing-unit-label {
  display: block;
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

// 249:324: 46 tall, the value 16 in, the chevron 14 from the right edge.
.pricing-select {
  position: relative;
}

.pricing-select-alone {
  width: 220px;
  max-width: 100%;
}

.pricing-select-control {
  display: block;
  width: 100%;
  height: 46px;
  margin: 0;
  padding: 0 38px 0 16px;
  border: 0;
  border-radius: $radius-input;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  appearance: none;
  cursor: pointer;
}

.pricing-select-control:focus-visible {
  outline: none;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

// A unit the category fixes (the frame's "sat" for Igraonice) still reads like 249:324.
.pricing-select-control:disabled {
  opacity: 1;
  color: $color-text;
  cursor: default;
}

.pricing-select-chevron {
  position: absolute;
  top: 15px;
  right: 14px;
  width: 16px;
  height: 16px;
  pointer-events: none;
}

// 249:328: Light 12.
.pricing-hint {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 249:336 runs on 18px lines.
.pricing-hint-weekend {
  line-height: 18px;
}

// 249:337: the info icon 8 after the text.
.pricing-suggestion {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.pricing-suggestion img {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

// 214:438, in the hint's place.
.pricing-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-error;
}

.pricing-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

// 231:380: the two cards 24 apart.
.wizard-aside {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

// 237:295, 237:308: Figma's stroke sits inside the 22/24 padding.
.wizard-aside-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 21px 23px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-surface;
}

// 237:296
.wizard-aside-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.wizard-aside-title img {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

// 237:307
.wizard-aside-caption {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 237:313
.wizard-aside-tips {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 237:314: the check on the first line, 10 before the text.
.wizard-aside-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

.wizard-aside-tip img {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

// 237:300
.pricing-preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: $radius-input;
  background: $color-background;
}

// 237:301: the amount and its unit on one baseline, 6 apart.
.pricing-preview-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin: 0;
}

// 237:302
.pricing-preview-amount {
  font-size: 22px;
  font-weight: 600;
  line-height: normal;
  letter-spacing: -0.4px;
  color: $color-text;
}

// 237:303
.pricing-preview-unit {
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text-muted;
}

// 237:304: 46 tall, the two-stop gradient.
.pricing-preview-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 16px;
  border-radius: $radius-button;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
  color: $color-surface;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  text-align: center;
}

// 237:306
.pricing-preview-note {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// Dizajn 22: step 3's preview, read off 254:287 (Radno vreme) and 532:730
// (Definisani termini). The cards and tips are step 2's.

// 254:308, 534:528, and 260:308 on step 4: Light 12 on 18px lines.
.availability-preview-caption,
.rules-caption {
  line-height: 18px;
}

// 254:292: 18 padding, the parts 12 apart.
.hours-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: $radius-input;
  background: $color-background;
}

// 254:293: 10/14 padding inside the 1px stroke, 4 between label and value.
.hours-preview-box {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 9px 13px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface;
}

// 254:294
.hours-preview-label {
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  text-transform: uppercase;
  color: $color-text-muted;
}

// 254:295
.hours-preview-value {
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 254:296
.hours-preview-times {
  display: flex;
  gap: 10px;
}

// 254:303
.hours-preview-sum {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
}

// 254:304
.hours-preview-line {
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 254:305
.hours-preview-total {
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

// 254:306, 534:526: 44 tall, the two-stop gradient.
.availability-preview-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 16px;
  border-radius: $radius-input;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
  color: $color-surface;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  text-align: center;
}

// 534:515: the day, then its slots 8 apart.
.slots-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// 534:516
.slots-preview-date {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 534:517: 38 tall; the picked one (534:520) has the 1.5 blue stroke and tint.
.slots-preview-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: $radius-input;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-size: 13px;
  line-height: normal;
  color: $color-text;
}

.slots-preview-slot.is-selected {
  background: $color-accent-tint;
  box-shadow: inset 0 0 0 1.5px $color-primary;
  color: $color-primary;
}

// 534:518
.slots-preview-time {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 500;
}

// 534:519
.slots-preview-price {
  flex-shrink: 0;
  font-weight: 400;
  color: $color-text-muted;
  white-space: nowrap;
}

.slots-preview-slot.is-selected .slots-preview-price {
  color: $color-primary;
}

// Dizajn 23: step 4's body, read off 256:345 (Forma) and 256:498 (Saveti). The
// field states are Dizajn 6's (214:429, 214:436), like steps 1 and 2.
.rules {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

// 258:287: the title, the row and what follows it 12 apart.
.rules-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

// 258:289
.rules-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 258:290: two 372 columns, 16 apart. A single field keeps the left one (258:346).
.rules-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

// 258:291: the label 6 above the field, the hint 6 below it.
.rules-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

// 258:292
.rules-field-label {
  display: block;
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

// 258:293: 47 tall, 18 side padding, no stroke. Focus and error draw their 1.5
// stroke inside, as on steps 1 and 2.
.rules-input {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 47px;
  padding: 0 18px;
  border-radius: $radius-input;
  background-color: $color-background;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.rules-input:focus-within {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.rules-input.is-invalid {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

// 258:294
.rules-input-control {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
}

// 258:295
.rules-input-unit {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
}

// 258:314: Light 12 on 18px lines.
.rules-hint {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// 258:335
.rules-row-hint {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 214:438, in the hint's place.
.rules-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-error;
}

.rules-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

// 260:292: 38 tall rows. Figma draws each divider inside its row, so a row under
// one gives up 1px of padding.
.rules-summary {
  display: flex;
  flex-direction: column;
  margin: 0;
  border-radius: $radius-input;
  background: $color-background;
}

// 260:293
.rules-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 16px;
  font-size: 13px;
  line-height: normal;
}

.rules-summary-row + .rules-summary-row {
  padding-top: 10px;
  border-top: 1px solid $color-border;
}

// 260:294
.rules-summary-label {
  min-width: 0;
  font-weight: 300;
  color: $color-text-muted;
}

// 260:295
.rules-summary-value {
  margin: 0;
  font-weight: 500;
  color: $color-text;
  text-align: right;
}

// Dizajn 24: step 5's body, read off 262:345 (Forma) and 262:406 (Saveti). The option
// cards are step 2's and the advance fields step 4's; what differs is below.
.payment {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

// 264:287, 264:321, 264:336: 12 under the label and between the parts.
.payment-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

// 264:339: the cancellation options sit 10 apart.
.payment-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// The instant option waits at 50% while cash is picked, like "Nazad" on step 1.
.pricing-option.is-disabled {
  opacity: 0.5;
  cursor: default;
}

.pricing-option.is-disabled:hover {
  box-shadow: inset 0 0 0 1px $color-border;
}

// 264:305: 18/20 padding, the head 12 above the fields.
.payment-advance {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border-radius: $radius-input;
  background: $color-background;
}

// 264:307
.payment-advance-head {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.2px;
  color: $color-primary;
}

// 264:311 fills these with the panel's own grey; they take 264:351's white and stroke
// instead. Focus and error stay step 4's.
.payment-input {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
}

// 264:334: Regular 12 on 18px lines.
.payment-note {
  margin: 0;
  padding: 11px 14px;
  border-radius: $radius-input;
  background: $color-accent-tint;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: $color-primary;
}

.payment-note a {
  font-weight: 500;
  color: inherit;
  text-decoration: underline;
}

// 264:349: 14/20 padding, the label 16 before its field. An error wraps under them on a phone.
.payment-threshold {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 14px 20px;
  border-radius: $radius-input;
  background: $color-background;
}

// 264:350
.payment-threshold-label {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 264:351: 200 by 40, 16 side padding, the stroke inside. Focus and error as on step 4.
.payment-threshold-input {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 200px;
  height: 40px;
  padding: 0 16px;
  border-radius: $radius-input;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.payment-threshold-input:focus-within {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.payment-threshold-input.is-invalid {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

// 264:352
.payment-threshold-control {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
}

// 264:359: Light 13 on 20px lines. Figma's stroke sits inside the 16/20 padding.
.payment-money-note {
  margin: 0;
  padding: 15px 19px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface;
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

// 266:292: 12 around each step. Figma draws each divider inside its step, so a step
// under one gives up 1px of padding.
.payment-flow {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.payment-flow-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
}

.payment-flow-step:first-child {
  padding-top: 0;
}

.payment-flow-step:last-child {
  padding-bottom: 0;
}

.payment-flow-step + .payment-flow-step {
  padding-top: 11px;
  border-top: 1px solid $color-border;
}

// 266:294
.payment-flow-number {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: $color-accent-tint;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

// 266:296: 3 between the title and its line.
.payment-flow-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

// 266:297
.payment-flow-title {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 266:298
.payment-flow-desc {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

@include respond-below(sm) {
  .rules-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .pricing-price-row {
    flex-direction: column;
    align-items: stretch;
  }

  .pricing-unit {
    flex-basis: auto;
  }

  .pricing-select-alone {
    width: 100%;
  }
}

// Dizajn 25: step 6's body, read off each category's Forma column. The eight frames from
// 545:514 on share these values; 266:343 (Igraonice), drawn before them, differs where
// .details-playroom says so.
.details {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

// 266:401
.details-playroom {
  gap: 30px;
}

// 605:514: three fields 242 wide and 16 apart. A row of one or two keeps them 280 (605:672).
.details-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}

// 605:515: the label 10 above the field, the hint 10 below it.
.details-field {
  display: flex;
  flex: 0 1 280px;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.details-row.is-full .details-field {
  flex-basis: 242px;
}

// 605:517
.details-label {
  display: block;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 605:518: 51 tall, 20 side padding, no stroke, the unit 10 after the number. Focus and
// error draw their 1.5 stroke inside, as on the other steps.
.details-input {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 51px;
  padding: 0 20px;
  border-radius: $radius-input;
  background-color: $color-background;
  cursor: text;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.details-input:focus-within {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.details-input.is-invalid {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

// A hidden copy of the text sizes the cell the input fills, so the unit follows the number.
.details-input-value {
  display: grid;
  flex: 1 1 auto;
  min-width: 2px;
}

.details-input.has-unit .details-input-value {
  flex: 0 1 auto;
}

.details-input-value::after {
  content: attr(data-value);
  grid-area: 1 / 1;
  overflow: hidden;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  white-space: pre;
  visibility: hidden;
}

.details-input-control {
  grid-area: 1 / 1;
  width: 0;
  min-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
}

// 605:520
.details-input-unit {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
}

// 269:291: Igraonice keeps the unit at the field's right edge.
.details-playroom .details-input.has-unit .details-input-value {
  flex: 1 1 auto;
}

// 605:550: the chevron 14 wide, 20 in from the right, and the text stops 10 before it.
.details-select {
  position: relative;
}

.details-select-control {
  display: block;
  width: 100%;
  height: 51px;
  margin: 0;
  padding: 0 44px 0 20px;
  border: 0;
  border-radius: $radius-input;
  outline: none;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  text-overflow: ellipsis;
  cursor: pointer;
  appearance: none;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.details-select.is-empty .details-select-control {
  color: $color-text-muted;
}

.details-select-control option {
  color: $color-text;
}

.details-select-control:focus {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.details-select.is-invalid .details-select-control {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

.details-select-chevron {
  position: absolute;
  top: 50%;
  right: 20px;
  width: 14px;
  height: 14px;
  margin-top: -7px;
  pointer-events: none;
}

// 605:540: Light 13 on 18px lines.
.details-hint {
  margin: 0;
  font-size: 13px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

.details-textarea {
  display: block;
  width: 100%;
  min-height: 120px;
  margin: 0;
  padding: 16px 20px;
  border: 0;
  border-radius: $radius-input;
  outline: none;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  line-height: 22px;
  resize: vertical;
}

.details-textarea:focus {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.details-textarea.is-invalid {
  background-color: $field-danger-bg;
  box-shadow: inset 0 0 0 1.5px $field-danger-border;
}

// 605:555: the label 10 above the options, its note 6 after the name.
.details-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

// 605:556
.details-group-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 605:558
.details-group-note {
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

// 269:295, 269:296: Igraonice has 12 under the label and 8 before the note.
.details-playroom .details-group {
  gap: 12px;
}

.details-playroom .details-group-label {
  gap: 8px;
}

// 607:735: pills 12 apart.
.details-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

// 269:299
.details-playroom .details-pills {
  gap: 10px;
}

// 607:736: 12/18/12/16 padding, the mark 10 before the text. The grey stroke is inset, so
// picking a pill doesn't move it.
.details-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 18px 12px 16px;
  border-radius: 999px;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  color: $color-text-muted;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

// 605:559: 245 wide tiles, 12 apart both ways.
.details-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, 245px);
  gap: 12px;
}

// 605:560: 44 tall, 16 side padding, the mark 10 before the text. A name on two lines still
// fits the 44.
.details-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 44px;
  margin: 0;
  padding: 6px 16px;
  border-radius: $radius-input;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  color: $color-text-muted;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.details-tile-text {
  flex: 1 1 auto;
  min-width: 0;
}

// Hover draws the blue stroke, like step 2's option cards.
.details-pill:hover,
.details-tile:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
}

// 605:560, 607:736: once picked, the accent tint and no stroke.
.details-pill.is-selected,
.details-tile.is-selected {
  background-color: $color-accent-tint;
  box-shadow: none;
  color: $color-text;
}

.details-pill:has(:focus-visible),
.details-tile:has(:focus-visible) {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

// 605:561: 18 with corner 5. Blue with the 12 check once picked, white with a 1.5 grey
// stroke before.
.details-check {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-border;
}

.is-selected > .details-check {
  background-color: $color-primary;
  box-shadow: none;
}

.details-check img {
  display: block;
  width: 12px;
  height: 12px;
}

// 607:737: a single choice has a round mark.
.details-pill-single .details-check {
  border-radius: 9px;
}

// 269:301, 269:304: Igraonice's mark has corner 8 and the 18 check.
.details-playroom .details-check {
  border-radius: 8px;
}

.details-playroom .details-check img {
  width: 18px;
  height: 18px;
}

.details-empty {
  margin: 0;
  font-size: 15px;
  color: $color-text-muted;
}

// 545:674: 38 tall rows on alternating fills, 14 in. Figma draws the stroke inside, over
// the rows.
.details-summary {
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  border-radius: $radius-input;
  background: $color-background;
}

.details-summary::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid $color-border;
  border-radius: inherit;
  pointer-events: none;
}

// 550:514
.details-summary-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  font-size: 13px;
  line-height: normal;
}

.details-summary-row:nth-child(even) {
  background: $color-surface;
}

// 550:515
.details-summary-label {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 400;
  color: $color-text-muted;
}

// 550:516
.details-summary-value {
  margin: 0;
  font-weight: 500;
  color: $color-text;
  text-align: right;
}

// 273:292 (Igraonice): no stroke, 16 in, and a divider inside each row under another, as
// on step 4.
.details-summary.is-lined::after {
  content: none;
}

.details-summary.is-lined .details-summary-row {
  padding: 11px 16px;
  background: none;
}

.details-summary.is-lined .details-summary-row + .details-summary-row {
  padding-top: 10px;
  border-top: 1px solid $color-border;
}

.details-summary.is-lined .details-summary-label {
  font-weight: 300;
}

// 545:684: the caption 10 above the chips.
.details-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// 545:686: chips 6 apart.
.details-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 550:532
.details-chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: $color-accent-tint;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

// 273:304 (Igraonice): 8 apart, 7 above and below.
.details-filters.is-playroom .details-chips {
  gap: 8px;
}

.details-filters.is-playroom .details-chip {
  padding: 7px 12px;
}

@include respond-below(sm) {
  .details-field,
  .details-row.is-full .details-field {
    flex-basis: 100%;
  }

  .details-tiles {
    grid-template-columns: minmax(0, 1fr);
  }
}

// 228:376: 64 under the content.
.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 64px;
}

.wizard-actions-back {
  display: flex;
  align-items: center;
  gap: 18px;
}

// 228:378: at 50% on the first step, where there's nothing to go back to.
.wizard-back {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 52px;
  margin: 0;
  padding: 0 26px 0 24px;
  border: 0;
  border-radius: 8px;
  background: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.wizard-back:hover:not(:disabled) {
  background: $color-border;
}

.wizard-back:disabled {
  opacity: 0.5;
  cursor: default;
}

.wizard-back img,
.wizard-next img {
  display: block;
  width: 16px;
  height: 16px;
}

// 228:382
.wizard-count {
  font-size: 14px;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
}

// 228:383: left to right, three stops.
.wizard-next {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 52px;
  margin: 0;
  padding: 0 28px 0 30px;
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

.wizard-next:hover:not(:disabled) {
  opacity: 0.92;
}

.wizard-next:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wizard-segment:focus-visible,
.wizard-category-change:focus-visible,
.wizard-back:focus-visible,
.wizard-next:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

@include respond-below(lg) {
  .wizard {
    grid-template-columns: minmax(0, 1fr);
  }

  .wizard > .wizard-tips,
  .wizard > .wizard-aside {
    grid-column: 1;
    margin-top: 40px;
  }
}

@include respond-below(md) {
  .wizard {
    padding-top: 32px;
  }

  .wizard-title {
    font-size: 34px;
    line-height: 40px;
    letter-spacing: -1.19px;
  }

  .wizard-subtitle {
    font-size: 16px;
    line-height: 24px;
  }

  .wizard-actions {
    margin-top: 40px;
  }
}

// "Korak N od M" is already above the bar, so a phone drops the count and
// keeps both buttons on one line.
@include respond-below(sm) {
  .wizard-actions,
  .wizard-actions-back {
    gap: 12px;
  }

  .wizard-count {
    display: none;
  }

  .wizard-back,
  .wizard-next {
    padding: 0 20px;
  }
}

// ===== Dropzone =====
.dropzone {
  border: 2px dashed #c9d4ee;
  border-radius: $radius-card;
  background: #fafbff;
  padding: 38px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  margin-bottom: 28px;
}

.dropzone:hover,
.dropzone-active {
  border-color: $color-primary;
  background: #f2f6ff;
}

.dropzone-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: $gradient-marketing;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  box-shadow: 0 10px 20px -8px rgba(9, 87, 223, 0.5);
}

.dropzone strong {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 4px;
  display: block;
}

.dropzone span {
  font-size: 13px;
  color: $color-text-muted;
}

// ===== Photo grid =====
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -8px 14px;
}

.photo {
  position: relative;
  border-radius: $radius-input;
  overflow: hidden;
  height: 150px;
  background: #eef1f7;
  border: 1px solid $color-border;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  width: calc(50% - 16px);
  margin: 0 8px 16px;
}

@include respond-above(sm) {
  .photo {
    width: calc(25% - 16px);
  }
}

.photo:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -10px rgba(16, 29, 61, 0.25);
}

.photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: $color-primary;
  color: $color-surface;
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: $radius-pill;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px -2px rgba(9, 87, 223, 0.5);
  border: none;
  cursor: pointer;
}

.photo-badge-inactive {
  background: rgba(15, 23, 42, 0.45);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.photo:hover .photo-badge-inactive {
  opacity: 1;
}

.photo-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: $radius-pill;
  background: rgba(15, 23, 42, 0.55);
  color: $color-surface;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s ease;
  cursor: pointer;
}

.photo:hover .photo-remove {
  opacity: 1;
}

.photo-drag {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.photo:hover .photo-drag {
  opacity: 1;
}

.photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed #c9d4ee;
  background: #fafbff;
  color: $color-primary;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.photo-add:hover {
  background: #f2f6ff;
  border-color: $color-primary;
}

.grid-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: $color-text-muted;
  margin-bottom: 12px;
}

.grid-hint svg {
  flex-shrink: 0;
  color: $color-primary;
}

/* T29 — a 20-30+ item checkbox list (Sadržaji/Oprema/Priključci) in one
   vertical column made the step needlessly tall; auto-fill columns instead,
   collapsing to a single column on narrow viewports on their own. */
.wizard-multiselect {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px 16px;
}

.wizard-checklist {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ical-locked {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1.5px dashed $color-border;
  border-radius: $radius-input;
  background: $color-background;
}

.ical-locked-icon {
  font-size: 18px;
  flex-shrink: 0;
}
</style>
