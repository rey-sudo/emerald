<script setup lang="ts">
import type { NavigationMenuItem, SidebarProps } from "@nuxt/ui";

defineProps<Pick<SidebarProps, "variant" | "collapsible" | "side">>();

const open = ref(true);

const navItems: NavigationMenuItem[] = [
  {
    label: "Home",
    icon: "i-lucide-house",
    to: "/",
    tooltip: {
      text: "Home",
    },
  },
  {
    label: "Blocks",
    icon: "i-lucide-box",

    tooltip: {
      text: "Blocks",
    },
    defaultOpen: true,
    to: "/blocks",
    children: [
      {
        label: "Aduanero",
        icon: "i-lucide-folder",
        description: "Define shortcuts for your application.",

        tooltip: {
          text: "Acuerdo 001 de 2024",
        },
        children: [
          {
            label: "Acuerdo 001 de 2024",
            icon: "i-lucide-file",
            description: "Define shortcuts for your application.",
            slot: "widgets" as const,
            children: [
              {
                label: "1.2.6 Normativa",
                icon: "i-lucide-dot",
                description: "Define shortcuts for your application.",
                to: "/blocks",
              },
              {
                label: "1.2.3 Normativa",
                icon: "i-lucide-dot",
                description: "Define shortcuts for your application.",
                to: "/blocks",
              },
              {
                label: "1.2.8 Normativa",
                icon: "i-lucide-dot",
                description: "Define shortcuts for your application.",
                to: "/blocks",
              },
            ],
          },
        ],
      },

      {
        label: "Gestion Documental",
        icon: "i-lucide-folder",
        description: "Define shortcuts for your application.",
        tooltip: {
          text: "Acuerdo 001 de 2024",
        },
        to: "/blocks",
        children: [
          {
            label: "Acuerdo 001 de 2024",
            icon: "i-lucide-file",
            description: "Define shortcuts for your application.",
            slot: "widgets" as const,
            children: [
              {
                label: "1.2.6 Normativa",
                icon: "i-lucide-file",
                description: "Define shortcuts for your application.",
                to: "/",
              },
            ],
          },
        ],
      },
    ],
  },
];
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
      }"
    >
      <template #header>
        <Logo />
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
        <template #widgets-trailing>
          <UBadge label="20+" color="neutral" variant="subtle" size="sm" />
        </template>
      </UNavigationMenu>
    </USidebar>

    <div
      class="flex-1 flex flex-col overflow-hidden lg:peer-data-[variant=floating]:my-4 peer-data-[variant=inset]:m-4 lg:peer-data-[variant=inset]:not-peer-data-[collapsible=offcanvas]:ms-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow-sm peer-data-[variant=inset]:ring peer-data-[variant=inset]:ring-default bg-default"
    >
      <div
        class="h-(--ui-header-height) shrink-0 flex items-center px-4"
        :class="[
          variant !== 'floating' && 'border-b border-default',
          side === 'right' && 'justify-end',
        ]"
      >
        <UButton
          :icon="
            side === 'left' ? 'i-lucide-panel-left' : 'i-lucide-panel-right'
          "
          color="neutral"
          variant="ghost"
          aria-label="Toggle sidebar"
          @click="open = !open"
        />
        <UColorModeButton class="ml-auto" />
      </div>

      <div class="flex-1">
        <slot />
      </div>
    </div>
  </div>
</template>

<style></style>
