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

const editorStore = useEditorStore();
const factoryStore = useFactoryStore();
await factoryStore.getFolders();

const open = ref(true);

const activeTabId = ref(1);
const myTabs = ref([
  { id: 1, label: "Decreto 1080 de..." },
  { id: 2, label: "Acuerdo 001 de 2024" },
  { id: 3, label: "Resolucion 5402 de..." },
]);

const handleClose = (id: any) => {
  myTabs.value = myTabs.value.filter((t) => t.id !== id);

  if (activeTabId.value === id && myTabs.value.length > 0) {
    activeTabId.value = 1;
  }
};

const factoryNavigation = computed(() => {
  return {
    label: "Factory",
    icon: "material-symbols:archive-outline",
    tooltip: {
      text: "Widgets",
    },
    defaultOpen: true,
    children: factoryStore.sidebarFolders.map((folder) => ({
      label: folder.folder_name,
      icon: "material-symbols:folder-outline-rounded",
      description: `Carpeta: ${folder.folder_name}`,
      tooltip: {
        text: folder.folder_name,
      },
      defaultOpen: true,
      children: folder.documents.map((doc) => ({
        label: doc.originalName,
        icon: "ic:outline-insert-drive-file",
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
      icon: "material-symbols:home-outline-rounded",
      tooltip: {
        text: "Home",
      },
      to: "/",
      defaultOpen: false,
      children: [
        {
          label: "Favorites",
          icon: "ic:round-star-outline",
          tooltip: {
            text: "Acuerdo 001 de 2024",
          },
        },
        {
          label: "Community",
          icon: "material-symbols:verified-user-outline-rounded",
          tooltip: {
            text: "Acuerdo 001 de 2024",
          },
        },
        {
          label: "Trash",
          icon: "material-symbols:restore-from-trash-outline-rounded",
          tooltip: {
            text: "Acuerdo 001 de 2024",
          },
        },
      ],
    },
    factoryNavigation.value,
    {
      label: "Outputs",
      icon: "material-symbols:widgets-outline-rounded",
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
    class="wrapper flex flex-1 h-screen"
    :class="[
      variant === 'inset' && 'bg',
      side === 'right' && 'flex-row-reverse',
    ]"
  >
    <USidebar
      v-model:open="open"
      :variant="variant"
      collapsible="icon"
      :side="side"
      :ui="{
        container: 'bg-default h-full',
        header:
          'flex items-center gap-1.5 overflow-hidden  px-0 min-h-(--ui-header-height)',
      }"
    >
      <template #header>
        <div class="bg-[var(--header-bg)] window-drag flex items-center pl-4">
          <span class="[webkit-app-region:no-drag] z-20">
            <UButton
              class="no-drag"
              :icon="
                side === 'left'
                  ? 'material-symbols:left-panel-close-outline-rounded'
                  : 'material-symbols:left-panel-open-outline-rounded'
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
      class="bg-[var(--header-bg)] flex-1 flex flex-col overflow-hidden lg:peer-data-[variant=floating]:my-4 peer-data-[variant=inset]:m-4 lg:peer-data-[variant=inset]:not-peer-data-[collapsible=offcanvas]:ms-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow-sm peer-data-[variant=inset]:ring peer-data-[variant=inset]:ring-default bg-[var(--header-bg)]"
    >
      <div
        class="h-(--ui-header-height) shrink-0 flex items-center px-4 window-drag"
        :class="[
          variant !== 'floating' && 'border-b border-default',
          side === 'right' && 'justify-end',
        ]"
      >
        <Tabs v-model="activeTabId" :tabs="myTabs" @close="handleClose" />

        <UFieldGroup class="ml-auto">
          <UColorModeButton class="no-drag" />

          <UButton
            class="no-drag"
            icon="material-symbols:settings-outline-rounded"
            color="neutral"
            variant="ghost"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="material-symbols:remove"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="material-symbols:square-outline"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="material-symbols:close"
          />
        </UFieldGroup>
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

.wrapper {
  background: var(--layout-bg);
}
</style>
