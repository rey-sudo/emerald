<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";

const route = useRoute();
const id = route.params.id;

const documentStore = useDocumentStore();

await documentStore.getFolders();

const contextItems: ContextMenuItem[][] = [
  [
    {
      label: "File upload",
      icon: "i-lucide-file-upload",
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
  <div class="folder-page">
    <UContextMenu :items="contextItems" :ui="{ content: 'w-60' }">
      <HomeFolderGrid ref="folderGridRef" />
    </UContextMenu>
  </div>
</template>
<style lang="css" scoped>
.folder-page {
  flex-direction: column;
  display: flex;
  height: 100%;
  width: 100%;
}
</style>
