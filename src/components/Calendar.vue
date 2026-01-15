<template>
  <div class="siyuan-calendar">
    <!-- 确认对话框 -->
    <ConfirmDialog ref="confirmDialogRef" />

    <!-- 导航栏 -->
    <div class="calendar-nav">
      <div class="nav-center">
        <button @click="prevMonth" class="nav-btn" :title="locale.datePicker.previous">&lt;</button>
        <div class="month-title" ref="monthPickerRef">
          <span class="month-title-part year-part" @click.stop="toggleYearPicker">
            {{ displayedMonth.format('YYYY') }}
            <div v-if="showYearPicker" class="picker-dropdown year-dropdown">
              <div class="year-grid">
                <div class="year-item year-nav" @click.stop="yearGridPrev">«</div>
                <div v-for="y in yearGridYears" :key="y" class="year-item" :class="{ 'current-year': y === displayedMonth.year() }" @click.stop="selectYear(y)">{{ y }}</div>
                <div class="year-item year-nav" @click.stop="yearGridNext">»</div>
              </div>
            </div>
          </span>
          <span class="month-title-sep">-</span>
          <span class="month-title-part month-part" @click.stop="toggleMonthPicker">
            {{ displayedMonth.format('MM') }}
            <div v-if="showMonthPicker" class="picker-dropdown month-dropdown">
              <div class="month-grid">
                <div v-for="(m, idx) in months" :key="m" class="month-item" @click.stop="selectMonth(idx)">{{ m }}</div>
              </div>
            </div>
          </span>
        </div>
        <button @click="nextMonth" class="nav-btn" :title="locale.datePicker.next">&gt;</button>
      </div>
      <div class="nav-right">
        <button @click="clickToday" class="today-btn">{{ todayLabel }}</button>
        <button @click="refreshExistDates" class="refresh-btn" :title="refreshTitle">⟳</button>
      </div>
    </div>

    <!-- 日历表格 -->
    <table class="calendar-table">
      <thead>
        <tr>
          <th v-if="showWeekNum" class="week-header">{{ localeType === 'zh_CN' ? '周' : 'W' }}</th>
          <th v-for="(dayName, index) in dayNames"
              :key="dayName"
              :class="{ 'weekend-header': isWeekendColumn(index) }">
            {{ dayName }}
          </th>
        </tr>
      </thead>

      <!-- 表体 - 按周组织 -->
      <tbody>
        <tr v-for="week in monthWeeks" :key="`week-${week.weekNum}`" class="week-row">
          <!-- 周号列 -->
          <td v-if="showWeekNum" class="week-cell">
            <template v-if="weeklyEnabled">
              <button class="week-num-btn" @click.stop="openWeeklyNote(week)">{{ week.weekNum }}</button>
            </template>
            <template v-else>
              <div class="week-num">{{ week.weekNum }}</div>
            </template>
          </td>

          <!-- 日期单元格 -->
          <td v-for="date in week.days"
              :key="date.format('YYYY-MM-DD')"
              :class="getDayClasses(date)"
              class="day-cell">
            <div class="day-content"
                 @click.stop="openDailyNote(date)">
              <!-- 日期数字 -->
              <div class="day-number">{{ date.date() }}</div>

              <!-- 存在标记 -->
              <div class="day-marker" v-if="existDailyNotesMap.has(date.format('YYYY-MM-DD'))">•</div>
              <div class="day-marker day-marker-empty" v-else></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRefs, onMounted, onBeforeUnmount } from 'vue';
import dayjs from 'dayjs';
import * as api from '@/api/api';
import { openDoc } from '@/api/daily-note';
import { useLocale, formatMsg } from '@/hooks/useLocale';
import { eventBus, weekStart, showWeekNum, weeklyEnabled, i18n } from '@/hooks/useSiYuan';
import { CusNotebook } from '@/utils/notebook';
import { refreshSql } from '@/api/utils';
import ConfirmDialog from './ConfirmDialog.vue';

