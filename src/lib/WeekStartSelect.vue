<template>
  <select
    class="b3-select"
    v-model.number="weekStart"
    style="width: 200px;"
    :title="i18n.value?.weekStart?.title || 'Week starts on'"
    :aria-label="i18n.value?.weekStart?.title || 'Week starts on'"
  >
    <option :value="0">{{ weekStartText.sunday }}</option>
    <option :value="1">{{ weekStartText.monday }}</option>
  </select>
</template>
<script lang="ts" setup>
import { weekStart, i18n } from '@/hooks/useSiYuan';
import { computed } from 'vue';

const weekStartText = computed(() => {
  return (
    i18n.value?.weekStart || { title: 'Week starts on', sunday: 'Sunday', monday: 'Monday' }
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
</style>
