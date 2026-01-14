<template>
  <div v-if="isVisible" class="confirm-dialog-overlay">
    <div class="confirm-dialog-container">
      <div class="confirm-dialog-header">
        <span class="confirm-dialog-title">{{ title }}</span>
        <button class="b3-button b3-button--cancel" @click="handleCancel" style="padding: 0; width: 24px; height: 24px;">
          ×
        </button>
      </div>
      <div class="confirm-dialog-content">
        {{ message }}
      </div>
      <div class="confirm-dialog-footer">
        <button class="b3-button" @click="handleCancel">{{ cancelText }}</button>
        <button class="b3-button b3-button--primary" @click="handleConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isVisible = ref(false);
const message = ref('');
const title = ref('确认');
const confirmText = ref('确认');
const cancelText = ref('取消');
let resolveCallback: ((value: boolean) => void) | null = null;

// 暴露给外部使用的方法
function showConfirm(
  msg: string,
  opts?: {
    title?: string;
    confirmText?: string;
    cancelText?: string;
  }
): Promise<boolean> {
  return new Promise((resolve) => {
    message.value = msg;
    title.value = opts?.title || '确认';
    confirmText.value = opts?.confirmText || '确认';
    cancelText.value = opts?.cancelText || '取消';
    resolveCallback = resolve;
    isVisible.value = true;
  });
}

function handleConfirm() {
  isVisible.value = false;
  if (resolveCallback) {
    resolveCallback(true);
    resolveCallback = null;
  }
}

function handleCancel() {
  isVisible.value = false;
  if (resolveCallback) {
    resolveCallback(false);
    resolveCallback = null;
  }
}

// 按 Escape 关闭
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isVisible.value) {
    handleCancel();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

defineExpose({ showConfirm });
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.confirm-dialog-container {
  background: var(--b3-theme-surface);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  max-width: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.confirm-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.confirm-dialog-title {
  font-weight: 500;
  font-size: 14px;
  color: var(--b3-theme-on-surface);
}

.confirm-dialog-content {
  padding: 16px 20px;
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  flex: 1;
}

.confirm-dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.b3-button {
  padding: 4px 12px;
  font-size: 14px;
  border-radius: 2px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s;
}

.b3-button:hover {
  background: var(--b3-theme-surface-hover);
}

.b3-button--primary {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.b3-button--primary:hover {
  opacity: 0.9;
}

.b3-button--cancel {
  border: none;
  background: transparent;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
}

.b3-button--cancel:hover {
  background: var(--b3-theme-surface-hover);
}
</style>