const { locale, localeType } = useLocale();

const props = defineProps<{ notebook: CusNotebook | undefined }>();
const { notebook } = toRefs(props);

const confirmDialogRef = ref();

// ===== 状态 =====
const displayedMonth = ref(dayjs());
const thisPanelDate = ref(new Date());

// 年月选择器状态
const monthPickerRef = ref<HTMLElement | null>(null);
const showYearPicker = ref(false);
const showMonthPicker = ref(false);

const years = computed(() => {
  const cur = displayedMonth.value.year();
  const list: number[] = [];
  for (let y = cur - 10; y <= cur + 10; y++) list.push(y);
  return list;
});

const months = computed(() => {
  // 显示 01..12
  const arr: string[] = [];
  for (let i = 1; i <= 12; i++) arr.push(i.toString().padStart(2, '0'));
  return arr;
});

// 年份网格（3x3 中间为当前年，首尾为翻页按钮）
const yearGridCenter = ref(displayedMonth.value.year());

watch(showYearPicker, (v) => {
  if (v) {
    yearGridCenter.value = displayedMonth.value.year();
  }
});

const yearGridYears = computed(() => {
  const center = yearGridCenter.value;
  const arr: number[] = [];
  for (let offset = -3; offset <= 3; offset++) {
    arr.push(center + offset);
  }
  return arr;
});

function yearGridPrev() {
  // 翻到更早的一页（向前 7 年）
  yearGridCenter.value -= 7;
}

function yearGridNext() {
  // 翻到更晚的一页（向后 7 年）
  yearGridCenter.value += 7;
}

function toggleYearPicker() {
  showYearPicker.value = !showYearPicker.value;
  if (showYearPicker.value) showMonthPicker.value = false;
}

function toggleMonthPicker() {
  showMonthPicker.value = !showMonthPicker.value;
  if (showMonthPicker.value) showYearPicker.value = false;
}

function selectYear(y: number) {
  displayedMonth.value = displayedMonth.value.year(y);
  showYearPicker.value = false;
  changeMonth(displayedMonth.value.toDate());
}

function selectMonth(idx: number) {
  // idx is 0-based month index
  displayedMonth.value = displayedMonth.value.month(idx);
  showMonthPicker.value = false;
  changeMonth(displayedMonth.value.toDate());
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node;
  if (!monthPickerRef.value) return;
  if (!monthPickerRef.value.contains(target)) {
    showYearPicker.value = false;
    showMonthPicker.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

// 已存在日记的日期
const existDailyNotesMap = ref(new Map());
// 防止重复点击导致二次打开/创建
const processingDates = new Set<string>();
// 选中的日期
const selectedDate = ref<string | null>(null);

// ===== 计算属性 =====

/**
 * 获取当月的周列表
 */
const monthWeeks = computed(() => {
  const month = displayedMonth.value;
  const firstDay = month.clone().startOf('month');
  const lastDay = month.clone().endOf('month');

  // 根据 weekStart 设置确定周的开始日期 (0=Sunday, 1=Monday, etc)
  const startDay = parseInt(weekStart.value || '0', 10);
  
  // 计算第一天是周几，然后回退到周开始
  let currentDate = firstDay.clone();
  const firstDayOfWeek = currentDate.day(); // 0-6 (Sunday-Saturday)
  
  // 计算需要回退的天数
  let daysToSubtract = (firstDayOfWeek - startDay + 7) % 7;
  currentDate = currentDate.subtract(daysToSubtract, 'day');

  // 生成所有周
  const weeks: Array<{ weekNum: number; days: any[] }> = [];
  const lastDayValue = lastDay.valueOf();

  // 持续添加周，直到超过当月最后一天
  while (currentDate.valueOf() <= lastDayValue) {
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      weekDays.push(currentDate.clone());
      currentDate = currentDate.add(1, 'day');
    }

    // 计算 ISO 周号（简单方法）
    // 获取该周中最后一天（通常是周日）
    const weekEndDay = weekDays[6];
    // 简单计算：距离年初的天数 / 7，加 1
    const yearStart = weekEndDay.clone().startOf('year');
    const dayOfYear = weekEndDay.diff(yearStart, 'day') + 1;
    const isoWeekNum = Math.ceil(dayOfYear / 7);

    weeks.push({
      weekNum: isoWeekNum,
      days: weekDays
    });

    // 防止无限循环（最多10周）
    if (weeks.length > 10) break;
  }

  return weeks;
});

/**
 * 日期列标题（星期一到星期日等）
 */
const dayNames = computed(() => {
  const startDay = parseInt(weekStart.value || '0', 10);
  // 中文短名（0=Sun .. 6=Sat）
  const chineseDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dayNameArray = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
    const index = (startDay + i) % 7;
    if (localeType && localeType.value === 'zh_CN') {
      result.push(chineseDays[index]);
    } else {
      result.push(dayNameArray[index].toUpperCase());
    }
  }
  
  return result;
});

