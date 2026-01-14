<template>
  <select
    class="b3-select"
    v-model="position"
    style="width: 200px;"
    :title="i18n.value?.position?.title || 'Position'"
    :aria-label="i18n.value?.position?.title || 'Position'"
  >
    <template v-for="{ value, text } in options" :key="value">
      <option :value="value">{{ text }}</option>
    </template>
  </select>
</template>
<script lang="ts" setup>
import { position, i18n } from '@/hooks/useSiYuan';
import { computed } from 'vue';

const positionText = computed(() => {
  return (
    i18n.value?.position || {
      topLeft: 'Top Left',
      topRight: 'Top Right',
      dock: 'Dock',
    }
  );
});

const options = computed(() => [
  { value: 'top-left', text: positionText.value.topLeft },
  { value: 'top-right', text: positionText.value.topRight },
  { value: 'dock', text: positionText.value.dock },
]);
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
