<template>
  <Calendar :notebook="notebook" />
</template>
<script lang="ts" setup>
import { toRefs } from 'vue';
import { CusNotebook } from '@/utils/notebook';
import Calendar from './Calendar.vue';

const props = defineProps<{ notebook: CusNotebook | undefined }>();
const { notebook } = toRefs(props);
</script>

<style scoped>
/* 所有样式已移至 Calendar.vue */
</style>
