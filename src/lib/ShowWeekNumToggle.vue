<template>
  <div class="switch-container fn__flex-center">
    <input 
      type="checkbox" 
      class="b3-switch" 
      v-model="showWeekNum"
      id="show-week-num-checkbox"
    />
  </div>
</template>

<script setup lang="ts">
import { showWeekNum } from '@/hooks/useSiYuan';
</script>

<style scoped>
.switch-container {
  width: 200px;
  height: 32px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.b3-switch {
  cursor: pointer;
}
</style>