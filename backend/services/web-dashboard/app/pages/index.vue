<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";

const documentStore = useDocumentStore();

await documentStore.getFolders();

const contextItems: ContextMenuItem[][] = [
  [
    {
      label: "New folder",
      icon: "material-symbols:drive-folder-upload-outline-rounded",
      onSelect(e: Event) {
        openNewFolderDialog();
      },
    },
  ],
];

const folderGridRef: any = ref(null);

function openNewFolderDialog() {
  if (folderGridRef.value) {
    folderGridRef.value?.openNewFolderDialog();
  }
}
</script>

<template>
  <div class="home-page">
    <UContextMenu :items="contextItems" :ui="{ content: 'w-60' }">
      <HomeFolderGrid ref="folderGridRef" />
    </UContextMenu>
  </div>
</template>

<style lang="css" scoped>
.home-page {
  flex-direction: column;
  display: flex;
  height: 100%;
  width: 100%;
}
</style>
