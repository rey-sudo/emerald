<script setup lang="ts">
import type { Editor } from "@tiptap/vue-3";
import type { EditorCustomHandlers, EditorToolbarItem } from "@nuxt/ui";
import Highlight from "@tiptap/extension-highlight";

const value =
  ref(`ARTÍCULO 1o. ALCANCE. El presente decreto se aplica en la totalidad del Territorio
Aduanero Nacional y regula las relaciones jurídicas que se establecen entre la administración
aduanera y quienes intervienen en el ingreso, permanencia, traslado y salida de las mercancías,
hacia y desde el Territorio Aduanero Nacional, con sujeción a la Constitución y la ley.

Asimismo, se aplica sin perjuicio de las disposiciones especiales y las resultantes de acuerdos o
tratados internacionales a los que haya adherido o adhiera Colombia. Los acuerdos o tratados
mencionados comprenden, entre otros, los acuerdos comerciales y los referidos a la protección de
la propiedad intelectual.

La potestad aduanera se ejercerá, incluso, en el área demarcada del país vecino donde se cumplan
los trámites y controles aduaneros en virtud de acuerdos binacionales fronterizos.

Doctrina Concordante

Oficio DIAN 904105 de 2021`);

const customHandlers = {
  highlight: {
    canExecute: (editor: Editor) => editor.can().toggleHighlight(),
    execute: (editor: Editor) => editor.chain().focus().toggleHighlight(),
    isActive: (editor: Editor) => editor.isActive("highlight"),
    isDisabled: (editor: Editor) => !editor.isEditable,
  },
} satisfies EditorCustomHandlers;

const toolbarItems = [
  [
    {
      icon: "i-lucide-heading",
      content: {
        align: "start",
      },
      items: [
        {
          kind: "heading",
          level: 1,
          icon: "i-lucide-heading-1",
          label: "Heading 1",
        },
        {
          kind: "heading",
          level: 2,
          icon: "i-lucide-heading-2",
          label: "Heading 2",
        },
        {
          kind: "heading",
          level: 3,
          icon: "i-lucide-heading-3",
          label: "Heading 3",
        },
        {
          kind: "heading",
          level: 4,
          icon: "i-lucide-heading-4",
          label: "Heading 4",
        },
      ],
    },
  ],
  [
    {
      kind: "mark",
      mark: "bold",
      icon: "i-lucide-bold",
    },
    {
      kind: "mark",
      mark: "italic",
      icon: "i-lucide-italic",
    },
    {
      kind: "mark",
      mark: "underline",
      icon: "i-lucide-underline",
    },
    {
      kind: "mark",
      mark: "strike",
      icon: "i-lucide-strikethrough",
    },
    {
      kind: "mark",
      mark: "code",
      icon: "i-lucide-code",
    },
    {
      kind: "highlight",
      icon: "i-lucide-highlighter",
      tooltip: { text: "Control + Shift + H / Cmd + Shift + H" },
    },
  ],
] satisfies EditorToolbarItem<typeof customHandlers>[][];

const extensions = [
  Highlight.configure({
    multicolor: true,
  }),
];

const editorProps: any = {
  attributes: {
    spellcheck: "false",
  },
};
</script>

<template>
  <UEditor
    v-slot="{ editor }"
    v-model="value"
    :editor-props="editorProps"
    :extensions="extensions"
    :handlers="customHandlers"
    content-type="markdown"
    :ui="{ base: 'p-6 pt-8 sm:px-16' }"
    class="w-full min-h-74"
  >
    <UEditorToolbar
      :editor="editor"
      :items="toolbarItems"
      color="neutral"
      variant="ghost"
      :ui="{
        base: 'flex items-stretch gap-1.5 bg',
      }"
      class="py-2 px-8 sm:px-16 overflow-x-auto"
    />
    <USeparator />
  </UEditor>
</template>

<style lang="scss" scoped></style>
