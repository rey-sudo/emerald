<script setup lang="ts">
import type { RadioGroupItem, UserProps } from "@nuxt/ui";

const members: UserProps[] = [
  {
    name: "Easy",
    description: "Intro",
    to: "https://github.com/danielroe",
    target: "_blank",
    avatar: {
      icon: "i-lucide-blocks",
      alt: "danielroe",
      loading: "lazy" as const,
    },
  },
  {
    name: "Mid",
    description: "School",
    to: "https://github.com/pi0",
    target: "_blank",
    avatar: {
      icon: "i-lucide-school",
      alt: "pi0",
      loading: "lazy" as const,
    },
  },
  {
    name: "Academic",
    description: "Pro",
    to: "https://github.com/benjamincanac",
    target: "_blank",
    avatar: {
      icon: "i-lucide-school",
      alt: "benjamincanac",
      loading: "lazy" as const,
    },
  },
];

const actions: any = [
  {
    label: "Easy",
    icon: "",
    color: "neutral",
  },
  {
    label: "Mid",
    icon: "",
    color: "neutral",
  },
  {
    label: "Hard",
    icon: "",
    color: "neutral",
  },
];

const radioItems = ref<RadioGroupItem[]>([
  {
    label: "Selection",
    value: "selection",
    description: "The questions are generated from the selected text.",
  },
  {
    label: "Document",
    value: "document",
    description: "The questions are generated from the entire document.",
  },
  {
    label: "Folder",
    value: "folder",
    description: "The questions are generated from the folder.",
  },
]);
</script>

<template>
  <UEmpty
    title="New Quiz"
    description="Generate questions for each topic."
    variant="naked"
    size="xl"
  >
    <template #leading>
      <UAvatarGroup size="3xl">
        <UAvatar
          icon="material-symbols:quiz-outline-rounded"
          alt="Nuxt"
          loading="lazy"
        />
      </UAvatarGroup>
    </template>

    <template #body>
      <URadioGroup
        color="primary"
        variant="table"
        default-value="pro"
        size="md"
        :items="radioItems"
        :ui="{
          item: 'hover:bg-primary/5 transition-colors',
        }"
      />

      <USeparator class="my-4" />

      <div class="w-full grid grid-cols-2 gap-4">
        <UPageCard
          v-for="(member, index) in members"
          :key="index"
          :to="member.to"
          :ui="{ container: 'sm:p-4' }"
        >
          <UUser
            :avatar="member.avatar"
            :name="member.name"
            :description="member.description"
            :ui="{ name: 'truncate' }"
          />
        </UPageCard>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex justify-end gap-2 mt-4">
        <UButton color="neutral" variant="outline" size="lg">Cancel</UButton>
        <UButton color="primary" size="lg">Create Quiz</UButton>
      </div>
    </template>
  </UEmpty>
</template>
<style scoped></style>
