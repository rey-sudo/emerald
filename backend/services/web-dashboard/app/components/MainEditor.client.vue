<template>
  <div class="editor-layout">
    <div v-if="editor" class="editor-header">
      <UButton
        icon="i-lucide-undo-2"
        size="sm"
        color="neutral"
        variant="ghost"
        :disabled="!editor.can().undo()"
        @click="editor.chain().focus().undo().run()"
      />

      <UButton
        icon="i-lucide-redo-2"
        size="sm"
        color="neutral"
        variant="ghost"
        :disabled="!editor.can().redo()"
        @click="editor.chain().focus().redo().run()"
      />

      <USeparator orientation="vertical" class="h-6" />

      <UButton
        :class="{ 'is-active': editor.isActive('bold') }"
        icon="i-lucide-bold"
        size="sm"
        color="neutral"
        :variant="editor.isActive('bold') ? 'subtle' : 'ghost'"
        @click="editor.chain().focus().toggleBold().run()"
      />

      <UButton
        :class="{ 'is-active': editor.isActive('italic') }"
        icon="i-lucide-italic"
        size="sm"
        color="neutral"
        :variant="editor.isActive('italic') ? 'subtle' : 'ghost'"
        @click="editor.chain().focus().toggleItalic().run()"
      />

      <UButton
        :class="{ 'is-active': editor.isActive('highlight') }"
        icon="i-lucide-highlighter"
        size="sm"
        color="neutral"
        :variant="editor.isActive('highlight') ? 'subtle' : 'ghost'"
        @click="editor.chain().focus().toggleHighlight().run()"
      />

      <USeparator orientation="vertical" class="h-6 ml-auto" />

      <UButton
        :class="{ 'is-active': editor.isActive('multiSelect') }"
        icon="i-lucide-mouse-pointer-click"
        size="sm"
        color="primary"
        :variant="editor.isActive('multiSelect') ? 'subtle' : 'outline'"
        @click="editor.chain().focus().toggleSelection().run()"
        >Select</UButton
      >

      <UButton
        :class="{ 'is-active': selectionCount > 0 }"
        icon="i-lucide-eraser"
        size="sm"
        color="secondary"
        variant="outline"
        :disabled="!selectionCount"
        @click="editor.commands.clearAllSelections()"
      >
        Clean
        <template #trailing>
          <UBadge
            class="flex items-center text-center"
            color="neutral"
            variant="subtle"
            size="xs"
            >{{ selectionCount }}</UBadge
          >
        </template>
      </UButton>

      <button style="display: none" @click="logSelections">ver</button>
    </div>

    <div class="editor-container">
      <editor-content :editor="editor" class="tiptap-viewport" />
    </div>

    <div class="footer">
      <span class="ml-auto">
        <UBadge
          class="flex items-center text-center"
          color="neutral"
          variant="subtle"
          size="xs"
          >Page 23/253</UBadge
        >
      </span>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";

