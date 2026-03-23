<template>
  <div class="layout">
    <LeftPanel />
    <slot />
  </div>
</template>

<script setup></script>

<style lang="css" scoped>
.layout {
  width: 100%;
  height: 100vh;
}
</style>
