<template>
  <UContextMenu
    ref="contextMenuRef"
    size="md"
    :items="contextMenuItems"
    :ui="{
      content: 'w-48',
    }"
  >
    <div
      class="folder-card"
      :class="{ selected }"
      :data-id="folder.folder_id"
      @click="$emit('events', { name: 'click', data: $event })"
      @dblclick="$emit('events', { name: 'dblclick', data: $event })"
    >
      <div class="card-header">
        <UButton
          class="card-menu rounded-3xl ml-auto"
          color="neutral"
          variant="ghost"
          icon="lucide:ellipsis-vertical"
          size="sm"
          @click="openMenu"
        />
      </div>

      <div class="card-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 300 228"
          width="5rem"
        >
          <defs>
            <linearGradient id="fold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="white" stop-opacity="0.3" />
              <stop offset="100%" stop-color="white" stop-opacity="0" />
            </linearGradient>
          </defs>
          <rect
            x="0"
            y="28"
            width="300"
            height="200"
            rx="28"
            fill="var(--ui-primary)"
            opacity="1"
          />
          <rect
            x="0"
            y="28"
            width="300"
            height="200"
            rx="28"
            fill="url(#fold)"
            opacity="0.18"
          />
          <path
            d="M0 42 Q0 14 28 14 L96 14 Q120 14 124 28 L124 56 Q92 56 28 56 Q0 56 0 42 Z"
            fill="var(--ui-primary)"
            opacity="1"
          />
          <circle cx="265" cy="60" r="10" :fill="folder.color" opacity="1" />
        </svg>
      </div>

      <div class="card-bottom">
        <p class="card-title text-base">{{ folder.folder_name }}</p>
        <p class="card-subtle text-sm text-muted">{{ sourcesCount }} sources</p>
      </div>
    </div>
  </UContextMenu>
</template>

<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";

const props = defineProps({
  folder: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(["events"]);

const contextMenuRef = ref(null);

const sourcesCount = computed(() => props.folder.documents.length || 0);

const openMenu = (event: MouseEvent) => {
  const customEvent = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
  });

  if (event) {
    event?.currentTarget?.dispatchEvent(customEvent);
  }
};

const contextMenuItems = ref<ContextMenuItem[]>([
  {
    label: "Download",
    icon: "material-symbols:download-2-outline-rounded",
    onSelect: () => {
      emit("events", {
        name: "download",
        data: { id: props.folder.folder_id },
      });
    },
  },
  {
    label: "Rename",
    icon: "material-symbols:edit-outline-rounded",
    onSelect: () => {
      emit("events", {
        name: "update",
        data: { id: props.folder.folder_id },
      });
    },
  },
  {
    label: "Move to trash",
    icon: "material-symbols:restore-from-trash-outline-rounded",
    onSelect: () => {
      emit("events", {
        name: "delete",
        data: { id: props.folder.folder_id },
      });
    },
  },
]);
</script>

<style scoped>
.folder-card {
  width: 100%;
  border-radius: calc(var(--ui-radius) * 2);
  background: var(--ui-bg-muted);
  border: 1px solid transparent;
  padding: 0.75rem;
  height: 200px;
  padding-right: 0.25rem;
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  flex-direction: column;
  user-select: none;
  transition: 0.3s ease;
  justify-content: space-between;
}

.folder-card:hover {
  background: var(--ui-bg-accented);
}

.folder-card.selected {
  border-color: var(--ui-border-accented);
}

/* Sortable states */
.folder-card.sortable-ghost {
  opacity: 0.35;
}
.folder-card.sortable-chosen {
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
}

.card-header {
  width: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-icon {
  display: flex;
  align-items: center;
}

.card-title {
  font-weight: 500;
  text-align: center;
  color: var(--ui-text);
  word-break: break-word;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: nowrap;
}

.card-menu {
  right: 0.5rem;
  top: 1rem;
  position: absolute;
  display: none;
}
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.card-bottom p {
  line-height: 1.5rem;
}
</style>