const Page = Node.create({
  name: "page",
  group: "block",
  content: "block+", // Permite párrafos, listas, etc. dentro de la página
  defining: true, // Ayuda a mantener la estructura al pegar texto

  addAttributes() {
    return {
      number: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-number"),
        renderHTML: (attributes) => ({ "data-number": attributes.number }),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => ({ id: attributes.id }),
      },
      class: {
        default: "page-virtual",
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => ({ class: attributes.class }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-type": "page" }, HTMLAttributes), 0];
  },
});

const route = useRoute();

const editorStore = useEditorStore();

const ydoc = new Y.Doc();

const editor = useEditor({
  content: null,
  extensions: [
    StarterKit.configure({
      undoRedo: false,
      history: false,
      bold: {
        HTMLAttributes: {
          class: "custom-bold-style",
        },
      },
    }),
    Page,
    Collaboration.configure({
      document: ydoc,
      field: "default",
    }),
    MultiSelect,
  ],
  editorProps: {
    attributes: {
      spellcheck: "false",
      class: "prose-container",
    },
  },
});

watch(
  () => editorStore.message,
  (msg) => {
    if (!editor.value) return;

    if (msg?.documentId && msg.documentId !== route.params.id) {
      return;
    }

    if (msg.command === "get_document") {
      if (msg.data.isNew) {
        editor.value.commands.setContent(msg.data.content);
      } else {
        Y.applyUpdate(ydoc, msg.data.content);
      }
    }
  },
  { immediate: true },
);

let localBuffer = [];
let isProcessing = false;

ydoc.on("update", (update) => {
  localBuffer.push(update);
});

const selectionCount = computed(() => {
  if (!editor.value) return 0;
  return editor.value.storage.multiSelect.getSelectionCount(
    editor.value.state.doc,
  );
});

const logSelections = () => {
  if (!editor.value) return;

  const entries = editor.value.storage.multiSelect.getSelectionsInOrder(
    editor.value.state.doc,
  );
  console.log("Selecciones actuales:", entries);
};

async function processChanges() {
  // Exit if there are no updates to send or if a sync process is already in progress
  if (localBuffer.length === 0 || isProcessing) {
    return;
  }

  // 1. Lock the process to prevent concurrent execution (race conditions)
  isProcessing = true;

  const documentId = route.params.id;

  /**2. Extract and clear the buffer IMMEDIATELY.
   * New incoming updates during the async 'await' period will be pushed to a
   * fresh array, preventing data loss during the current transmission.
   */
  const updatesToSend = [...localBuffer];
  localBuffer = [];

  try {
    // 2. Consolidate all micro-deltas into a single compressed binary.
    const mergedUpdate = Y.mergeUpdates(updatesToSend);

    // 3. Send a SINGLE network request to the backend.
    const result = await editorStore.send({
      command: "update_document",
      params: {
        documentId: documentId,
        binario: mergedUpdate,
        page: "default",
      },
    });

    console.log(mergedUpdate.length);

    if (!result) {
      throw new Error("El servidor no confirmó la recepción");
    }
  } catch (error) {
    console.error("Error enviando cambios, reintentando...", error);

    /**
     * Network failure recovery:
     * Prepend the failed updates back to the beginning of the buffer so they
     * can be merged and re-attempted in the next interval.
     */
    localBuffer.unshift(...updatesToSend);
  } finally {
    // Release the lock to allow the next scheduled process to run
    isProcessing = false;
  }
}

const miIntervalo = setInterval(processChanges, 1000);

function cerrarDocumento() {
  clearInterval(miIntervalo);

  // Opcional: Si quedó algo en el buffer justo antes de cerrar,
  // puedes intentar hacer un último envío forzado aquí.
  if (localBuffer.length > 0) {
    processChanges();
  }
}

onBeforeUnmount(() => {
  cerrarDocumento();

  if (editor.value) {
    editor.value.destroy();
  }

  ydoc.destroy();
});
</script>

<style>
/* Contenedor principal para organizar Header y Editor */
.editor-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 2.5rem); /* Ocupa todo el alto de la ventana */
  overflow: hidden; /* Evita scroll doble */
  background: var(--ui-bg);
}

.editor-header {
  gap: 0.5rem;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: 0.25rem 1rem;
  border-bottom: 1px solid var(--ui-border);
  border-bottom-left-radius: calc(var(--ui-radius) * 0);
  border-bottom-right-radius: calc(var(--ui-radius) * 0);
}

/* --- CAPA DE RENDIMIENTO (CRÍTICO) --- */
.editor-container {
  overflow-y: auto; /* Activa el scroll vertical cuando el contenido sea mayor a 100vh */
}

/* 2. Motores WebKit (Chrome, Safari, Edge) */
.editor-container::-webkit-scrollbar {
  width: 1rem; /* Ancho del scroll vertical */
  height: 1rem; /* Ancho del scroll horizontal */
}

.editor-container::-webkit-scrollbar-track {
  background: transparent;
}

.editor-container::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: var(--ui-bg-accented);
  border: 0.25rem solid var(--ui-bg);
  height: 5rem;
}

.editor-container::-webkit-scrollbar-thumb:hover {
  background: var(--ui-bg-inverted);
}

.tiptap-viewport {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.tiptap-viewport .ProseMirror {
  min-height: 100%;
  outline: none;
}

.page-virtual {
  /* La magia: el navegador no dibuja la página si no está en el viewport */
  content-visibility: auto;

  /* Evita que el scrollbar "tiemble". Ajusta 1100px a la altura real de tu página */
  contain-intrinsic-size: 1px 1100px;

  padding: 60px 80px;
  position: relative;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0);

  display: block;
  content-visibility: auto;
  contain-intrinsic-size: 1px 1100px; /* Muy importante para el scrollbar */
  min-height: 100px;
}

/* --- INDICADOR DE PÁGINA (ESTÉTICO) --- */

.page-virtual::before {
  /* Toma el número del atributo data-number automáticamente */
  content: "" attr(data-number);
  position: absolute;
  top: 20px;
  right: 30px;
  font-size: var(--text-sm);
  color: var(--ui-text);
  letter-spacing: 1px;
  user-select: none; /* Evita que el número se seleccione al copiar texto */
  pointer-events: none; /* El ratón lo atraviesa para no estorbar la edición */
}

/* Estilos de texto básicos para que se vea bien */
.prose-container:focus {
  outline: none;
}

.page-virtual p,
h1 {
  line-height: 1.6;
  margin-bottom: 1rem;
  opacity: 0.8;
}

.custom-bold-style {
  color: goldenrod;
}

.footer {
  z-index: 10;
  gap: 0.5rem;
  display: flex;
  align-items: center;
  padding: 0.25rem 1rem;
  border-top: 1px solid var(--ui-border-muted);
}
</style>
