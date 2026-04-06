<template>
  <div class="weekly-settings-container">
    <!-- Weekly Section -->
    <div class="period-section" :class="{ disabled: !weeklyEnabled }">
      <div class="period-body" :class="{ collapsed: !weeklyEnabled }">
        <div class="vertical-group">
          <div class="group-label">{{ i18n.weekly?.pathLabel }}</div>
          <div class="hint">{{ i18n.weekly?.pathHint }}</div>
          <input
            type="text"
            class="b3-text-field b3-text-field--full"
            v-model="weeklyPath"
            :disabled="!weeklyEnabled"
            placeholder="/Daily Notes/{{now | date '2006/01'}}/{{now | date '2006'}}-W{{weekly}}"
          />
        </div>

        <div class="vertical-group">
          <div class="group-label">{{ i18n.weekly?.templateLabel }}</div>
          <div class="hint">{{ i18n.weekly?.templateHint }}</div>
          <input
            type="text"
            class="b3-text-field b3-text-field--full"
            v-model="weeklyTemplatePath"
            :disabled="!weeklyEnabled"
            placeholder="weekly-template.md"
          />
        </div>
      </div>
    </div>

    <!-- Monthly Section -->
    <div class="period-section" :class="{ disabled: !monthlyEnabled }">
      <div class="period-body" :class="{ collapsed: !monthlyEnabled }">
        <div class="vertical-group">
          <div class="group-label">{{ i18n.monthly?.pathLabel }}</div>
          <div class="hint">{{ i18n.monthly?.pathHint }}</div>
          <input
            type="text"
            class="b3-text-field b3-text-field--full"
            v-model="monthlyPath"
            :disabled="!monthlyEnabled"
            placeholder="/Daily Notes/Monthly/{{now | date '2006/01'}}/{{now | date '2006-01'}}"
          />
        </div>

        <div class="vertical-group">
          <div class="group-label">{{ i18n.monthly?.templateLabel }}</div>
          <div class="hint">{{ i18n.monthly?.templateHint }}</div>
          <input
            type="text"
            class="b3-text-field b3-text-field--full"
            v-model="monthlyTemplatePath"
            :disabled="!monthlyEnabled"
            placeholder="monthly-template.md"
          />
        </div>
      </div>
    </div>

    <!-- Yearly Section -->
    <div class="period-section" :class="{ disabled: !yearlyEnabled }">
      <div class="period-body" :class="{ collapsed: !yearlyEnabled }">
        <div class="vertical-group">
          <div class="group-label">{{ i18n.yearly?.pathLabel }}</div>
          <div class="hint">{{ i18n.yearly?.pathHint }}</div>
          <input
            type="text"
            class="b3-text-field b3-text-field--full"
            v-model="yearlyPath"
            :disabled="!yearlyEnabled"
            placeholder="/Daily Notes/Yearly/{{now | date '2006'}}"
          />
        </div>

        <div class="vertical-group">
          <div class="group-label">{{ i18n.yearly?.templateLabel }}</div>
          <div class="hint">{{ i18n.yearly?.templateHint }}</div>
          <input
            type="text"
            class="b3-text-field b3-text-field--full"
            v-model="yearlyTemplatePath"
            :disabled="!yearlyEnabled"
            placeholder="yearly-template.md"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  weeklyEnabled,
  weeklyPath,
  weeklyTemplatePath,
  monthlyEnabled,
  monthlyPath,
  monthlyTemplatePath,
  yearlyEnabled,
  yearlyPath,
  yearlyTemplatePath,
  i18n,
} from '@/hooks/useSiYuan';
</script>

<style scoped>
.weekly-settings-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  margin-left: 0;
  padding-left: 2px;
}

.period-section {
  width: 100%;
  border-radius: 6px;
  transition: opacity 0.2s ease;
}

.period-section.disabled {
  opacity: 0.58;
}

.period-body {
  overflow: hidden;
  max-height: 520px;
  transition: max-height 0.22s ease, opacity 0.2s ease, filter 0.2s ease;
}

.period-body.collapsed {
  max-height: 0;
  opacity: 0.45;
  filter: grayscale(0.2);
  pointer-events: none;
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
