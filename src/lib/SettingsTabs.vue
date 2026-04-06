<!--
 * @Author: gradypark86 gradypark@yeah.net
 * @Date: 2026-04-06 21:16
 * @LastEditors: gradypark86 gradypark@yeah.net
 * @LastEditTime: 2026-04-06 21:16
 * @FilePath: \siyuan-plugin-calendar\src\lib\SettingsTabs.vue
 * @Description: 
-->
<template>
  <div class="settings-tabs-container">
    <div class="tabs-header">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'basic' }"
        @click="activeTab = 'basic'"
      >
        {{ tabText.basic }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'periodic' }"
        @click="activeTab = 'periodic'"
      >
        {{ tabText.periodic }}
      </button>
    </div>

    <div v-if="activeTab === 'basic'" class="tab-panel">
      <div class="setting-row">
        <div class="setting-title">{{ t.position?.title || 'Position' }}</div>
        <div class="setting-action">
          <SySelect />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-title">{{ t.weekStart?.title || 'Week starts on' }}</div>
        <div class="setting-action">
          <WeekStartSelect />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-title">{{ t.showWeekNum?.title || 'Show week number' }}</div>
        <div class="setting-action">
          <ShowWeekNumToggle />
        </div>
      </div>
    </div>

    <div v-else class="tab-panel periodic-panel">
      <div class="periodic-switches-sticky">
        <div class="setting-row">
          <div class="setting-title">{{ t.weekly?.enable || 'Enable weekly notes' }}</div>
          <div class="setting-action">
            <WeeklySettings />
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-title">{{ t.monthly?.enable || 'Enable monthly notes' }}</div>
          <div class="setting-action">
            <MonthlySettings />
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-title">{{ t.yearly?.enable || 'Enable yearly notes' }}</div>
          <div class="setting-action">
            <YearlySettings />
          </div>
        </div>
      </div>

      <WeeklyNoteGroup />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { i18n } from '@/hooks/useSiYuan';
import SySelect from './SySelect.vue';
import WeekStartSelect from './WeekStartSelect.vue';
import ShowWeekNumToggle from './ShowWeekNumToggle.vue';
import WeeklySettings from './WeeklySettings.vue';
import MonthlySettings from './MonthlySettings.vue';
import YearlySettings from './YearlySettings.vue';
import WeeklyNoteGroup from './WeeklyNoteGroup.vue';

const activeTab = ref<'basic' | 'periodic'>('basic');

const t = computed(() => (i18n.value || {}) as any);

const tabText = computed(() => {
  const tabs = t.value.settingsTabs || {};
  return {
    basic: tabs.basic || 'Basic',
    periodic: tabs.periodic || 'Periodic Notes',
  };
});
</script>

<style scoped>
.settings-tabs-container {
  width: 100%;
  box-sizing: border-box;
  margin-left: 0;
  padding-left: 4px;
}

.tabs-header {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--b3-border-color);
  padding: 2px 0 10px 0;
  margin-bottom: 8px;
}

.tab-btn {
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: var(--b3-theme-surface-hover);
}

.tab-btn.active {
  color: var(--b3-theme-on-primary);
  background: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
}

.tab-panel {
  width: 100%;
}

.periodic-panel {
  box-sizing: border-box;
  max-height: min(62vh, 520px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px 4px 0;
}

.periodic-switches-sticky {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--b3-theme-surface);
  border-bottom: 1px dashed var(--b3-border-color);
  margin-bottom: 8px;
  padding-bottom: 6px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 36px;
  margin: 2px 0;
}

.setting-title {
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  font-weight: 500;
  opacity: 0.88;
  text-align: left;
  flex: 1;
}

.setting-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
}

.periodic-panel::-webkit-scrollbar {
  width: 8px;
}

.periodic-panel::-webkit-scrollbar-thumb {
  background: var(--b3-scroll-color);
  border-radius: 8px;
}

.periodic-panel::-webkit-scrollbar-track {
  background: transparent;
}
</style>
