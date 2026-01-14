import { ref } from 'vue';
import type { App, I18N, EventBus } from 'siyuan';

export const app = ref<App>({ plugins: [], appId: '' });

export const i18n = ref<I18N>({});

export const isMobile = ref<boolean>(false);

export const eventBus = ref<EventBus>();

export const position = ref();
export const weekStart = ref<number>(1);
export const showWeekNum = ref<boolean>(false);
export const weeklyEnabled = ref<boolean>(false);
export const weeklyPath = ref<string>('');
export const weeklyTemplatePath = ref<string>('');
