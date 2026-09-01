<template>
  <div ref="panelRootRef" class="calendar-panel-root" @mousedown.stop @click.stop @wheel.stop>
    <a-config-provider :locale="configLocale">
      <a-tabs style="width: 100%">
        <template #extra>
          <div style="display:flex; gap:8px; align-items:center;">
            <a-select
              v-model="selectNotebookId"
              :options="cusNotebooks"
              :field-names="{ value: 'id', label: 'name' }"
              :style="{ width: '160px', marginRight: '5px' }"
              :placeholder="i18n.placeholder"
              allow-search
              @popup-visible-change="handleNotebookDropdownVisibleChange"
              @mousedown.stop
              @click.stop
            >
            </a-select>
          </div>
        </template>
        <a-tab-pane key="1">
          <template #title> {{ i18n.tabName }} </template>
          <CalendarView :notebook="selectNotebook" />
        </a-tab-pane>
        <!-- <a-tab-pane key="2">
          </a-tab-pane> -->
      </a-tabs>
    </a-config-provider>
  </div>
</template>

<script lang="ts" setup>
import CalendarView from '@/components/CalendarView.vue';
import { Constants } from 'siyuan';
import { lsNotebooks, request, pushErrMsg } from '@/api/api';
import { useLocale, formatMsg } from '@/hooks/useLocale';
import { eventBus, i18n, weekStart } from '@/hooks/useSiYuan';
import { CusNotebook } from '@/utils/notebook';
import { refreshSql } from './api/utils';

const { locale, localeType } = useLocale();

const configLocale = computed(() => {
  try {
    const base = locale.value || {};
    return Object.assign({}, base, { weekStart: Number(weekStart.value) });
  } catch (e) {
    return locale.value;
  }
});

// Ensure dayjs global locale weekStart is updated so calendar components honor it
import dayjs from 'dayjs';
function updateDayjsLocale() {
  try {
    const raw = (localeType.value || 'zh_CN').replace('_', '-').toLowerCase();
    const keys = [raw, raw.split('-')[0]];
    const d = dayjs as any;
    if (d.Ls) {
      for (const k of keys) {
        if (d.Ls[k]) {
          const updated = Object.assign({}, d.Ls[k], { weekStart: Number(weekStart.value) });
          d.locale(updated);
          break;
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

watch([() => weekStart.value, () => localeType.value], updateDayjsLocale);

// run once on mount to ensure correct weekStart initially
updateDayjsLocale();

// 获取笔记本列表
const cusNotebooks = ref<CusNotebook[]>([]);
const selectNotebookId = ref<NotebookId | undefined>(undefined);
const selectNotebook = computed(() => cusNotebooks.value.find(book => book.id === selectNotebookId.value));
const panelRootRef = ref<HTMLElement | null>(null);
const dropdownWheelCleanupFns: Array<() => void> = [];
let initToken = 0;
let disposed = false;

function bindNotebookDropdownWheelFix() {
  const dropdowns = document.querySelectorAll('.arco-select-dropdown');
  if (!dropdowns.length) return;

  const dropdown = dropdowns[dropdowns.length - 1] as HTMLElement;
  if ((dropdown as any).__wheelFixed) return;

  const stopBubbleHandler = (e: Event) => {
    e.stopPropagation();
  };

  const wheelHandler = (e: WheelEvent) => {
    const target = e.target as HTMLElement | null;
    const scrollContainer =
      (target?.closest('.arco-virtual-list-holder') as HTMLElement | null) ||
      (target?.closest('.arco-scrollbar-container') as HTMLElement | null) ||
      (dropdown.querySelector('.arco-virtual-list-holder') as HTMLElement | null) ||
      (dropdown.querySelector('.arco-scrollbar-container') as HTMLElement | null) ||
      dropdown;

    const prevTop = scrollContainer.scrollTop;
    scrollContainer.scrollTop += e.deltaY;
    if (scrollContainer.scrollTop !== prevTop) {
      e.preventDefault();
    }
    e.stopPropagation();
  };

  dropdown.addEventListener('mousedown', stopBubbleHandler);
  dropdown.addEventListener('click', stopBubbleHandler);
  dropdown.addEventListener('wheel', wheelHandler, { passive: false });
  (dropdown as any).__wheelFixed = true;
  dropdownWheelCleanupFns.push(() => {
    dropdown.removeEventListener('mousedown', stopBubbleHandler);
    dropdown.removeEventListener('click', stopBubbleHandler);
    dropdown.removeEventListener('wheel', wheelHandler);
    delete (dropdown as any).__wheelFixed;
  });
}

function handleNotebookDropdownVisibleChange(visible: boolean) {
  if (!visible) return;
  nextTick(() => bindNotebookDropdownWheelFix());
}

async function init() {
  const token = ++initToken;
  const [{ notebooks }, storage] = await Promise.all([
    lsNotebooks(),
    request('/api/storage/getLocalStorage'),
  ]);
  const books = notebooks.filter((book: Notebook) => !book.closed);
  const loadedNotebooks = await Promise.all(books.map(book => CusNotebook.build(book)));
  if (disposed || token !== initToken) return;

  cusNotebooks.value = loadedNotebooks;
  if (loadedNotebooks.some(book => book.id === storage['local-dailynoteid'])) {
    selectNotebookId.value = storage['local-dailynoteid'];
  } else {
    selectNotebookId.value = undefined;
  }
}
void init();

const mainEventBus = eventBus.value;
const wsMainHandler = async ({ detail }: CustomEvent<any>) => {
  const { cmd } = detail;
  if (['createnotebook', 'mount', 'unmount'].includes(cmd)) {
    await refreshSql();
    await init();
  }
};
mainEventBus?.on('ws-main', wsMainHandler);

watch(selectNotebookId, async bookId => {
  if (!bookId) {
    await pushErrMsg(formatMsg('notNoteBook'));
    return;
  }
  const storage = await request('/api/storage/getLocalStorage');
  if (bookId !== storage['local-dailynoteid']) {
    await request('/api/storage/setLocalStorageVal', {
      app: Constants.SIYUAN_APPID,
      key: 'local-dailynoteid',
      val: bookId,
    });
  }
});

watch(selectNotebook, async notebook => {
  if (notebook) {
    await notebook.refreshWeeklyPathOverlap(new Date());
  }
});

// weekStart is managed by plugin settings; no local storage writes here.

onBeforeUnmount(() => {
  disposed = true;
  initToken += 1;
  mainEventBus?.off('ws-main', wsMainHandler);
  for (const cleanup of dropdownWheelCleanupFns) {
    cleanup();
  }
  dropdownWheelCleanupFns.length = 0;
});
</script>

<style scoped>
.calendar-panel-root {
  width: 100%;
}
</style>
