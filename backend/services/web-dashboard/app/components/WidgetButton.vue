<script setup lang="ts">
// Emerald
// Copyright (C) 2026 Juan José Caballero Rey - https://github.com/rey-sudo
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

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

<template>
  <button class="widget-button" @click="handleClick">
    <span class="icon">
      <UIcon :name="icon" class="size-6" />
    </span>
    <span class="text text-xs">{{ label }}</span>
  </button>
</template>

<style scoped>
.widget-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 0.25rem;

  width: 100%;

  padding: 1rem;
  border-radius: var(--ui-radius);

  background-color: var(--ui-bg-elevated);
  color: var(--ui-text-muted);

  border: none;
  cursor: pointer;

  font-weight: 500;

  transition: all 0.2s ease;
}

.widget-button:hover {
  background-color: var(--ui-bg-accented);
  color: var(--ui-text);
}

.text {
  line-height: 1;
  text-align: center;
}
</style>
