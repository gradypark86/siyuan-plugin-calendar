import App from './App.vue';
import { createApp } from 'vue';
import { Plugin, Menu, Setting, getFrontend } from 'siyuan';
import {
  app,
  i18n,
  isMobile,
  eventBus,
  position,
  weekStart,
  showWeekNum,
  weeklyEnabled,
  weeklyPath,
  weeklyTemplatePath,
  monthlyEnabled,
  monthlyPath,
  monthlyTemplatePath,
  yearlyEnabled,
  yearlyPath,
  yearlyTemplatePath,
} from './hooks/useSiYuan';
import SettingsTabs from './lib/SettingsTabs.vue';
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
      await this.saveData(STORAGE_NAME, {
        position: 'top-left',
        weekStart: 1,
        showWeekNum: false,
        weeklyEnabled: false,
        weeklyPath: '',
        weeklyTemplatePath: '',
        monthlyEnabled: false,
        monthlyPath: '',
        monthlyTemplatePath: '',
        yearlyEnabled: false,
        yearlyPath: '',
        yearlyTemplatePath: '',
      });
      await this.loadData(STORAGE_NAME);
      position.value = 'top-left';
      weekStart.value = 1;
      showWeekNum.value = false;
      weeklyEnabled.value = false;
      weeklyPath.value = '';
      weeklyTemplatePath.value = '';
      monthlyEnabled.value = false;
      monthlyPath.value = '';
      monthlyTemplatePath.value = '';
      yearlyEnabled.value = false;
      yearlyPath.value = '';
      yearlyTemplatePath.value = '';
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
      if (data.monthlyEnabled !== undefined) {
        monthlyEnabled.value = Boolean(data.monthlyEnabled);
      }
      if (data.monthlyPath !== undefined) {
        monthlyPath.value = String(data.monthlyPath);
      }
      if (data.monthlyTemplatePath !== undefined) {
        monthlyTemplatePath.value = String(data.monthlyTemplatePath);
      }
      if (data.yearlyEnabled !== undefined) {
        yearlyEnabled.value = Boolean(data.yearlyEnabled);
      }
      if (data.yearlyPath !== undefined) {
        yearlyPath.value = String(data.yearlyPath);
      }
      if (data.yearlyTemplatePath !== undefined) {
        yearlyTemplatePath.value = String(data.yearlyTemplatePath);
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
          monthlyEnabled: monthlyEnabled.value,
          monthlyPath: monthlyPath.value,
          monthlyTemplatePath: monthlyTemplatePath.value,
          yearlyEnabled: yearlyEnabled.value,
          yearlyPath: yearlyPath.value,
          yearlyTemplatePath: yearlyTemplatePath.value,
        };
        await this.saveData(STORAGE_NAME, saveObj);
        window.location.reload();
      },
    });

    // Tabbed settings: basic settings + periodic notes settings
    const settingsTabsEle = document.createElement('div');
    settingsTabsEle.style.width = '100%';
    createApp(SettingsTabs).mount(settingsTabsEle);
    this.setting.addItem({
      title: '',
      actionElement: settingsTabsEle,
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
