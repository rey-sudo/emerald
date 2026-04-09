<template>
  <div class="editor-layout">
    <div v-if="editor" class="editor-header">
      <UButton
        :class="{ 'is-active': editor.isActive('bold') }"
        icon="i-lucide-bold"
        size="sm"
        color="primary"
        :variant="editor.isActive('bold') ? 'solid' : 'outline'"
        @click="editor.chain().focus().toggleBold().run()"
      />

      <UButton
        :class="{ 'is-active': editor.isActive('italic') }"
        icon="i-lucide-italic"
        size="sm"
        color="primary"
        :variant="editor.isActive('italic') ? 'solid' : 'outline'"
        @click="editor.chain().focus().toggleItalic().run()"
      />

      <span class="doc-info">100/600 páginas</span>
    </div>

    <div class="editor-container">
      <editor-content :editor="editor" class="tiptap-viewport" />
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

// 1. Definimos la extensión personalizada "Page"
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

const ydoc = new Y.Doc();

// 2. Props para recibir el HTML ya "empaquetado" desde Python
const props = defineProps({
  initialContent: {
    type: String,
    default: "",
  },
});

// 3. Inicialización del Editor
const editor = useEditor({
  content: null,
  extensions: [
    StarterKit.configure({
      history: false,
    }),
    Page,
    Collaboration.configure({
      document: ydoc,
      field: "default",
    }),
  ],

  onCreate({ editor: currentEditor }) {
    // Para saber si el Ydoc está vacío sin usar ytext:
    const fragment = ydoc.getXmlFragment("default");

    if (!props.initialBinary && props.initialContent) {
      // Si el fragmento no tiene hijos, está vacío
      if (fragment.length === 0) {
        console.log("Sembrando contenido inicial...");
        currentEditor.commands.setContent(props.initialContent);
      }
    }
  },

  editorProps: {
    attributes: {
      spellcheck: "false",
      class: "prose-container", // Clase para estilos generales de texto
    },
  },
});

ydoc.on("update", (update) => {
  // 'update' es un pequeño binario (Uint8Array) con el cambio actual
  console.log("Cambio detectado, enviando delta al servidor...", update);

  // Aquí llamarías a tu API:
  // fetch('/api/save-delta', { method: 'POST', body: update })
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style>
/* Contenedor principal para organizar Header y Editor */
.editor-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 3rem); /* Ocupa todo el alto de la ventana */
  overflow: hidden; /* Evita scroll doble */
  background: var(--ui-bg);
}

/* El Header */
.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  z-index: 10; /* Siempre por encima del contenido */
}

.doc-info {
  font-size: 12px;
  color: #888;
  margin-left: auto; /* Empuja la info a la derecha */
}

/* --- CAPA DE RENDIMIENTO (CRÍTICO) --- */
.editor-container {
  overflow-y: auto; /* Activa el scroll vertical cuando el contenido sea mayor a 100vh */
}

/* 2. Motores WebKit (Chrome, Safari, Edge) */
.editor-container::-webkit-scrollbar {
  width: 1.25rem; /* Ancho del scroll vertical */
  height: 1rem; /* Ancho del scroll horizontal */
}

.editor-container::-webkit-scrollbar-track {
  background: var(--ui-bg); /* Color del carril (fondo) */
  border-radius: var(--ui-radius);
}

.editor-container::-webkit-scrollbar-thumb {
  background: var(--ui-bg-accented);
  border: 4px solid var(--ui-bg); /* Crea un efecto de margen interno */
}

.editor-container::-webkit-scrollbar-thumb:hover {
  background: var(--ui-bg-inverted); /* Color cuando pasas el mouse */
}

.tiptap-viewport {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
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
  border-top: 1px solid var(--ui-border);
}

/* --- INDICADOR DE PÁGINA (ESTÉTICO) --- */

.page-virtual::before {
  /* Toma el número del atributo data-number automáticamente */
  content: "PÁGINA " attr(data-number);
  position: absolute;
  top: 20px;
  right: 30px;
  font-size: 11px;
  font-weight: bold;
  color: #c0c0c0;
  letter-spacing: 1px;
  user-select: none; /* Evita que el número se seleccione al copiar texto */
  pointer-events: none; /* El ratón lo atraviesa para no estorbar la edición */
}

/* Estilos de texto básicos para que se vea bien */
.prose-container:focus {
  outline: none;
}

.page-virtual p {
  line-height: 1.6;
  margin-bottom: 1rem;
}

.page-virtual ul {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}
</style>
