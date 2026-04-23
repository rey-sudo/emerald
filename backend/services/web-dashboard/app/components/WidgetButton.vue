<template>
  <button class="audio-btn" @click="handleClick">
    <span class="icon">
      <UIcon :name="icon" class="size-5" />
    </span>
    <span class="text">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  icon: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

function handleClick() {
  emit("click");
}
</script>

<style scoped>
.audio-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 6px;

  width: 120px;
  height: 90px;

  padding: 10px;
  border-radius: 16px;

  background-color: var(--ui-bg-muted);
  color: var(--ui-text-muted);

  border: none;
  cursor: pointer;

  font-size: 13px;
  font-weight: 500;

  transition: all 0.2s ease;
}

.audio-btn:hover {
  background-color: #e5e7eb;
  color: #374151;
}

.icon svg {
  width: 22px;
  height: 22px;
}

.text {
  font-size: 12px;
  line-height: 1;
  text-align: center;
}
</style>