const todayLabel = computed(() => {
  if (localeType && localeType.value === 'zh_CN') return '今';
  if (localeType && typeof localeType.value === 'string' && localeType.value.startsWith('en')) return 'TODAY';
  return (locale && locale.value && locale.value.datePicker && locale.value.datePicker.today) || 'Today';
});

const refreshTitle = computed(() => {
  if (localeType && localeType.value === 'zh_CN') return '刷新';
  return 'Refresh';
});

async function refreshExistDates() {
  // show a brief notification while refreshing
  try {
    await api.pushMsg(formatMsg('refreshing'));
  } catch (e) {
    // ignore pushMsg errors
  }

  try {
    await refreshSql();
  } catch (e) {
    // ignore refreshSql errors, still attempt to reload
  }

  await getExistDate(thisPanelDate.value);
}

// ===== 方法 =====

function prevMonth() {
  displayedMonth.value = displayedMonth.value.subtract(1, 'month');
  changeMonth(displayedMonth.value);
}

function nextMonth() {
  displayedMonth.value = displayedMonth.value.add(1, 'month');
  changeMonth(displayedMonth.value);
}

function clickToday() {
  displayedMonth.value = dayjs();
  changeMonth(dayjs().toDate());
  openDailyNote(dayjs().toDate());
}

/**
 * 获取日期的 CSS 类
 */
function getDayClasses(date: any) {
  const dateStr = date.format('YYYY-MM-DD');
  const isOtherMonth = !date.isSame(displayedMonth.value, 'month');
  const isToday = date.isSame(dayjs(), 'day');
  const isWeekend = [0, 6].includes(date.day());
  const hasNote = existDailyNotesMap.value.has(dateStr);
  const isSelected = selectedDate.value === dateStr && !isOtherMonth;

  return {
    'other-month': isOtherMonth,
    'today': isToday,
    'weekend': isWeekend,
    'has-note': hasNote,
    'selected': isSelected
  };
}

/**
 * 判断列是否是周末（周六/周日）
 */
function isWeekendColumn(index: number): boolean {
  const startDay = parseInt(weekStart.value || '0', 10);
  const dayOfWeek = (startDay + index) % 7;
  return dayOfWeek === 0 || dayOfWeek === 6; // 0=Sunday, 6=Saturday
}

/**
 * 打开或创建日报
 */
