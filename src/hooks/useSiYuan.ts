import { ref, shallowRef, computed } from 'vue';
import type { App, I18N, EventBus } from 'siyuan';
import type { CusNotebook } from '@/utils/notebook';

// SiYuan runtime instances use private methods and cannot be wrapped by Vue proxies.
export const app = shallowRef<App>({ plugins: [], appId: '' });

export const i18n = ref<I18N>({});

export const isMobile = ref<boolean>(false);

export const eventBus = shallowRef<EventBus>();

export const currentNotebook = shallowRef<CusNotebook | undefined>(undefined);

export const position = ref();
export const weekStart = ref<number>(1);
/** Week-numbering rule: 'calendar' (week containing Jan 1 is week 1) or 'iso' (ISO 8601). Default keeps historical behavior. */
export const weekNumRule = ref<'calendar' | 'iso'>('calendar');
/** ISO 8601 assumes Monday-start weeks, so it only takes effect when weekStart is 1. */
export const effectiveWeekRule = computed<'calendar' | 'iso'>(() =>
  weekNumRule.value === 'iso' && weekStart.value === 1 ? 'iso' : 'calendar'
);
export const showWeekNum = ref<boolean>(false);
export const weeklyEnabled = ref<boolean>(false);
export const autoCreateWeekly = ref<boolean>(false);
export const autoCreateWeeklyForced = ref<boolean>(false);
export const weeklyPath = ref<string>('');
export const weeklyTemplatePath = ref<string>('');
export const monthlyEnabled = ref<boolean>(false);
export const monthlyPath = ref<string>('');
export const monthlyTemplatePath = ref<string>('');
export const yearlyEnabled = ref<boolean>(false);
export const yearlyPath = ref<string>('');
export const yearlyTemplatePath = ref<string>('');
/** Hour (0-23) when a new calendar day starts. Before this time, "today" is still yesterday. Default 0 = midnight. */
export const dayRolloverHour = ref<number>(0);
/** Minute (0-59) paired with dayRolloverHour. Default 0. */
export const dayRolloverMinute = ref<number>(0);
/**
 * When true, ask for confirmation before creating a missing daily note.
 * Default true (opt-out): stays on until the user turns it off in Advanced settings.
 */
export const confirmCreateDailyNote = ref<boolean>(true);
