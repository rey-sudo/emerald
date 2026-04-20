<template>
  <PageSplit initialWidth="60%">
    <template #left>
      <MainEditor :key="route.params.id"/>
    </template>
    <template #right>
      <Preview :key="route.params.id"/>
    </template>
  </PageSplit>
</template>

<script setup>
const route = useRoute()
const editorStore = useEditorStore();

watch(
  [() => editorStore.status, () => route.params.id], 
  ([newStatus, newId]) => {
    if (newStatus === "OPEN" && newId) {
      editorStore.send({
        command: "get_document",
        params: {
          documentId: newId,
          page: "default",
        },
      });
    }
  },
  { immediate: true }
);
</script>