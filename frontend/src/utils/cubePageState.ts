import { ref } from 'vue';

/**
 * Cube 二开：cube 独立详情页（/platform/cube-knowledge-bases/:kbId）激活状态。
 *
 * KnowledgeBase.vue 在进入/离开 cube 页时切换此标记（含组件卸载时复位）。
 * 用于不在 KnowledgeBase 子树内的全局挂载组件（如 manual-knowledge-editor）
 * 以及统一隐藏"智能助理"✨ 按钮的场景——provide/inject 无法覆盖全局挂载的
 * 兄弟组件，所以走模块级状态。
 */
export const cubePageActive = ref(false);
