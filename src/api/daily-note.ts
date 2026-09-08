/*
 * Copyright (c) 2023 by frostime. All Rights Reserved.
 * @Author       : frostime
 * @Date         : 2023-12-14 12:06:48
 * @FilePath     : /src/utils/daily-note.ts
 * @LastEditTime : 2023-12-14 12:44:40
 * @Source       : 
 */
import { openTab, openMobileFileById } from 'siyuan';
import * as serverApi from './api';
import { app, isMobile } from '@/hooks/useSiYuan';

/**
 * Format Date to yyyyMMdd
 * https://github.com/frostime/siyuan-dailynote-today/blob/main/src/func/dailynote/basic.ts
 * @param date date, default now
 * @param sep separator, default ''
 * @returns 
 */
export function formatDate(date?: Date, sep=''): string {
    date = date === undefined ? new Date() : date;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}${sep}${month < 10 ? '0' + month : month}${sep}${day < 10 ? '0' + day : day}`;
}

/**
 * 对 DailyNote 的自定义属性进行设置, custom-dailynote-yyyyMMdd: yyyyMMdd
 * https://github.com/frostime/siyuan-dailynote-today/blob/v1.3.0/src/func/dailynote/dn-attr.ts
 * @Ref https://github.com/siyuan-note/siyuan/issues/9807
 * @param doc_id 日记的 id
 */
export function setCustomDNAttr(doc_id: string, date?: Date): Promise<unknown> {
    const td = formatDate(date);
    const attr = `custom-dailynote-${td}`;
    // 构建 attr: td
    const attrs: { [key: string]: string } = {};
    attrs[attr] = td;
    return serverApi.setBlockAttrs(doc_id, attrs);
}

/**
 * 通用自定义属性写入，供周期笔记使用：
 * - custom-calendar-weekly-<YYYYWW>: 周记（YYYYWW 为周的 ISO 标识，如 202653）
 * - custom-calendar-monthly-<YYYYMM>: 月记
 * - custom-calendar-yearly-<YYYY>:   年记
 *
 * If the document already has a different attribute of the same type (e.g. two monthly keys),
 * remove the old one first to keep attributes clean.
 */
export async function setCustomAttr(doc_id: string, name: string, value: string): Promise<unknown> {
    const attrs: { [key: string]: string } = {};
    attrs[name] = value;
    return serverApi.setBlockAttrs(doc_id, attrs);
}

export async function setCustomWeeklyAttr(doc_id: string, weekKey: string): Promise<unknown> {
    const attrName = `custom-calendar-weekly-${weekKey}`;
    // Check if the doc already has a different weekly attribute and remove it
    try {
        const existing = await serverApi.getBlockAttrs(doc_id);
        for (const key of Object.keys(existing)) {
            if (key.startsWith('custom-calendar-weekly-') && key !== attrName) {
                await serverApi.setBlockAttrs(doc_id, { [key]: '' }); // empty value removes the attr
            }
        }
    } catch (e) {
        // ignore if getBlockAttrs fails
    }
    return setCustomAttr(doc_id, attrName, weekKey);
}

export async function setCustomMonthlyAttr(doc_id: string, monthKey: string): Promise<unknown> {
    const attrName = `custom-calendar-monthly-${monthKey}`;
    try {
        const existing = await serverApi.getBlockAttrs(doc_id);
        for (const key of Object.keys(existing)) {
            if (key.startsWith('custom-calendar-monthly-') && key !== attrName) {
                await serverApi.setBlockAttrs(doc_id, { [key]: '' });
            }
        }
    } catch (e) {
        // ignore
    }
    return setCustomAttr(doc_id, attrName, monthKey);
}

export async function setCustomYearlyAttr(doc_id: string, yearKey: string): Promise<unknown> {
    const attrName = `custom-calendar-yearly-${yearKey}`;
    try {
        const existing = await serverApi.getBlockAttrs(doc_id);
        for (const key of Object.keys(existing)) {
            if (key.startsWith('custom-calendar-yearly-') && key !== attrName) {
                await serverApi.setBlockAttrs(doc_id, { [key]: '' });
            }
        }
    } catch (e) {
        // ignore
    }
    return setCustomAttr(doc_id, attrName, yearKey);
}


export function openDoc(doc_id: DocumentId) {
    //打开文档
    if (isMobile.value === true) {
        openMobileFileById(app.value, doc_id, ['cb-get-all']);
    } else {
        openTab({
            app: app.value,
            doc: {
                id: doc_id,
                zoomIn: false
            }
        });
    }
}

