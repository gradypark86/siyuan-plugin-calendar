<template>
  <div class="time-input" :title="label" :aria-label="label">
    <input
      class="b3-text-field time-part"
      type="text"
      inputmode="numeric"
      maxlength="2"
      :value="hourText"
      :aria-label="hourAria"
      @input="onHourInput"
      @blur="commitHour"
      @keydown.enter.prevent="commitHour"
    />
    <span class="time-sep" aria-hidden="true">:</span>
    <input
      class="b3-text-field time-part"
      type="text"
      inputmode="numeric"
      maxlength="2"
      :value="minuteText"
      :aria-label="minuteAria"
      @input="onMinuteInput"
      @blur="commitMinute"
      @keydown.enter.prevent="commitMinute"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  dayRolloverHour,
  dayRolloverMinute,
  i18n,
} from '@/hooks/useSiYuan';
import {
  isValidDayRolloverHour,
  isValidDayRolloverMinute,
  normalizeDayRolloverHour,
  normalizeDayRolloverMinute,
} from '@/utils/dayRollover';

const label = computed(
  () => i18n.value?.dayRolloverHour?.title || 'New day starts at'
);
const hourAria = computed(
  () => i18n.value?.dayRolloverHour?.hourLabel || 'Hour'
);
const minuteAria = computed(
  () => i18n.value?.dayRolloverHour?.minuteLabel || 'Minute'
);

const hourText = ref(pad2(normalizeDayRolloverHour(dayRolloverHour.value)));
const minuteText = ref(pad2(normalizeDayRolloverMinute(dayRolloverMinute.value)));

watch(dayRolloverHour, value => {
  hourText.value = pad2(normalizeDayRolloverHour(value));
});
watch(dayRolloverMinute, value => {
  minuteText.value = pad2(normalizeDayRolloverMinute(value));
});

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Keep only digits, at most 2 chars. */
function sanitizeDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 2);
}

function onHourInput(e: Event) {
  const target = e.target as HTMLInputElement;
  hourText.value = sanitizeDigits(target.value);
  target.value = hourText.value;
  // Commit as soon as valid so settings Confirm works without blur.
  if (isValidDayRolloverHour(hourText.value)) {
    dayRolloverHour.value = Number(hourText.value);
  }
}

function onMinuteInput(e: Event) {
  const target = e.target as HTMLInputElement;
  minuteText.value = sanitizeDigits(target.value);
  target.value = minuteText.value;
  if (isValidDayRolloverMinute(minuteText.value)) {
    dayRolloverMinute.value = Number(minuteText.value);
  }
}

function commitHour() {
  if (isValidDayRolloverHour(hourText.value)) {
    dayRolloverHour.value = Number(hourText.value);
  } else {
    // Invalid/empty on blur → fall back to midnight hour.
    dayRolloverHour.value = 0;
  }
  hourText.value = pad2(normalizeDayRolloverHour(dayRolloverHour.value));
}

function commitMinute() {
  if (isValidDayRolloverMinute(minuteText.value)) {
    dayRolloverMinute.value = Number(minuteText.value);
  } else {
    dayRolloverMinute.value = 0;
  }
  minuteText.value = pad2(normalizeDayRolloverMinute(dayRolloverMinute.value));
}
</script>

<style scoped>
.time-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.time-part {
  width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  background-color: var(--b3-theme-background) !important;
  color: var(--b3-theme-on-surface) !important;
}

.time-sep {
  color: var(--b3-theme-on-surface);
  font-weight: 600;
  opacity: 0.8;
  user-select: none;
}
</style>
