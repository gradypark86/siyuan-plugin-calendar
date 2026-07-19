<!--
 * Settings panel with left-right layout (SiYuan native config style).
 * Inspired by frostime/siyuan-dailynote-today.
-->
<template>
  <div class="fn__flex-1 fn__flex config__panel settings-root">
    <!-- Left vertical tab bar -->
    <ul class="b3-tab-bar b3-list b3-list--background settings-tab-bar">
      <li
        class="b3-list-item"
        :class="{ 'b3-list-item--focus': activeTab === 'basic' }"
        @click="activeTab = 'basic'"
      >
        <span class="b3-list-item__text">{{ tabText.basic }}</span>
      </li>
      <li
        class="b3-list-item"
        :class="{ 'b3-list-item--focus': activeTab === 'periodic' }"
        @click="activeTab = 'periodic'"
      >
        <span class="b3-list-item__text">{{ tabText.periodic }}</span>
      </li>
      <li
        class="b3-list-item"
        :class="{ 'b3-list-item--focus': activeTab === 'advanced' }"
        @click="activeTab = 'advanced'"
      >
        <span class="b3-list-item__text">{{ tabText.advanced }}</span>
      </li>
    </ul>

    <!-- Right content -->
    <div class="config__tab-wrap settings-content">
      <!-- Basic -->
      <div
        class="config__tab-container"
        :class="{ 'fn__none': activeTab !== 'basic' }"
      >
        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.position?.title || 'Position' }}
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <SySelect />
          </div>
        </label>

        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.weekStart?.title || 'Week starts on' }}
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <WeekStartSelect />
          </div>
        </label>

        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.showWeekNum?.title || 'Show week number' }}
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <ShowWeekNumToggle />
          </div>
        </label>
      </div>

      <!-- Periodic -->
      <div
        class="config__tab-container settings-scroll"
        :class="{ 'fn__none': activeTab !== 'periodic' }"
      >
        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.weekly?.enable || 'Enable weekly notes' }}
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <WeeklySettings />
          </div>
        </label>

        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.monthly?.enable || 'Enable monthly notes' }}
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <MonthlySettings />
          </div>
        </label>

        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.yearly?.enable || 'Enable yearly notes' }}
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <YearlySettings />
          </div>
        </label>

        <WeeklyNoteGroup />
      </div>

      <!-- Advanced -->
      <div
        class="config__tab-container"
        :class="{ 'fn__none': activeTab !== 'advanced' }"
      >
        <label class="fn__flex b3-label setting-item">
          <div class="fn__flex-1">
            {{ t.dayRolloverHour?.title || 'New day starts at' }}
            <div class="b3-label__text">
              {{
                t.dayRolloverHour?.hint ||
                'Before this time, "today" is still treated as the previous day when creating daily notes.'
              }}
            </div>
          </div>
          <span class="fn__space"></span>
          <div class="setting-control">
            <DayRolloverTimeInput />
          </div>
        </label>
      </div>
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
import DayRolloverTimeInput from './DayRolloverTimeInput.vue';

const activeTab = ref<'basic' | 'periodic' | 'advanced'>('basic');

const t = computed(() => (i18n.value || {}) as any);

const tabText = computed(() => {
  const tabs = t.value.settingsTabs || {};
  return {
    basic: tabs.basic || 'Basic',
    periodic: tabs.periodic || 'Periodic Notes',
    advanced: tabs.advanced || 'Advanced',
  };
});
</script>

<style scoped>
.settings-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: var(--b3-theme-surface);
}

.settings-tab-bar {
  width: 140px;
  flex-shrink: 0;
  min-width: 72px;
  box-sizing: border-box;
  padding: 6px 0;
  border-right: 1px solid var(--b3-border-color);
  overflow-y: auto;
  background: var(--b3-theme-surface);
}

.settings-tab-bar :deep(.b3-list-item) {
  padding-left: 1rem;
  margin: 2px 4px;
  border-radius: 6px;
  cursor: pointer;
}

.settings-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-surface);
}

.config__tab-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 18px 16px 18px;
  box-sizing: border-box;
}

.setting-item {
  align-items: center;
  margin: 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--b3-border-color);
  /* Reset default b3-label outer box so rows don't look nested */
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}

.setting-item:last-of-type {
  border-bottom: none;
}

.setting-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* Override fixed widths inside action widgets so they sit cleanly on the right */
.setting-control :deep(.switch-container) {
  width: auto;
  min-width: 0;
  height: auto;
}

.setting-control :deep(.b3-select) {
  width: 180px;
}

.setting-control :deep(.time-input) {
  width: auto;
}

/* Periodic path groups keep their own spacing */
.settings-scroll :deep(.weekly-settings-container) {
  margin-top: 4px;
  padding-left: 0;
}

@media screen and (max-width: 768px) {
  .settings-tab-bar {
    width: 96px;
    min-width: 64px;
  }

  .settings-tab-bar :deep(.b3-list-item) {
    padding-left: 0.5rem;
    height: 40px;
    line-height: 40px;
  }

  .settings-tab-bar :deep(.b3-list-item__text) {
    font-size: 12px;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    word-break: break-word;
  }

  .config__tab-container {
    padding: 8px 10px 12px 10px;
  }
}
</style>
