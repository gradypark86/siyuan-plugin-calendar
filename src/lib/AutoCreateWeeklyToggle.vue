<template>
  <div class="switch-container fn__flex-center">
    <input
      type="checkbox"
      class="b3-switch"
      v-model="autoCreateWeekly"
      :disabled="!weeklyEnabled || autoCreateWeeklyForced"
      id="auto-create-weekly-checkbox"
    />
  </div>
</template>

<script setup lang="ts">
import { autoCreateWeekly, autoCreateWeeklyForced, weeklyEnabled } from '@/hooks/useSiYuan';
</script>

<style scoped>
.switch-container { display: flex; justify-content: flex-end; align-items: center; }
.b3-switch { cursor: pointer; }
</style>
