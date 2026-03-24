<script setup lang="ts">
import type { UserProps } from "@nuxt/ui";

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
</script>

<template>
  <UEmpty
    title="Create quiz questions"
    description="Create a list of questions for each item or idea."
    variant="naked"
  >
    <template #leading>
      <UAvatarGroup size="xl">
        <UAvatar icon="i-lucide-blocks" alt="Nuxt" loading="lazy" />
        <UAvatar icon="i-lucide-school" alt="Unjs" loading="lazy" />
      </UAvatarGroup>
    </template>

    <template #footer>
      <USeparator class="my-4" />

      <div class="grid grid-cols-2 gap-4">
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
  </UEmpty>
</template>