async function openDailyNote(date: Date) {
  const d = dayjs(date);
  const dateStr = d.format('YYYY-MM-DD');
  const isOtherMonth = !d.isSame(displayedMonth.value, 'month');
  
  // 如果是点击了非本月日期，跳转到该月
  if (isOtherMonth) {
    displayedMonth.value = d;
    await changeMonth(d.toDate());
  }

  selectedDate.value = dateStr;

  if (!notebook.value) {
    await api.pushErrMsg(formatMsg('notNoteBook'));
    return;
  }

  // 如果日报已存在，直接打开
  if (existDailyNotesMap.value.has(dateStr)) {
    openDoc(existDailyNotesMap.value.get(dateStr));
    return;
  }

  // 防止重复点击
  if (processingDates.has(dateStr)) {
    return;
  }
  processingDates.add(dateStr);

  try {
    // 显示确认对话框
    const promptMsg = `${dateStr} ${i18n.value.msg.confirmCreateDailyNote}`;
    const ok = await confirmDialogRef.value.showConfirm(promptMsg);

    if (!ok) {
      processingDates.delete(dateStr);
      return;
    }

    // 创建日报
    try {
      const dailyNote = await notebook.value.createDailyNote(d.toDate());
      if (!dailyNote || !dailyNote.id) {
        // creation failed or returned invalid id
        await api.pushErrMsg(formatMsg('createDailyNoteFailed'));
        return;
      }
      const { id } = dailyNote;
      openDoc(id); // 打开新建的日记
      existDailyNotesMap.value.set(dateStr, id);
      // notify success briefly
      await api.pushMsg(formatMsg('createdDailyNote'), 2000);
    } catch (e) {
      console.error('[calendar] createDailyNote error', e);
      await api.pushErrMsg(formatMsg('createDailyNoteFailed'));
    }
  } finally {
    processingDates.delete(dateStr);
  }
}

/**
 * 打开或创建周报（如果支持）
 */
async function openWeeklyNote(week: { weekNum: number; days: dayjs.Dayjs[] }) {
  const repDay = week.days[Math.floor(week.days.length / 2)];
  if (!notebook.value) {
    await api.pushErrMsg(formatMsg('notNoteBook'));
    return;
  }

  // 如果笔记本支持按周的检索/创建函数，优先使用它们
  const nb: any = notebook.value as any;
  try {
    if (typeof nb.getExistWeeklyNote === 'function') {
      const id = await nb.getExistWeeklyNote(repDay.toDate(), week.weekNum);
      if (id) {
        openDoc(id);
        return;
      }
    }

    if (typeof nb.createWeeklyNote === 'function') {
      const id = await nb.createWeeklyNote(repDay.toDate(), week.weekNum);
      if (id) {
        openDoc(id);
        try {
          await api.pushMsg(formatMsg('createdWeeklyNote'), 2000);
        } catch (e) {
          // ignore notification errors
        }
        return;
      }
    }

    // fallback: not supported yet
    await api.pushMsg(formatMsg('weeklyPathNotSet'), 4000);
  } catch (e) {
    console.error('[calendar] openWeeklyNote error', e);
    await api.pushErrMsg(formatMsg('failedToCreateWeeklyNote'));
  }
}

/**
 * 更改月份时加载日期数据
 */
async function changeMonth(date: Date) {
  thisPanelDate.value = date;
  await getExistDate(date);
}

/**
 * 获取当月已存在的日报日期
 */
async function getExistDate(date: Date) {
  if (!notebook.value) {
    return;
  }
  const existDailyNotes = await notebook.value.getExistDailyNote(date);
  if (!existDailyNotes) {
    return;
  }
  // clear previous map first to reflect latest state
  existDailyNotesMap.value.clear();
  for (const { id, dateStr } of existDailyNotes) {
    existDailyNotesMap.value.set(dateStr, id);
  }
}

// ===== 侦听器 =====

watch(notebook, notebook => {
  existDailyNotesMap.value.clear();
  if (notebook) {
    getExistDate(thisPanelDate.value);
  }
});

watch(displayedMonth, (newMonth) => {
  thisPanelDate.value = newMonth.toDate();
});

// 监听思源笔记事件，刷新日期列表
eventBus.value?.on('ws-main', async ({ detail }) => {
  if (!notebook.value) {
    return;
  }
  const { cmd } = detail;
  if (['removeDoc', 'createdailynote'].includes(cmd)) {
    await refreshSql();
    await getExistDate(thisPanelDate.value);
  }
});

