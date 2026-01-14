<template>
  <div class="input-container">
    <input 
      type="text" 
      class="b3-input" 
      v-model="weeklyTemplatePath"
      placeholder="/path/to/template.md"
    />
  </div>
</template>

<script setup lang="ts">
import { weeklyTemplatePath } from '@/hooks/useSiYuan';
</script>

<style scoped>
.input-container {
  width: 100%;
  display: flex;
}

.b3-input {
  width: 100%;
  max-width: 380px;
  padding: 6px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  font-size: 13px;
}
</style>
