<script setup lang="ts">
import type { NavigationMenuItem, SidebarProps } from "@nuxt/ui";

const props = withDefaults(
  defineProps<Pick<SidebarProps, "variant" | "collapsible" | "side">>(),
  {
    variant: "sidebar",
    collapsible: "offcanvas",
    side: "left",
  },
);

const open = ref(true);

const editorStore = useEditorStore();
const factoryStore = useFactoryStore();

await factoryStore.getFolders();

const factoryNavigation = computed(() => {
  return {
    label: "Factory",
    icon: "i-lucide-box",
    tooltip: {
      text: "Widgets",
    },
    defaultOpen: true,
    children: factoryStore.sidebarFolders.map((folder) => ({
      label: folder.folder_name,
      icon: "i-lucide-folder",
      description: `Carpeta: ${folder.folder_name}`,
      tooltip: {
        text: folder.folder_name,
      },
      children: folder.documents.map((doc) => ({
        label: doc.originalName,
        icon: "i-lucide-file",
        description: "Documento procesado",
        to: `/document/${doc.id}`,
      })),
    })),
  };
});

const navItems: NavigationMenuItem[][] = [
  [
    {
      label: "Home",
      icon: "i-lucide-home",
      tooltip: {
        text: "Home",
      },
      to: "/",
      defaultOpen: false,
      children: [
        {
          label: "Favorites",
          icon: "i-lucide-star",
          tooltip: {
            text: "Acuerdo 001 de 2024",
          },
        },
        {
          label: "Community",
          icon: "i-lucide-user",
          tooltip: {
            text: "Acuerdo 001 de 2024",
          },
        },
        {
          label: "Trash",
          icon: "i-lucide-trash",
          tooltip: {
            text: "Acuerdo 001 de 2024",
          },
        },
      ],
    },
    factoryNavigation.value,
    {
      label: "Outputs",
      icon: "i-lucide-shapes",
      tooltip: {
        text: "Outputs",
      },
      to: "/outputs",
      defaultOpen: false,
    },
  ],
];

onMounted(() => {
  editorStore.connect();
});

onUnmounted(() => {
  editorStore.disconnect();
});
</script>

<template>
  <div
    class="flex flex-1 h-screen"
    :class="[
      variant === 'inset' && 'bg-neutral-50 dark:bg-neutral-950',
      side === 'right' && 'flex-row-reverse',
    ]"
  >
    <USidebar
      v-model:open="open"
      :variant="variant"
      collapsible="icon"
      :side="side"
      :ui="{
        container: 'h-full',
        header:
          'flex items-center gap-1.5 overflow-hidden  px-0 min-h-(--ui-header-height)',
      }"
    >
      <template #header>
        <div class="window-drag flex items-center pl-4">
          <span class="[webkit-app-region:no-drag] z-20">
            <UButton
              class="no-drag"
              :icon="
                side === 'left' ? 'i-lucide-panel-left' : 'i-lucide-panel-right'
              "
              color="neutral"
              variant="ghost"
              aria-label="Toggle sidebar"
              @click="open = !open"
            />
          </span>
        </div>
      </template>

      <UNavigationMenu
        :items="navItems"
        orientation="vertical"
        tooltip
        :collapsed="open === false"
        :ui="{
          link: 'p-1.5 overflow-hidden',
        }"
      >
      </UNavigationMenu>
    </USidebar>

    <div
      class="flex-1 flex flex-col overflow-hidden lg:peer-data-[variant=floating]:my-4 peer-data-[variant=inset]:m-4 lg:peer-data-[variant=inset]:not-peer-data-[collapsible=offcanvas]:ms-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow-sm peer-data-[variant=inset]:ring peer-data-[variant=inset]:ring-default bg-default"
    >
      <div
        class="h-(--ui-header-height) shrink-0 flex items-center px-4 window-drag"
        :class="[
          variant !== 'floating' && 'border-b border-default',
          side === 'right' && 'justify-end',
        ]"
      >
        <UButton
          icon="i-lucide-bolt"
          variant="ghost"
          color="neutral"
          class="ml-auto"
        />
      </div>

      <div class="flex-1">
        <slot />
      </div>
    </div>
  </div>
</template>

<style>
.window-drag {
  -webkit-app-region: drag !important;
  max-height: var(--ui-header-height);
  width: 100%;
  top: 0;
  height: 100%;
  z-index: 9999;
}

.no-drag {
  -webkit-app-region: no-drag !important;
  cursor: pointer; 
}
</style>