// 初始化
getExistDate(new Date());
</script>

<style scoped lang="less">
.siyuan-calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 6px; /* reduce horizontal whitespace */
  user-select: none;
}

// 导航栏
.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  margin-bottom: 8px;
  padding: 2px 4px;
  border-radius: 4px;
  background-color: var(--b3-theme-surface);
  gap: 8px;

  .nav-btn {
    padding: 2px 2px;
    border: none;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    min-width: 12px;
    font-weight: 700;
    transition: background-color 0.2s;

    &:hover {
      background: var(--b3-theme-surface-hover);
    }

    &:active {
      opacity: 0.7;
    }
  }

  .nav-center {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 auto;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .month-title {
    flex: 1;
    min-width: 0; /* allow to shrink when space is tight */
    text-align: center;
    font-weight: 500;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }

  .today-btn {
    padding: 2px 2px;
    border: 1px solid var(--b3-theme-primary);
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    min-width: 20px;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.9;
    }

    &:active {
      opacity: 0.8;
    }
  }

  .refresh-btn {
    padding: 2px 2px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    min-width: 20px;
    transition: opacity 0.2s;
    margin-left: 6px;

    &:hover { opacity: 0.9; }
    &:active { opacity: 0.8; }
  }
}

// 日历表格
.calendar-table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  flex: 1;
  border: none;
  border-radius: 4px;
  overflow: hidden;
  position: relative;

  thead {
    /* Use same background as week header for consistency */
    background-color: var(--b3-theme-surface);
    border-bottom: 3px solid var(--b3-theme-primary);
    position: relative;
    z-index: 3;

    th {
      padding: 2px 4px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
      text-transform: uppercase;
      letter-spacing: 0.1px;
      border: none;
      height: 20px;
      line-height: 20px;

      &.weekend-header {
        color: #e74c3c;
        font-weight: bold;
      }
    }
  }

  tbody {
    td {
      padding: 0;
      height: 42px;
      min-height: 42px;
      vertical-align: middle;
      position: relative;
      border: none;
    }
  }
}

// 周号列样式
.week-header {
  /* 与其他列等宽，移除固定宽度 */
  background-color: var(--b3-theme-surface);
  border-bottom: 3px solid var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  text-align: center;
  padding: 0;
}

.week-cell {
  /* 与其他列等宽，使用右边框作为分割线 */
  background-color: var(--b3-theme-surface);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-weight: 500;
  font-size: 12px;
  color: var(--b3-theme-primary);

}

/* 周号悬停效果：字体加粗 */
.week-cell:hover .week-num,
.week-cell:hover .week-num-btn {
  font-weight: 800 !important;
}

/* 周号悬停覆盖层（与日期区悬停效果一致） */
.week-cell::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: var(--b3-theme-primary);
  opacity: 0;
  transition: opacity 0.16s ease;
  z-index: 0;
}
.week-cell:hover::after {
  opacity: 0.08;
}
.week-cell > * {
  position: relative;
  z-index: 1;
}

/* 使用表格内侧边框作为周列与日期列之间的分隔线 */
.calendar-table thead tr > .week-header + th,
.calendar-table tbody tr > .week-cell + td {
  border-left: 2px solid var(--b3-theme-primary) !important;
}

.calendar-table td, .calendar-table th {
  padding-left: 6px; /* ensure border visible and not overlapped */
}

.week-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--b3-theme-primary);
  font-weight: 600;
}

.week-num-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  color: var(--b3-theme-primary);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

/* 竖直分割线（可见性更好，非表格边框） */
/* 移除绝对定位分割线，改用周号列右边框展示分割 */

// 周行悬停效果
.week-row {
  &:hover .day-content {
    background-color: var(--b3-theme-surface-hover);
  }
}

