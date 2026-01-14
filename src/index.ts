import App from './App.vue';
import { createApp } from 'vue';
import { Plugin, Menu, Setting, getFrontend } from 'siyuan';
import { app, i18n, isMobile, eventBus, position, weekStart, showWeekNum, weeklyEnabled, weeklyPath, weeklyTemplatePath } from './hooks/useSiYuan';
import SySelect from './lib/SySelect.vue';
import WeekStartSelect from './lib/WeekStartSelect.vue';
import ShowWeekNumToggle from './lib/ShowWeekNumToggle.vue';
import WeeklySettings from './lib/WeeklySettings.vue';
import WeeklyNoteGroup from './lib/WeeklyNoteGroup.vue';
import './index.less';
import showMessage from 'siyuan';

const STORAGE_NAME = 'arco-calendar-entry';

export default class ArcoCalendarPlugin extends Plugin {
  private topEle!: HTMLElement;
  private menuEle!: HTMLElement;

  onload() {
    i18n.value = this.i18n;
    app.value = this.app;
    eventBus.value = this.eventBus;
    isMobile.value = ['mobile', 'browser-mobile'].includes(getFrontend());
    this.init();
  }

  onunload() {
    console.log(this.i18n.byePlugin);
    this.topEle?.remove();
    this.menuEle?.remove();
  }

  private async init() {
    const data = await this.loadData(STORAGE_NAME);
    if (!data) {
      await this.saveData(STORAGE_NAME, { position: 'top-left', weekStart: 1, showWeekNum: false, weeklyEnabled: false, weeklyPath: '', weeklyTemplatePath: '' });
      await this.loadData(STORAGE_NAME);
      position.value = 'top-left';
      weekStart.value = 1;
      showWeekNum.value = false;
      weeklyEnabled.value = false;
      weeklyPath.value = '';
      weeklyTemplatePath.value = '';
    } else {
      position.value = data.position;
      if (data.weekStart !== undefined) {
        weekStart.value = Number(data.weekStart);
      }
      if (data.showWeekNum !== undefined) {
        showWeekNum.value = Boolean(data.showWeekNum);
      }
      if (data.weeklyEnabled !== undefined) {
        weeklyEnabled.value = Boolean(data.weeklyEnabled);
      }
      if (data.weeklyPath !== undefined) {
        weeklyPath.value = String(data.weeklyPath);
      }
      if (data.weeklyTemplatePath !== undefined) {
        weeklyTemplatePath.value = String(data.weeklyTemplatePath);
      }
    }
    if (position.value === 'top-left') {
      this.addTopItem('left');
    } else if (position.value === 'top-right') {
      this.addTopItem('right');
    } else if (position.value === 'dock') {
      this.addDockItem();
    }
    this.initSetting();
  }
  
  private initSetting() {
    this.setting = new Setting({
      height: 'auto',
      width: '500px',
      confirmCallback: async () => {
        const saveObj: any = {
          position: position.value,
          weekStart: Number(weekStart.value),
          showWeekNum: showWeekNum.value,
          weeklyEnabled: weeklyEnabled.value,
          weeklyPath: weeklyPath.value,
          weeklyTemplatePath: weeklyTemplatePath.value,
        };
        await this.saveData(STORAGE_NAME, saveObj);
        window.location.reload();
      },
    });
    const selectEle = document.createElement('div');
    createApp(SySelect).mount(selectEle);
    this.setting.addItem({
      title: i18n.value.position?.title || 'Position',
      actionElement: selectEle,
    });

    // Week start select (separate setting item, aligned)
    const weekStartEle = document.createElement('div');
    createApp(WeekStartSelect).mount(weekStartEle);
    this.setting.addItem({
      title: i18n.value.weekStart?.title || 'Week starts on',
      actionElement: weekStartEle,
    });

    // Show week number toggle
    const showWeekNumEle = document.createElement('div');
    createApp(ShowWeekNumToggle).mount(showWeekNumEle);
    this.setting.addItem({
      title: i18n.value.showWeekNum?.title || 'Show week number',
      actionElement: showWeekNumEle,
    });

    // Weekly notes enable toggle (standard titled setting)
    const weeklyEnabledEle = document.createElement('div');
    createApp(WeeklySettings).mount(weeklyEnabledEle);
    this.setting.addItem({
      title: i18n.value.weekly?.enable || 'Enable weekly notes',
      actionElement: weeklyEnabledEle,
    });

    // Integrated Weekly Notes Settings
    const weeklyGroupEle = document.createElement('div');
    weeklyGroupEle.style.width = '100%';
    createApp(WeeklyNoteGroup).mount(weeklyGroupEle);
    this.setting.addItem({
      title: '', // No title - let the component use full width
      actionElement: weeklyGroupEle,
    });
  }

  private addTopItem(direction: 'left' | 'right') {
    this.topEle = this.addTopBar({
      icon: 'iconCalendar',
      title: this.i18n.openCalendar,
      position: direction,
      callback: () => {
        let rect = this.topEle.getBoundingClientRect();
        // 如果被隐藏，则使用更多按钮
        if (rect.width === 0) {
          rect = document.querySelector('#barMore')!.getBoundingClientRect();
        }
        const menu = new Menu('Calendar');
        menu.addItem({ element: this.menuEle });
        if (isMobile.value) {
          menu.fullscreen();
        } else {
          menu.open({
            x: rect[direction],
            y: rect.bottom,
            isLeft: direction !== 'left',
          });
        }
      },
    });
    this.menuEle = document.createElement('div');
    createApp(App).mount(this.menuEle);
  }

  private addDockItem() {
    const _plugin = this;
    this.addDock({
      config: {
        position: 'RightTop',
        size: { width: 300, height: 0 },
        icon: 'iconCalendar',
        title: _plugin.i18n.tabName,
      },
      data: {},
      type: 'dock_tab',
      init: dock => {
        createApp(App).mount(dock.element);
      },
    });
  }

    uninstall() {
        // 卸载插件时删除插件数据
        // Delete plugin data when uninstalling the plugin
        this.removeData(STORAGE_NAME).catch(e => {
            showMessage(`uninstall [${this.name}] remove data [${STORAGE_NAME}] fail: ${e.msg}`);
        });
    }
}
