const { JSDOM } = require('jsdom');
const { generateJSON } = require('@tiptap/html');
const { StarterKit } = require('@tiptap/starter-kit');
const { Node, mergeAttributes } = require('@tiptap/core');

// Configuración de JSDOM para simular el navegador
const { window } = new JSDOM();
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;

const html = `
  <div data-type="page" data-number="1" id="p1" class="page-virtual">
    <h1>Título de la página</h1>
    <p>Este contenido está dentro del nodo Page.</p>
  </div>
`;
const PageNode = Node.create({
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

try {
  const json = generateJSON(html, [
    StarterKit,
    PageNode
  ]);

  console.log(JSON.stringify(json, null, 2));
} catch (error) {
  console.error('Error al transformar:', error);
}