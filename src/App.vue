<template>
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

async function init() {
  const { notebooks } = await lsNotebooks();
  const books = notebooks.filter((book: Notebook) => !book.closed);
  for (const book of books) {
    const cusNotebook = await CusNotebook.build(book);
    cusNotebooks.value.push(cusNotebook);
  }
  const storage = await request('/api/storage/getLocalStorage');
  if (cusNotebooks.value.map(book => book.id).includes(storage['local-dailynoteid'])) {
    selectNotebookId.value = storage['local-dailynoteid'];
  } else {
    selectNotebookId.value = undefined;
  }
}
init();

eventBus.value?.on('ws-main', async ({ detail }) => {
  const { cmd } = detail;
  if (['createnotebook', 'mount', 'unmount'].includes(cmd)) {
    await refreshSql();
    cusNotebooks.value = [];
    await init();
  }
});

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

// weekStart is managed by plugin settings; no local storage writes here.
</script>
