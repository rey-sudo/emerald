<template>
  <div
    ref="containerRef"
    class="split-container"
    :class="{ 'is-dragging': isDragging }"
    :style="{ visibility: isMounted ? 'visible' : 'hidden' }"
  >
    <!-- Left Panel -->
    <div
      class="split-panel split-panel--left"
      :style="{ width: clampedWidth + 'px', minWidth: minWidth + 'px' }"
    >
      <slot name="left">Left content</slot>
    </div>

    <!-- Divider -->
    <div
      class="split-divider"
      :class="{ 'split-divider--active': isDragging }"
      @mousedown.prevent="startDragging"
      @touchstart.prevent="startDragging"
      role="separator"
      aria-label="Resize panels"
      aria-orientation="vertical"
      tabindex="0"
      @keydown="onKeyDown"
    >
      <div class="split-divider__handle">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>

    <!-- Right Panel -->
    <div class="split-panel split-panel--right">
      <slot name="right">Right content</slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  initialWidth: {
    type: [Number, String],
    default: "50%",
  },
  minWidth: {
    type: Number,
    default: 120,
  },
  maxWidth: {
    type: Number,
    default: Infinity,
  },
  /** Paso en px al usar teclado (← →) */
  keyStep: {
    type: Number,
    default: 20,
  },
});

// ─── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits(["update:width", "drag-start", "drag-end"]);

// ─── Estado ───────────────────────────────────────────────────────────────────
const containerRef = ref(null);
const leftWidth = ref(0);
const isDragging = ref(false);
const isMounted = ref(false);
// ─── Inicialización ───────────────────────────────────────────────────────────
onMounted(() => {
  if (
    typeof props.initialWidth === "string" &&
    props.initialWidth.endsWith("%")
  ) {
    const pct = parseFloat(props.initialWidth) / 100;
    leftWidth.value = containerRef.value.offsetWidth * pct;
  } else {
    leftWidth.value = Number(props.initialWidth);
  }
  isMounted.value = true;
});

// Ancho efectivo respetando los límites
const clampedWidth = computed(() => {
  const containerW = containerRef.value?.offsetWidth ?? Infinity;
  const effectiveMax = Math.min(props.maxWidth, containerW - 60); // 60 = margen mínimo para panel derecho
  return Math.min(Math.max(leftWidth.value, props.minWidth), effectiveMax);
});

// ─── Drag (mouse + touch) ─────────────────────────────────────────────────────
const getClientX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);

const startDragging = (e) => {
  isDragging.value = true;
  emit("drag-start", clampedWidth.value);

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDragging);
  document.addEventListener("touchmove", onDrag, { passive: false });
  document.addEventListener("touchend", stopDragging);
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  e.preventDefault();

  const rect = containerRef.value.getBoundingClientRect();
  leftWidth.value = getClientX(e) - rect.left;
  emit("update:width", clampedWidth.value);
};

const stopDragging = () => {
  isDragging.value = false;
  emit("drag-end", clampedWidth.value);
  removeListeners();
};

const removeListeners = () => {
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDragging);
  document.removeEventListener("touchmove", onDrag);
  document.removeEventListener("touchend", stopDragging);
};

// ─── Teclado ──────────────────────────────────────────────────────────────────
const onKeyDown = (e) => {
  if (e.key === "ArrowLeft") leftWidth.value -= props.keyStep;
  if (e.key === "ArrowRight") leftWidth.value += props.keyStep;
};

// ─── Limpieza ─────────────────────────────────────────────────────────────────
onBeforeUnmount(removeListeners);
</script>

<style scoped>
/* ─── Layout base ─────────────────────────────────────────────────────────── */
.split-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none; /* evita selección de texto al arrastrar */
}

/* Mientras arrastra, bloquea selección en TODO el documento */
.split-container.is-dragging * {
  user-select: none;
}

/* ─── Paneles ──────────────────────────────────────────────────────────────── */
.split-panel {
  height: 100%;
  overflow: auto;
}

.split-panel--left {
  flex-shrink: 0;
}

.split-panel--right {
  flex: 1;
  min-width: 0; /* evita overflow en flexbox */
}

/* ─── Divider ──────────────────────────────────────────────────────────────── */
.split-divider {
  flex-shrink: 0;
  position: relative;
  width: 6px;
  cursor: col-resize;
  background: var(--ui-bg-muted);
  transition:
    background 0.15s ease,
    width 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.split-divider:hover,
.split-divider:focus-visible,
.split-divider--active {
  background: var(--ui-bg-accented);
}

/* Área de click más grande que el visual (hit-slop) */
.split-divider::before {
  content: "";
  position: absolute;
  inset: 0 -6px;
  cursor: col-resize;
}

/* Tres líneas de agarre ─────────────────────────────────────────────────── */
.split-divider__handle {
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.split-divider__handle span {
  display: block;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #9e9e9e;
  transition: background 0.15s ease;
}

.split-divider:hover .split-divider__handle span,
.split-divider--active .split-divider__handle span {
  background: #616161;
}
</style>
