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
      <div class="card-icon">
        <svg
          width="2rem"
          version="1.1"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
        >
          <defs>
            <linearGradient
              id="linearGradient946"
              x1="445.28"
              x2="445.28"
              y1="181.8"
              y2="200.07"
              gradientTransform="matrix(1.4724 0 0 1.4432 -625.58 -239.75)"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#ffffff" stop-opacity="0" offset="0" />
              <stop stop-color="#ffffff" offset="1" />
            </linearGradient>
          </defs>
          <image
            x="2.5"
            y="49.215"
            width="59"
            height="10"
            image-rendering="optimizeQuality"
            opacity=".5"
            preserveAspectRatio="none"
            xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAKCAYAAAAKAya7AAAACXBIWXMAAA7DAAAOwwHHb6hkAAAA GXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAMFJREFUSInVltEOwyAIRaH1/794 rXvBhF2vDhb6MBIC1gY4gVpV6kQLY6H0iiCRAvEdTfrRPAjUkz5bh4pQZzMq4GMOlm8H0sGPKsai yX3hh9MT1kN3wLs8TFZdYjA30QvWCC9tATrgmvnN1INHIKOgK2D/jAEPwJfpZVbN/4hxJAr5e4mO MRtllbnDQizLw4R9u6yrt8yjjCNMx/ipA4rZVb5vkAhbdkAxif56dnu/dhb9zN4k1ReBJy4WJRcK EZE37lJlFEBdtGUAAAAASUVORK5CYII="
          />
          <path
            :style="{ color: folder.color }"
            d="m8.3493 8.996h10.187c2.8348 0 2.9596 0.10961 5.8283 2.3812 2.6345 1.9881 3.5832 1.6252 7.0454 1.6252h24.236c2.4085-0.01263 4.3647 1.9419 4.3542 4.3504v26.293c0.004189 2.4065-1.9477 4.3583-4.3542 4.3541h-47.295c-2.405 0.002095-4.3546-1.9492-4.3504-4.3541v-30.296c-0.0041836-2.405 1.9454-4.3562 4.3504-4.3541z"
            fill="currentColor"
          />
          <path
            d="m8.3494 8.996h10.187c2.8349 0 2.9596 0.10961 5.8283 2.3812 2.6345 1.9881 3.5833 1.6252 7.0454 1.6252h24.236c2.4085-0.01263 4.3648 1.9419 4.3542 4.3504v26.293c0.0042 2.4065-1.9477 4.3583-4.3542 4.3541h-47.296c-2.405 0.0021-4.3546-1.9492-4.3505-4.3541v-30.296c-0.0042-2.405 1.9454-4.3562 4.3505-4.3541z"
            fill="#000000"
            opacity=".2"
          />
          <rect
            :style="{ color: folder.color }"
            x="3.9998"
            y="17.001"
            width="56"
            height="38"
            rx="4.3542"
            ry="4.2672"
            fill="currentColor"
          />
          <path
            d="m8.3528 17.001c-2.4114 0-4.3541 1.9012-4.3541 4.2634v1.0016c0-2.3623 1.9427-4.2672 4.3541-4.2672h47.294c2.4114 0 4.3541 1.9049 4.3541 4.2672v-1.0016c0-2.3623-1.9427-4.2634-4.3541-4.2634z"
            fill="#ffffff"
            opacity=".08"
          />
          <path
            d="m3.9986 49.737v0.99782c0 2.366 1.9427 4.2672 4.3541 4.2672h47.294c2.4114 0 4.3541-1.9012 4.3541-4.2672v-0.99782c0 2.3623-1.9427 4.2634-4.3541 4.2634h-47.294a4.3012 4.3012 0 0 1-4.3541-4.2634z"
            opacity=".15"
          />
          <path
            d="m8.3528 16c-2.4114 0-4.3541 1.9049-4.3541 4.2672v0.99782c0-2.3623 1.9427-4.2634 4.3541-4.2634h47.294c2.4114 0 4.3541 1.9012 4.3541 4.2634v-0.99782c0-2.3623-1.9427-4.2672-4.3541-4.2672z"
            opacity=".05"
          />
          <rect
            x="4"
            y="17"
            width="56"
            height="38"
            rx="4.3542"
            ry="4.2672"
            fill="url(#linearGradient946)"
            opacity="4%"
          />
        </svg>

        <p class="card-name text-sm">{{ folder.folder_name }}</p>
      </div>

      <UButton
        class="card-menu rounded-3xl"
        color="neutral"
        variant="ghost"
        icon="lucide:ellipsis-vertical"
        size="sm"
        @click="openMenu"
      />
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
  box-shadow: var(--ui-card-shadow);
  border-radius: calc(var(--ui-radius) * 2);
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  padding: 0.75rem;
  padding-right: 0.25rem;
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  user-select: none;
  transition: 0.3s ease;
  justify-content: space-between;
}

.folder-card:hover {
  border-color: var(--ui-border-accented);
}

.folder-card.selected {
  background: var(--ui-bg-accented);
  border-color: var(--ui-border-elevated);
}

/* Sortable states */
.folder-card.sortable-ghost {
  opacity: 0.35;
}
.folder-card.sortable-chosen {
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
}

.card-icon {
  display: flex;
  align-items: center;
}

.card-icon p {
  margin-left: 1rem;
}

/* Name */
.card-name {
  font-weight: 500;
  text-align: center;
  color: var(--ui-text);
  line-height: 1.3;
  word-break: break-word;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: nowrap;
}

.card-menu {
  right: 0px;
  position: absolute;
}
</style>
