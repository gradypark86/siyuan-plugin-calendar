<!--
 * @Author: gradypark86 gradypark@yeah.net
 * @Date: 2026-04-06 20:58
 * @LastEditors: gradypark86 gradypark@yeah.net
 * @LastEditTime: 2026-04-06 20:58
 * @FilePath: \siyuan-plugin-calendar\src\lib\MonthlySettings.vue
 * @Description: 
-->
<template>
  <div class="switch-container fn__flex-center">
    <input
      type="checkbox"
      class="b3-switch"
      v-model="monthlyEnabled"
      id="monthly-enabled-checkbox"
    />
  </div>
</template>

<script setup lang="ts">
import { monthlyEnabled } from '@/hooks/useSiYuan';
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
