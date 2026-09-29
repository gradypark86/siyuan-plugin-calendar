import { request } from '@/api/api';
import { app, currentNotebook, i18n } from '@/hooks/useSiYuan';
import {
  queryRecentPeriodicNotes,
  type PeriodicNoteKind,
  type RecentPeriodicNote,
} from '@/utils/notebook';

const SPEED_SWITCH_PLUGIN_NAME = 'siyuan-speed-switch';
const MODULE_ID = 'calendar-recent-periodic';
const MAX_ITEMS = 12;

type HomeDevice = 'desktop' | 'sidebar' | 'mobile';
type HomeAvailability = 'ready' | 'conditional' | 'external';

interface HomeModuleSource {
  pluginId: string;
  name: string;
  icon?: string;
  version?: string;
  homepage?: string;
  collection?: string;
  order?: number;
}

interface HomeModuleSnapshot {
  title?: string;
  items: Array<{ label: string; value: string }>;
}

interface HomeModuleOptions {
  moduleId: string;
  title: string;
  icon?: string;
  category?: string;
  availability?: HomeAvailability;
  supportedDevices?: HomeDevice[];
  sizes?: Array<'xs' | 'small' | 'medium' | 'tall' | 'wide' | 'large' | 'full'>;
  protocolVersion?: 1 | 2;
  description?: string;
  source?: HomeModuleSource;
  readOnly?: boolean;
  open?: () => void;
  read: (
    config: Record<string, unknown>,
    device: string,
    context?: { size?: string; signal?: AbortSignal },
  ) => HomeModuleSnapshot | Promise<HomeModuleSnapshot>;
}

interface SpeedSwitchPlugin {
  name?: string;
  registerHomeModule?: (options: HomeModuleOptions) => unknown;
  getHomeModules?: (device?: string) => Array<{ moduleId?: string }>;
}

let unregisterModule: (() => void) | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let pendingOpenCalendar: (() => void) | undefined;

// SiYuan may invoke plugin onload hooks in manifest order without waiting for
// a later plugin's asynchronous initialization. Calendar is currently often
// listed before LvSpeed Switch, so a single lookup can happen too early.
// Retry for a bounded period instead of polling forever or delaying Calendar.
const REGISTRATION_RETRY_DELAYS = [250, 750, 1500, 3000, 6000];

function getSpeedSwitchPlugin(): SpeedSwitchPlugin | undefined {
  const plugins = (app.value as unknown as { plugins?: unknown[] })?.plugins;
  if (!Array.isArray(plugins)) return undefined;

  const plugin = plugins.find(candidate => {
    return candidate && typeof candidate === 'object' && (candidate as { name?: unknown }).name === SPEED_SWITCH_PLUGIN_NAME;
  });
  return plugin as SpeedSwitchPlugin | undefined;
}

function isEnglishLocale(): boolean {
  const tabName = String((i18n.value as Record<string, unknown> | undefined)?.tabName || '');
  return tabName.toLowerCase() === 'calendar' || tabName.toLowerCase().includes('calendar');
}

function getWidgetTitle(): string {
  return isEnglishLocale() ? 'Calendar · Recent periodic notes' : 'Calendar · 近期周期笔记';
}

function getWidgetDescription(): string {
  return isEnglishLocale()
    ? 'Show attributed weekly, monthly, and yearly notes from the selected notebook.'
    : '显示当前选中笔记本中带有文档属性的周记、月记和年记。';
}

function getKindLabel(kind: PeriodicNoteKind): string {
  if (isEnglishLocale()) {
    return kind === 'weekly' ? 'Weekly' : kind === 'monthly' ? 'Monthly' : 'Yearly';
  }
  return kind === 'weekly' ? '周记' : kind === 'monthly' ? '月记' : '年记';
}

function formatPeriodKey(note: RecentPeriodicNote): string {
  if (note.kind === 'weekly' && /^\d{6}$/.test(note.key)) {
    return `${note.key.slice(0, 4)}-W${note.key.slice(4)}`;
  }
  if (note.kind === 'monthly' && /^\d{6}$/.test(note.key)) {
    return `${note.key.slice(0, 4)}-${note.key.slice(4)}`;
  }
  return note.key;
}

function toItem(note: RecentPeriodicNote): { label: string; value: string } {
  const period = formatPeriodKey(note);
  const label = `${getKindLabel(note.kind)} · ${note.title}${period ? ` (${period})` : ''}`;
  return { label: label.slice(0, 256), value: note.id };
}

async function readRecentNotes(limit: number): Promise<RecentPeriodicNote[]> {
  const selectedNotebook = currentNotebook.value;
  if (selectedNotebook) {
    return selectedNotebook.getRecentPeriodicNotes(limit);
  }

  // The Calendar dock may not have been opened yet. Fall back to SiYuan's
  // selected daily-note notebook so the optional widget does not depend on
  // the Calendar panel having been mounted first.
  try {
    const storage = await request('/api/storage/getLocalStorage');
    const notebookId = String(storage?.['local-dailynoteid'] || '').trim();
    return notebookId ? queryRecentPeriodicNotes(notebookId, limit) : [];
  } catch (error) {
    console.warn('[calendar] unable to resolve the selected notebook for home module', error);
    return [];
  }
}

