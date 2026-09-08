<template>
  <select
    class="b3-select"
    v-model="weekNumRule"
    :disabled="weekStart !== 1"
    style="width: 120px;"
    :title="i18n.value?.weekNumRule?.title || 'Week number rule'"
    :aria-label="i18n.value?.weekNumRule?.title || 'Week number rule'"
  >
    <option value="calendar">{{ weekNumRuleText.calendar }}</option>
    <option value="iso">{{ weekNumRuleText.iso }}</option>
  </select>
</template>
<script lang="ts" setup>
import { weekNumRule, weekStart, i18n } from '@/hooks/useSiYuan';
import { computed } from 'vue';

const weekNumRuleText = computed(() => {
  return (
    i18n.value?.weekNumRule || {
      title: 'Week number rule',
      calendar: 'Calendar week',
      iso: 'ISO 8601',
    }
  );
});
</script>

<style scoped>
.b3-select {
  background-color: var(--b3-theme-background) !important;
  color: var(--b3-theme-on-surface) !important;
}
.b3-select:focus,
.b3-select:active {
  background-color: var(--b3-theme-background) !important;
}
.b3-select option {
  background-color: var(--b3-theme-background) !important;
  color: var(--b3-theme-on-surface) !important;
}
.b3-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
