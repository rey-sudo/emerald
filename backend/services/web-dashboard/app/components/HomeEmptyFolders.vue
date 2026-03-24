<template>
  <UEmpty
    size="lg"
    icon="i-lucide-folders"
    title="No folders found"
    description="It looks like you haven't added any projects. Create one to get started."
    :actions="[
      {
        icon: 'i-lucide-plus',
        label: 'Create new',
      },
    ]"
  />
</template>

<script setup></script>

<style lang="css" scoped></style>