function createHomeModuleOptions(openCalendar?: () => void): HomeModuleOptions {
  return {
    moduleId: MODULE_ID,
    title: getWidgetTitle(),
    description: getWidgetDescription(),
    icon: 'iconCalendar',
    category: 'plugin',
    availability: 'ready',
    supportedDevices: ['desktop', 'sidebar', 'mobile'],
    sizes: ['small', 'medium', 'wide', 'large', 'full'],
    protocolVersion: 2,
    source: {
      pluginId: 'siyuan-plugin-calendar',
      name: 'Calendar',
      icon: 'iconCalendar',
      version: '0.5.1',
      homepage: 'https://github.com/gradypark86/siyuan-plugin-calendar',
    },
    readOnly: true,
    // v0.16.x uses the presence of an open callback when deciding whether a
    // third-party module should be listed in its component store. Newer
    // hosts treat this as the optional failure-state action.
    open: () => openCalendar?.(),
    read: async (_config, device, context) => {
      // Keep the snapshot small on narrow surfaces. The host also applies its
      // own cache, timeout, and item limit.
      const size = context?.size;
      const sizeLimit = size === 'small' ? 4 : size === 'wide' ? 10 : size === 'large' ? 14 : size === 'full' ? 18 : MAX_ITEMS;
      const limit = device === 'mobile' || device === 'sidebar' ? Math.min(8, sizeLimit) : sizeLimit;
      try {
        const notes = await readRecentNotes(limit);
        return {
          title: getWidgetTitle(),
          items: notes.map(toItem),
        };
      } catch (error) {
        // A widget failure must not affect Calendar's own panel. Returning an
        // empty read-only snapshot also handles a notebook being unavailable
        // while SiYuan is switching notebooks.
        console.warn('[calendar] failed to read recent periodic notes for home module', error);
        return { title: getWidgetTitle(), items: [] };
      }
    },
  };
}

/** Register the optional Calendar provider when a compatible host is present. */
export function registerSpeedSwitchModule(openCalendar?: () => void): boolean {
  if (unregisterModule) return true;

  pendingOpenCalendar = openCalendar || pendingOpenCalendar;

  const plugin = getSpeedSwitchPlugin();
  if (typeof plugin?.registerHomeModule !== 'function') return false;

  try {
    const registration = plugin.registerHomeModule(createHomeModuleOptions(pendingOpenCalendar)) as
      | (() => void)
      | { registered?: boolean; unregister?: () => void }
      | undefined;

    // Some host versions return a no-op disposer even when validation fails.
    // Verify the provider is visible to the host before treating registration
    // as successful, otherwise the bounded retry would never run.
    if (registration && typeof registration === 'object' && registration.registered === false) {
      return false;
    }
    const listed = plugin.getHomeModules?.('desktop')?.some(module => module?.moduleId === MODULE_ID);
    if (listed === false) {
      if (typeof registration === 'function') registration();
      else registration?.unregister?.();
      return false;
    }

    if (typeof registration === 'function') {
      unregisterModule = registration;
      retryAttempt = 0;
      console.info('[calendar] registered recent periodic notes with LvSpeed Switch');
      return true;
    }
    if (registration && typeof registration.unregister === 'function') {
      unregisterModule = () => registration.unregister?.();
      retryAttempt = 0;
      console.info('[calendar] registered recent periodic notes with LvSpeed Switch');
      return true;
    }
  } catch (error) {
    // Optional integration failures must never prevent Calendar from loading.
    console.warn('[calendar] failed to register the speed-switch home module', error);
  }

  return false;
}

/**
 * Try registration now and, when the optional host is still loading, retry a
 * few times. The retry is deliberately bounded and is cancelled on unload.
 */
export function ensureSpeedSwitchModule(openCalendar?: () => void): boolean {
  pendingOpenCalendar = openCalendar || pendingOpenCalendar;
  if (registerSpeedSwitchModule(pendingOpenCalendar)) {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    return true;
  }

  if (retryTimer !== null) return false;
  if (retryAttempt >= REGISTRATION_RETRY_DELAYS.length) {
    console.warn('[calendar] LvSpeed Switch was not ready; recent periodic notes were not registered');
    return false;
  }

  const delay = REGISTRATION_RETRY_DELAYS[retryAttempt++];
  retryTimer = setTimeout(() => {
    retryTimer = null;
    ensureSpeedSwitchModule(pendingOpenCalendar);
  }, delay);
  return false;
}

/** Unregister the provider during Calendar unload or hot reload. */
export function unregisterSpeedSwitchModule(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
  pendingOpenCalendar = undefined;
  const dispose = unregisterModule;
  unregisterModule = null;
  try {
    dispose?.();
  } catch (error) {
    console.warn('[calendar] failed to unregister the speed-switch home module', error);
  }
}
