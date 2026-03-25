<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";
import type { BreadcrumbItem } from "@nuxt/ui";

const breadItems: BreadcrumbItem[] = [
  {
    label: "Home",
    icon: "i-lucide-home",
    to: "/",
  },
];

const contextItems: ContextMenuItem[][] = [
  [
    {
      label: "New folder",
      icon: "i-lucide-folder-plus",
    },
  ],
  [
    {
      label: "File upload",
      icon: "i-lucide-file-up", //
    },
    {
      label: "Folder upload",
      icon: "i-lucide-folder-up",
    },
  ],
];
</script>

<template>
  <div class="index-page">
    <div class="index-page-header" v-if="false">
      <UBreadcrumb
        :items="breadItems"
        :ui="{
          link: 'group relative flex items-center gap-1.5 text-base min-w-0 focus-visible:outline-primary',
        }"
      >
        <template #separator>
          <span class="mx-2 text-muted">/</span>
        </template>
      </UBreadcrumb>
    </div>

    <UContextMenu :items="contextItems" :ui="{ content: 'w-60' }">
      <HomeFolderGrid />
    </UContextMenu>
  </div>
</template>

<style lang="css" scoped>
.index-page {
  flex-direction: column;
  display: flex;
  height: 100%;
  width: 100%;
}

.index-page-header {
  align-items: center;
  padding: 1rem;
  display: flex;
  height: 3rem;
}
</style>
