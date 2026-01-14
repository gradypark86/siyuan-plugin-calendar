<template>
  <div class="weekly-settings-container">
    <!-- Path Section (Vertical) -->
    <div class="vertical-group">
      <div class="group-label">{{ i18n.weekly?.pathLabel }}</div>
      <div class="hint">{{ i18n.weekly?.pathHint }}</div>
      <input 
        type="text" 
        class="b3-text-field b3-text-field--full" 
        v-model="weeklyPath"
        placeholder="/Daily Notes/{{now | date '2006/01'}}/{{now | date '2006'}}-W{{weekly}}"
      />
    </div>

    <!-- Template Section (Vertical) -->
    <div class="vertical-group">
      <div class="group-label">{{ i18n.weekly?.templateLabel }}</div>
      <div class="hint">{{ i18n.weekly?.templateHint }}</div>
      <input 
        type="text" 
        class="b3-text-field b3-text-field--full" 
        v-model="weeklyTemplatePath"
        placeholder="weekly-template.md"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { weeklyPath, weeklyTemplatePath, i18n } from '@/hooks/useSiYuan';
</script>

<style scoped>
.weekly-settings-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  /* Shift left to align with title labels above */
  margin-left: -10px;
}

/* Row that mimics a standard b3-label structure */
.mimic-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding-left: 0; /* Align with parent's left edge */
}

.mimic-title {
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  flex: 1;
  text-align: left;
  /* match the standard setting title appearance */
  font-weight: 500;
  opacity: 0.88;
}

.mimic-action {
  display: flex;
  align-items: center;
  margin-left: auto;
}

/* Vertical layout group */
.vertical-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 12px;
}

.group-label {
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  padding: 4px 0 8px 0;
  text-align: left;
}

.hint {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  margin-top: 6px;
  white-space: pre-wrap;
}

/* Standard Siyuan Input styling with theme support */
.b3-text-field {
  width: 100%;
  box-sizing: border-box;
  /* 
     Force the background to use theme variables. 
     In dark mode, --b3-theme-background is dark; in light mode, it's light.
  */
  background-color: var(--b3-theme-background) !important;
  color: var(--b3-theme-on-surface) !important;
  border: 1px solid var(--b3-border-color);
  padding: 8px 12px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  transition: border-color 0.2s;
}

.b3-text-field:focus {
  border-color: var(--b3-theme-primary);
  outline: none;
}

.b3-text-field:hover {
  border-color: var(--b3-theme-primary-light);
}

.b3-text-field::placeholder {
  color: var(--b3-theme-on-surface);
  opacity: 0.3;
}

.b3-switch {
  cursor: pointer;
}
</style>
