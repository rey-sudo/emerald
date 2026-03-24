<template>
  <div class="preview w-full">
    <div class="button-grid">
      <UButton
        v-for="(btn, index) in buttons"
        :key="index"
        :icon="btn.icon"
        size="lg"
        :color="btn.color"
        variant="outline"
        >{{ btn.label }}</UButton
      >
    </div>

    <div>
      <QuizQuestionFlow />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const buttons = ref([
  {
    label: "All",
    color: "neutral",
    icon: "i-lucide-menu",
  },
  {
    label: "Quiz Question",
    color: "success",
    icon: "i-lucide-book-open-check",
  },
  {
    label: "Concepts",
    color: "error",
    icon: "i-lucide-lightbulb",
  },
    {
    label: "Mind Map",
    color: "warning",
    icon: "i-lucide-brain",
  },
]);
</script>

<style lang="css" scoped>
.preview {
  display: flex;
  flex-direction: column;
}

.button-grid {
  background: var(--ui-bg);
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.grid-button {
  flex: 1 1 auto;
}
</style>
