<template>
  <PageSplit initialWidth="60%">
    <template #left>
      <MainEditor />
    </template>
    <template #right>
      <Preview />
    </template>
  </PageSplit>
</template>

<script setup>
const route = useRoute()


const documentId = route.params.id

console.log('El ID es:', documentId)
</script>