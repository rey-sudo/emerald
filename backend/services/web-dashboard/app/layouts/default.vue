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
  ]
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
    class="bg-muted flex flex-1 h-screen"
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
      class="bg-muted flex-1 flex flex-col overflow-hidden lg:peer-data-[variant=floating]:my-4 peer-data-[variant=inset]:m-4 lg:peer-data-[variant=inset]:not-peer-data-[collapsible=offcanvas]:ms-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow-sm peer-data-[variant=inset]:ring peer-data-[variant=inset]:ring-default bg-default"
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
          <UButton
            class="no-drag"
            icon="i-lucide-panel-right"
            color="neutral"
            variant="ghost"
          />
          <UButton
            class="no-drag"
            icon="i-lucide-settings"
            color="neutral"
            variant="ghost"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-minus"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-square"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
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
</style>