// 日期单元格
.day-cell {
  background-color: var(--b3-theme-surface);
  transition: background-color 0.2s;
  cursor: pointer;

  &.other-month {
    opacity: 0.6;
    background-color: var(--b3-theme-background);
  }

  &.weekend {
    background-color: rgba(255, 0, 0, 0.05);
  }

  &.today {
    .day-number {
      border: 2px solid var(--b3-theme-primary);
      border-radius: 3px;
      color: var(--b3-theme-primary);
      font-weight: bold;
      background-color: rgba(51, 97, 255, 0.05);
    }
  }

  &.selected {
    .day-number {
      border: 2px solid #2dc8a0;
      border-radius: 3px;
      color: #2dc8a0;
      font-weight: bold;
      background-color: rgba(45, 200, 160, 0.1);
    }
  }

  &.has-note {
    .day-marker {
      color: var(--b3-theme-accent);
    }
  }
}

// 日期内容
.day-content {
  position: relative;
  padding: 4px 4px;
  height: 100%;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.16s ease;
  border-radius: 6px;
  box-sizing: border-box; /* include padding in height calculation so overlay matches cell */
  overflow: hidden; /* prevent overlay from overflowing the cell */

  /* 覆盖层：在原背景上添加半透明主色覆盖，不影响子元素文字 */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: var(--b3-theme-primary);
    opacity: 0; /* 默认不显示 */
    transition: opacity 0.16s ease;
    z-index: 0;
  }

  /* 悬停时显示覆盖层并加粗文字；不再提升或产生阴影 */
  &:hover::after {
    opacity: 0.08; /* 半透明覆盖强度：可根据需要微调 */
  }

  /* 让内部文本与标记置于覆盖层之上 */
  > * {
    position: relative;
    z-index: 1;
  }

  /* 悬停时加粗日期数字 */
  &:hover .day-number {
    font-weight: 700;
  }
}

// 日期数字
.day-number {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  box-sizing: border-box;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

// 存在标记（小点）
.day-marker {
  font-size: 14px;
  color: var(--b3-theme-accent);
  line-height: 1;
  height: 14px;
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0px;
}

// 空标记（用于占位）
.day-marker-empty {
  visibility: hidden;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0px;
}

/* 年月选择下拉样式 */
.picker-dropdown {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  z-index: 20;
  max-height: 300px;
  overflow: auto;
  box-shadow: 0 6px 12px rgba(0,0,0,0.12);
}

.month-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.month-title-part {
  position: relative; /* 定位基准 */
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
.month-title-part:hover { background: var(--b3-theme-surface-hover); }
.month-title-sep { color: var(--b3-theme-on-surface); }

/* 年份和月份样式：加粗，年份使用主题主色 */
.month-title-part.year-part {
  font-weight: 700;
  color: var(--b3-theme-primary);
}
.month-title-part.month-part {
  font-weight: 700;
}

/* 年份选择 3x3 网格样式 */
.year-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 6px;
}
.year-item {
  padding: 6px 8px;
  text-align: center;
  cursor: pointer;
  border-radius: 4px;
  color: var(--b3-theme-on-surface);
  background: transparent;
  font-weight: 600;
}
.year-item:hover {
  background: var(--b3-theme-surface-hover);
}
.year-item.current-year {
  color: var(--b3-theme-primary);
  background: rgba(45, 97, 255, 0.06);
  box-shadow: none;
}
.year-item.year-nav {
  font-weight: 700;
  color: var(--b3-theme-on-surface);
}

/* 月份选择 4x3 网格样式 */
.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 6px;
}
.month-item {
  padding: 6px 8px;
  text-align: center;
  cursor: pointer;
  border-radius: 4px;
  color: var(--b3-theme-on-surface);
  background: transparent;
  font-weight: 600;
}
.month-item:hover {
  background: var(--b3-theme-surface-hover);
}
</style>

<!-- 全局覆盖 Arco Tabs 内容顶部间距 -->
<style>
  .arco-tabs-content {
    padding-top: 6px !important;
  }
</style>
