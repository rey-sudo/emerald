<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";

const route = useRoute();

const folderId = route.params.id as string;
const folderName = route.query.folderName as string;

const documentStore = useDocumentStore();
await documentStore.getFolders();

const contextItems: ContextMenuItem[][] = [
  [
    {
      label: "File upload",
      icon: "material-symbols:upload-file-outline-rounded",
      onSelect(e: Event) {
        openFileUploadDialog();
      },
    },
  ],
];

const fileGridRef: any = ref(null);

function openFileUploadDialog() {
  if (fileGridRef.value) {
    fileGridRef.value?.openFileUploadDialog();
  }
}
</script>
<template>
  <div class="folder-page">
    <UContextMenu :items="contextItems" :ui="{ content: 'w-60' }">
      <HomeFileGrid
        ref="fileGridRef"
        :folderId="folderId"
        :folderName="folderName"
      />
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
