<template>
  <button
    class="b3-button b3-button--outline"
    @click="backfillAttrs"
    :disabled="processing"
    :title="text.hint"
  >
    {{ processing ? text.processing : text.button }}
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { i18n, currentNotebook } from '@/hooks/useSiYuan';
import * as api from '@/api/api';

const processing = ref(false);

const text = computed(() => {
  const t = i18n.value?.backfillAttrs || {};
  return {
    button: t.button || 'Backfill Attributes',
    processing: t.processing || 'Processing...',
    hint: t.hint || 'Periodic notes created after v0.5.0 already have document attributes automatically. Only notes created before v0.5.0 need backfilling. This scans the weekly/monthly/yearly notes in the current notebook and adds missing attributes, so the calendar can still find them even if you change their storage paths later.',
    success: t.success || 'Backfilled {total} notes: {weekly} weekly, {monthly} monthly, {yearly} yearly.',
    nothingToBackfill: t.nothingToBackfill || 'All periodic notes already have attributes. Nothing to backfill.',
    error: t.error || 'Failed to backfill attributes. Check console for details.',
    noNotebook: t.noNotebook || 'No notebook selected. Please select a notebook first.',
    notSupported: t.notSupported || 'Backfill is not supported by the current notebook instance.',
  };
});

async function backfillAttrs() {
  if (processing.value) return;

  if (!currentNotebook.value) {
    await api.pushErrMsg(text.value.noNotebook, 3000);
    return;
  }

  processing.value = true;

  try {
    const nb: any = currentNotebook.value as any;
    if (typeof nb.backfillPeriodicNoteAttrs !== 'function') {
      await api.pushErrMsg(text.value.notSupported, 3000);
      return;
    }

    const counts = await nb.backfillPeriodicNoteAttrs();
    const total = counts.weekly + counts.monthly + counts.yearly;

    if (total === 0) {
      await api.pushMsg(text.value.nothingToBackfill, 3000);
    } else {
      const msg = text.value.success
        .replace('{total}', String(total))
        .replace('{weekly}', String(counts.weekly))
        .replace('{monthly}', String(counts.monthly))
        .replace('{yearly}', String(counts.yearly));
      await api.pushMsg(msg, 5000);
    }
  } catch (e) {
    console.error('[backfillAttrs]', e);
    await api.pushErrMsg(text.value.error);
  } finally {
    processing.value = false;
  }
}
</script>

<style scoped>
.b3-button {
  min-width: 120px;
}
</style>
