<template>
  <div class="emerald-tabs-container">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="emerald-tab"
      :class="{ 'is-active': modelValue === tab.id }"
      @click="$emit('update:modelValue', tab.id)"
    >
      <span class="tab-title">{{ tab.label }}</span>

      <button
        class="tab-close-btn"
        @click.stop="$emit('close', tab.id)"
        title="Cerrar pestaña"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="active-indicator"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tabs: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: [String, Number],
    default: null,
  },
});

defineEmits(["update:modelValue", "close"]);
</script>

<style scoped>
.emerald-tabs-container {
  gap: 0.5rem;
  height: 100%;
  display: flex;
  padding-top: 0.25rem;
  user-select: none;
  -webkit-app-region: no-drag;
}

.emerald-tab {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.75rem;
  min-width: 120px;
  max-width: 200px;
  cursor: pointer;
  color: var(--ui-text-muted);
  font-size: 13px;
  border-radius: calc(var(--ui-radius) * 1);
  border-bottom-left-radius: initial;
  border-bottom-right-radius: initial;
  transition:
    background-color 0.2s,
    color 0.2s;
  border: 1px solid var(--ui-border);
  border-bottom: none;
  -webkit-app-region: no-drag;
}

.emerald-tab:hover {
  background-color: var(--ui-bg-accented);
  color: var(--ui-text);
}

.emerald-tab.is-active {
  background-color: var(--ui-bg);
  color: var(--ui-text);
}

.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
}

.tab-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: inherit;
  margin-left: 8px;
  border-radius: 4px;
  opacity: 0; /* Oculto por defecto */
  transition:
    opacity 0.2s,
    background-color 0.2s;
  -webkit-app-region: no-drag;
}

.emerald-tab:hover .tab-close-btn,
.emerald-tab.is-active .tab-close-btn {
  opacity: 1; /* Aparece al hacer hover o si está activa */
}

.tab-close-btn:hover {
  background-color: #3e3e3e;
  color: #ff5f56; /* Toque de color al cerrar */
}

/* Indicador visual de pestaña activa (opcional) */
.active-indicator {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: transparent;
}

.is-active .active-indicator {
  background-color: var(--ui-bg);
}
</style>
