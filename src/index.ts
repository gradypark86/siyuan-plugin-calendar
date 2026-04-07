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

      // Path-required guard for periodic notes:
      // if enabled but path is empty, force switch off to keep state valid.
      if (weeklyEnabled.value && !String(weeklyPath.value || '').trim()) {
        weeklyEnabled.value = false;
      }
      if (monthlyEnabled.value && !String(monthlyPath.value || '').trim()) {
        monthlyEnabled.value = false;
      }
      if (yearlyEnabled.value && !String(yearlyPath.value || '').trim()) {
        yearlyEnabled.value = false;
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
        const weeklyPathValue = String(weeklyPath.value || '').trim();
        const monthlyPathValue = String(monthlyPath.value || '').trim();
        const yearlyPathValue = String(yearlyPath.value || '').trim();

        let weeklyEnabledValue = Boolean(weeklyEnabled.value);
        let monthlyEnabledValue = Boolean(monthlyEnabled.value);
        let yearlyEnabledValue = Boolean(yearlyEnabled.value);
        const autoDisabled: string[] = [];
        const weeklyPathLabel = i18n.value.weekly?.pathLabel || 'Weekly notes path';
        const monthlyPathLabel = i18n.value.monthly?.pathLabel || 'Monthly notes path';
        const yearlyPathLabel = i18n.value.yearly?.pathLabel || 'Yearly notes path';

        if (weeklyEnabledValue && !weeklyPathValue) {
          weeklyEnabledValue = false;
          weeklyEnabled.value = false;
          autoDisabled.push(weeklyPathLabel);
        }
        if (monthlyEnabledValue && !monthlyPathValue) {
          monthlyEnabledValue = false;
          monthlyEnabled.value = false;
          autoDisabled.push(monthlyPathLabel);
        }
        if (yearlyEnabledValue && !yearlyPathValue) {
          yearlyEnabledValue = false;
          yearlyEnabled.value = false;
          autoDisabled.push(yearlyPathLabel);
        }

        if (autoDisabled.length > 0) {
          const msgTpl = i18n.value.msg?.periodicPathAutoDisabled
            || 'Detected empty storage paths and automatically disabled related toggles: {items}';
          showMessage(msgTpl.replace('{items}', autoDisabled.join('、')));
        }

        const saveObj: any = {
          position: position.value,
          weekStart: Number(weekStart.value),
          showWeekNum: showWeekNum.value,
          weeklyEnabled: weeklyEnabledValue,
          weeklyPath: weeklyPathValue,
          weeklyTemplatePath: weeklyTemplatePath.value,
          monthlyEnabled: monthlyEnabledValue,
          monthlyPath: monthlyPathValue,
          monthlyTemplatePath: monthlyTemplatePath.value,
          yearlyEnabled: yearlyEnabledValue,
          yearlyPath: yearlyPathValue,
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
