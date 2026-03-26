<template>
  <div
    class="drive-shell"
    @click="
      ctxMenu.close();
      selectedId = null;
    "
  >
    <!-- ════════════════════════════════════════════════
         TOP BAR
    ════════════════════════════════════════════════ -->
    <header class="topbar">
      <label class="topbar-search">
        <IconSearch class="ico-search" :size="15" />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          size="md"
          variant="outline"
          color="secondary"
          placeholder="Search..."
        />
      </label>

      <div class="topbar-actions">
        <UFieldGroup size="md">
          <UButton
            :color="view === 'list' ? 'primary' : 'neutral'"
            variant="outline"
            icon="i-lucide-text-align-justify"
            @click="view = 'list'"
          />
          <UButton
            :color="view === 'grid' ? 'primary' : 'neutral'"
            variant="outline"
            icon="i-lucide-layout-grid"
            @click="view = 'grid'"
          />
        </UFieldGroup>

        <UModal
          title="New folder"
          :ui="{
            content: 'w-auto max-w-fit',
            body: 'p-4 sm:p-6',
            footer: 'justify-end',
          }"
        >
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            label="New folder"
            size="md"
          />

          <template #body>
            <div>
              <UInput
                v-model="newFolderName"
                class="w-full"
                placeholder="Untitled folder"
                size="lg"
                :maxlength="100"
                autofocus
              />
            </div>
          </template>
          <template #footer="{ close }">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton label="Create" color="neutral" />
          </template>
        </UModal>
      </div>
    </header>

    <!-- ════════════════════════════════════════════════
         MAIN LAYOUT
    ════════════════════════════════════════════════ -->
    <div class="main">
      <!-- Content -->
      <main class="content" @click.stop="ctxMenu.close()">
        <Breadcrumb :crumbs="['Mi unidad', activeNav]" />
        <h2 class="section-title">Folders</h2>

        <!-- ── Grid view ── -->
        <div v-if="view === 'grid'" ref="gridRef" class="folder-grid">
          <FolderCard
            v-for="folder in filteredFolders"
            :key="folder.id"
            :folder="folder"
            :selected="selectedId === folder.id"
            @click.stop="selectedId = toggle(selectedId, folder.id)"
            @dblclick="toast(`Abriendo «${folder.name}»…`)"
            @contextmenu.prevent="(e) => ctxMenu.open(e, folder)"
            @menu="(e) => ctxMenu.open(e, folder)"
          />

          <EmptyState v-if="filteredFolders.length === 0" />
        </div>

        <!-- ── List view ── -->
        <div v-else ref="listRef" class="folder-list">
          <ListHeader v-if="filteredFolders.length > 0" />

          <FolderRow
            v-for="folder in filteredFolders"
            :key="folder.id"
            :folder="folder"
            :selected="selectedId === folder.id"
            @click.stop="selectedId = toggle(selectedId, folder.id)"
            @dblclick="toast(`Abriendo «${folder.name}»…`)"
            @contextmenu.prevent="(e) => ctxMenu.open(e, folder)"
            @menu="(e) => ctxMenu.open(e, folder)"
          />

          <EmptyState v-if="filteredFolders.length === 0" />
        </div>
      </main>
    </div>

    <!-- ════════════════════════════════════════════════
         OVERLAYS
    ════════════════════════════════════════════════ -->

    <!-- Context Menu -->
    <ContextMenu
      v-if="ctxMenu.state.visible"
      :x="ctxMenu.state.x"
      :y="ctxMenu.state.y"
      @open="handleCtxOpen"
      @rename="handleCtxRename"
      @duplicate="handleCtxDuplicate"
      @delete="handleCtxDelete"
      @close="ctxMenu.close()"
    />

    <!-- Toasts -->
    <ToastStack :toasts="toasts" />
  </div>
</template>

<!-- ══════════════════════════════════════════════════════════════
     SCRIPT
══════════════════════════════════════════════════════════════ -->
<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  defineComponent,
  h,
} from "vue";
import Sortable from "sortablejs";

const newFolderName = ref("Untitled folder")

const FOLDER_COLORS = [
  "#d97845",
  "#5b7fa6",
  "#6aab8e",
  "#9b7dc8",
  "#c95e6e",
  "#e0a84b",
  "#5e9ec9",
];

const NAV_ITEMS = [
  {
    label: "Mi unidad",
    icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
  },
  {
    label: "Compartidos",
    icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  },
  {
    label: "Recientes",
    icon: "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2",
  },
  {
    label: "Destacados",
    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  },
  { label: "Papelera", icon: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" },
];

const TAGS = [
  { label: "Urgente", color: "#c95e6e" },
  { label: "Personal", color: "#5b7fa6" },
  { label: "Trabajo", color: "#6aab8e" },
];

const SEED_FOLDERS = [
  ["Proyectos 2025", "#d97845"],
  ["Diseño UI", "#5b7fa6"],
  ["Facturas", "#6aab8e"],
  ["Recursos compartidos", "#9b7dc8"],
  ["Clientes", "#c95e6e"],
  ["Archivos de audio", "#e0a84b"],
  ["Fotos del viaje", "#5e9ec9"],
  ["Documentos legales", "#d97845"],
  ["Plantillas", "#6aab8e"],
  ["Datos de analytics", "#5b7fa6"],
  ["Presentaciones", "#9b7dc8"],
  ["Backups", "#c95e6e"],
];

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

let _uid = 1;
const uid = () => _uid++;
const rndOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rndDate = () =>
  new Date(Date.now() - Math.random() * 1e10).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Toggle a selection: deselects if same id, selects otherwise */
const toggle = (current, id) => (current === id ? null : id);

function makeFolder(name, color) {
  return {
    id: uid(),
    name,
    color: color ?? rndOf(FOLDER_COLORS),
    items: rndInt(1, 60),
    modified: rndDate(),
  };
}

// ─────────────────────────────────────────────────────────────
// COMPOSABLES
// ─────────────────────────────────────────────────────────────

/** useFolders — all CRUD operations on the folder list */
function useFolders() {
  const folders = ref(
    SEED_FOLDERS.map(([name, color]) => makeFolder(name, color)),
  );

  const add = (name) => folders.value.unshift(makeFolder(name));
  const rename = (id, name) => {
    const f = byId(id);
    if (f) f.name = name;
  };
  const remove = (id) => {
    folders.value = folders.value.filter((f) => f.id !== id);
  };
  const duplicate = (id) => {
    const f = byId(id);
    if (!f) return;
    const idx = folders.value.indexOf(f);
    folders.value.splice(idx + 1, 0, makeFolder(`${f.name} (copia)`, f.color));
  };
  const move = (from, to) => {
    const moved = folders.value.splice(from, 1)[0];
    folders.value.splice(to, 0, moved);
  };
  const byId = (id) => folders.value.find((f) => f.id === id);

  return { folders, add, rename, remove, duplicate, move, byId };
}

/** useToast — lightweight notification stack */
function useToast() {
  const toasts = ref([]);

  function toast(msg, duration = 2200) {
    const id = Date.now() + Math.random();
    toasts.value.push({ id, msg });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  }

  return { toasts, toast };
}

/** useContextMenu — position + target state */
function useContextMenu() {
  const state = reactive({ visible: false, x: 0, y: 0, folder: null });

  function open(event, folder) {
    state.visible = true;
    state.x = Math.min(event.clientX, window.innerWidth - 170);
    state.y = Math.min(event.clientY, window.innerHeight - 200);
    state.folder = folder;
  }
  const close = () => {
    state.visible = false;
  };

  return { state, open, close };
}

/** useSortable — attach/detach Sortable.js to a container ref */
function useSortable(containerRef, onEnd) {
  let instance = null;

  function init(el) {
    destroy();
    if (!el) return;
    instance = Sortable.create(el, {
      animation: 160,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      filter: ".js-no-drag",
      preventOnFilter: false,
      onEnd,
    });
  }
  const destroy = () => {
    instance?.destroy();
    instance = null;
  };

  return { init, destroy };
}

/** useKeyboard — global keyboard shortcuts */
function useKeyboard(handlers) {
  const onKeydown = (e) => handlers[e.key]?.();
  onMounted(() => window.addEventListener("keydown", onKeydown));
  onUnmounted(() => window.removeEventListener("keydown", onKeydown));
}

// ─────────────────────────────────────────────────────────────
// ROOT STATE (wires composables together)
// ─────────────────────────────────────────────────────────────

const { folders, add, rename, remove, duplicate, move } = useFolders();
const { toasts, toast } = useToast();
const ctxMenu = useContextMenu();

const view = ref("grid"); // 'grid' | 'list'
const search = ref("");
const selectedId = ref(null);
const activeNav = ref("Mi unidad");

const filteredFolders = computed(() => {
  const q = search.value.trim().toLowerCase();
  return q
    ? folders.value.filter((f) => f.name.toLowerCase().includes(q))
    : folders.value;
});

// ─── Sortable setup ──────────────────────────────────────────
const gridRef = ref(null);
const listRef = ref(null);

const { init: initSort, destroy: destroySort } = useSortable(
  null,
  ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) return;
    move(oldIndex, newIndex);
    toast("Orden actualizado");
  },
);

watch(view, async (v) => {
  await nextTick();
  initSort(v === "grid" ? gridRef.value : listRef.value);
});

onMounted(async () => {
  await nextTick();
  initSort(gridRef.value);
});
onUnmounted(destroySort);

// ─── Keyboard shortcuts ───────────────────────────────────────
useKeyboard({
  Escape: () => {
    ctxMenu.close();
  },
});

// ─── Context menu action handlers ─────────────────────────────
function handleCtxOpen() {
  toast(`Abriendo «${ctxMenu.state.folder.name}»…`);
  ctxMenu.close();
}
function handleCtxRename() {
  ctxMenu.close();
}
function handleCtxDuplicate() {
  duplicate(ctxMenu.state.folder.id);
  toast("Carpeta duplicada");
  ctxMenu.close();
}
function handleCtxDelete() {
  const name = ctxMenu.state.folder.name;
  if (selectedId.value === ctxMenu.state.folder.id) selectedId.value = null;
  remove(ctxMenu.state.folder.id);
  toast(`«${name}» eliminada`);
  ctxMenu.close();
}

// ─────────────────────────────────────────────────────────────
// INLINE SUB-COMPONENTS  (single-file, no extra imports needed)
// ─────────────────────────────────────────────────────────────

/** Primitive icon wrappers */
const IconPath = defineComponent({
  props: { d: String, size: { type: Number, default: 18 } },
  setup(props) {
    return () =>
      h(
        "svg",
        {
          width: props.size,
          height: props.size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 1.8,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [h("path", { d: props.d })],
      );
  },
});

const IconSearch = defineComponent({
  props: { size: { type: Number, default: 15 } },
  setup(props) {
    return () =>
      h(
        "svg",
        {
          width: props.size,
          height: props.size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
        },
        [
          h("circle", { cx: 11, cy: 11, r: 8 }),
          h("line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }),
        ],
      );
  },
});

/** Folder SVG icon (used in cards & rows) */
const FolderIcon = defineComponent({
  props: { color: String, size: { type: Number, default: 56 } },
  setup(props) {
    const s = computed(() => props.size);
    return () =>
      h(
        "svg",
        { viewBox: "0 0 56 56", width: s.value, height: s.value, fill: "none" },
        [
          h("path", {
            d: "M4 16C4 12.686 6.686 10 10 10H22L28 18H46C49.314 18 52 20.686 52 24V42C52 45.314 49.314 48 46 48H10C6.686 48 4 45.314 4 42V16Z",
            fill: props.color,
            opacity: ".2",
          }),
          h("path", {
            d: "M4 24C4 20.686 6.686 18 10 18H46C49.314 18 52 20.686 52 24V42C52 45.314 49.314 48 46 48H10C6.686 48 4 45.314 4 42V24Z",
            fill: props.color,
            opacity: ".75",
          }),
          h("path", {
            d: "M4 24C4 20.686 6.686 18 10 18H22L28 10H10C6.686 10 4 12.686 4 16V24Z",
            fill: props.color,
          }),
        ],
      );
  },
});

const FolderIconSmall = defineComponent({
  props: { color: String },
  setup(props) {
    return () =>
      h("svg", { viewBox: "0 0 28 28", width: 28, height: 28, fill: "none" }, [
        h("path", {
          d: "M2 8C2 6.343 3.343 5 5 5H11L14 9H23C24.657 9 26 10.343 26 12V21C26 22.657 24.657 24 23 24H5C3.343 24 2 22.657 2 21V8Z",
          fill: props.color,
          opacity: ".25",
        }),
        h("path", {
          d: "M2 12C2 10.343 3.343 9 5 9H23C24.657 9 26 10.343 26 12V21C26 22.657 24.657 24 23 24H5C3.343 24 2 22.657 2 21V12Z",
          fill: props.color,
        }),
      ]);
  },
});

/** Dots menu button (shared between card and row) */
const MenuDots = defineComponent({
  emits: ["click"],
  setup(_, { emit }) {
    return () =>
      h(
        "button",
        {
          class: "card-menu js-no-drag",
          onClick: (e) => {
            e.stopPropagation();
            emit("click", e);
          },
        },
        [
          h(
            "svg",
            {
              width: 16,
              height: 16,
              viewBox: "0 0 24 24",
              fill: "currentColor",
            },
            [
              h("circle", { cx: 12, cy: 5, r: 1.8 }),
              h("circle", { cx: 12, cy: 12, r: 1.8 }),
              h("circle", { cx: 12, cy: 19, r: 1.8 }),
            ],
          ),
        ],
      );
  },
});

/** Breadcrumb */
const Breadcrumb = defineComponent({
  props: { crumbs: Array },
  setup(props) {
    return () =>
      h(
        "div",
        { class: "breadcrumb" },
        props.crumbs.flatMap((c, i) => {
          const isLast = i === props.crumbs.length - 1;
          const nodes = [h("span", { class: isLast ? "current" : "" }, c)];
          if (!isLast) nodes.push(h("span", { class: "sep" }, "›"));
          return nodes;
        }),
      );
  },
});

/** FolderCard (grid mode) */
const FolderCard = defineComponent({
  props: { folder: Object, selected: Boolean },
  emits: ["click", "dblclick", "contextmenu", "menu"],
  setup(props, { emit }) {
    return () =>
      h(
        "div",
        {
          class: ["folder-card", props.selected && "selected"],
          "data-id": props.folder.id,
          onClick: (e) => emit("click", e),
          onDblclick: (e) => emit("dblclick", e),
          onContextmenu: (e) => emit("contextmenu", e),
        },
        [
          h("span", { class: "drag-grip", title: "Arrastrar" }, "⠿"),
          h(MenuDots, { onMenuClick: (e) => emit("menu", e) }),
          h(
            "div",
            { class: "card-icon" },
            h(FolderIcon, { color: props.folder.color }),
          ),
          h("p", { class: "card-name" }, props.folder.name),
          h("p", { class: "card-meta" }, `${props.folder.items} elementos`),
        ],
      );
  },
});

/** ListHeader */
const ListHeader = defineComponent({
  setup() {
    return () =>
      h("div", { class: "list-header" }, [
        h("div", { class: "h-icon" }),
        h("div", { class: "h-name" }, "Nombre"),
        h("div", { class: "h-type" }, "Tipo"),
        h("div", { class: "h-date" }, "Modificado"),
        h("div", { style: "width:40px" }),
      ]);
  },
});

/** FolderRow (list mode) */
const FolderRow = defineComponent({
  props: { folder: Object, selected: Boolean },
  emits: ["click", "dblclick", "contextmenu", "menu"],
  setup(props, { emit }) {
    return () =>
      h(
        "div",
        {
          class: ["folder-row", props.selected && "selected"],
          "data-id": props.folder.id,
          onClick: (e) => emit("click", e),
          onDblclick: (e) => emit("dblclick", e),
          onContextmenu: (e) => emit("contextmenu", e),
        },
        [
          h(
            "div",
            { class: "row-icon" },
            h(FolderIconSmall, { color: props.folder.color }),
          ),
          h("span", { class: "row-name" }, props.folder.name),
          h("span", { class: "row-type" }, "Carpeta"),
          h("span", { class: "row-date" }, props.folder.modified),
          h(MenuDots, { onMenuClick: (e) => emit("menu", e) }),
        ],
      );
  },
});

/** EmptyState */
const EmptyState = defineComponent({
  setup() {
    return () =>
      h("div", { class: "empty-state" }, [
        h(
          "svg",
          {
            width: 56,
            height: 56,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.2,
          },
          [
            h("path", {
              d: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
            }),
          ],
        ),
        h("p", {}, "No se encontraron carpetas"),
      ]);
  },
});

/** ContextMenu */
const ContextMenu = defineComponent({
  props: { x: Number, y: Number },
  emits: ["open", "rename", "duplicate", "delete", "close"],
  setup(props, { emit }) {
    const items = [
      {
        label: "Abrir",
        event: "open",
        icon: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
      },
      {
        label: "Renombrar",
        event: "rename",
        icon: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
      },
      {
        label: "Duplicar",
        event: "duplicate",
        icon: "M9 9h13v13H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
      },
    ];
    return () =>
      h(
        "div",
        {
          class: "ctx-menu",
          style: { top: props.y + "px", left: props.x + "px" },
          onClick: (e) => e.stopPropagation(),
        },
        [
          ...items.map((it) =>
            h("button", { class: "ctx-item", onClick: () => emit(it.event) }, [
              h(
                "svg",
                {
                  width: 15,
                  height: 15,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": 2,
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                },
                h("path", { d: it.icon }),
              ),
              it.label,
            ]),
          ),
          h("div", { class: "ctx-divider" }),
          h(
            "button",
            { class: "ctx-item danger", onClick: () => emit("delete") },
            [
              h(
                "svg",
                {
                  width: 15,
                  height: 15,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": 2,
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                },
                [
                  h("polyline", { points: "3 6 5 6 21 6" }),
                  h("path", {
                    d: "M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2",
                  }),
                ],
              ),
              "Eliminar",
            ],
          ),
        ],
      );
  },
});

/** ToastStack */
const ToastStack = defineComponent({
  props: { toasts: Array },
  setup(props) {
    return () =>
      h(
        "div",
        { class: "toast-wrap" },
        props.toasts.map((t) => h("div", { key: t.id, class: "toast" }, t.msg)),
      );
  },
});
</script>

<!-- ══════════════════════════════════════════════════════════════
     STYLES  (scoped to component)
══════════════════════════════════════════════════════════════ -->
<style scoped>
/* ── Design Tokens ──────────────────────────────────────────── */
.drive-shell {
  --bg: var(--ui-bg);
  --surface: var(--ui-bg);
  --card: var(--ui-bg-muted);
  --border: var(--ui-border);
  --accent: var(--ui-primary);
  --accent2: var(--ui-secondary);
  --text: var(--ui-text);
  --muted: var(--ui-text-muted);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.1);
  --radius: 12px;
  --radius-sm: 8px;
  --ease: 160ms ease;

  font-family: var(--font-ui);
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Top Bar ────────────────────────────────────────────────── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  height: 60px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(8px);
}

.topbar-search {
  flex: 1;
  max-width: 480px;
  position: relative;
  display: flex;
  align-items: center;
}
.topbar-search .ico-search {
  position: absolute;
  left: 14px;
  color: var(--muted);
  pointer-events: none;
}
.topbar-search input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 16px 8px 40px;
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--text);
  outline: none;
  transition:
    border-color var(--ease),
    box-shadow var(--ease);
}
.topbar-search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(217, 120, 69, 0.15);
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── ViewToggle ─────────────────────────────────────────────── */
:deep(.view-toggle) {
  display: flex;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
:deep(.vt-btn) {
  background: none;
  border: none;
  cursor: pointer;
  padding: 7px 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  transition:
    background var(--ease),
    color var(--ease);
}
:deep(.vt-btn.active) {
  background: var(--accent);
  color: #fff;
}
:deep(.vt-btn:hover:not(.active)) {
  background: var(--border);
  color: var(--text);
}

/* ── Layout ─────────────────────────────────────────────────── */
.main {
  display: flex;
  flex: 1;
}

/* ── Sidebar ────────────────────────────────────────────────── */

:deep(.storage-block) {
  margin-top: auto;
  padding: 12px;
}
:deep(.storage-label) {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}
:deep(.storage-bar) {
  height: 4px;
  background: var(--border);
  border-radius: 99px;
  overflow: hidden;
}
:deep(.storage-fill) {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
  transition: width 0.4s ease;
}
:deep(.storage-info) {
  font-size: 11px;
  color: var(--muted);
  margin-top: 6px;
}

/* ── Content ────────────────────────────────────────────────── */
.content {
  flex: 1;
  overflow: auto;
  padding: 28px;
}

:deep(.breadcrumb) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 20px;
}
:deep(.breadcrumb .sep) {
  color: var(--border);
}
:deep(.breadcrumb .current) {
  color: var(--text);
  font-weight: 600;
  cursor: default;
}

.section-title {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

/* ── Grid ───────────────────────────────────────────────────── */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

/* ── List ───────────────────────────────────────────────────── */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:deep(.list-header) {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
:deep(.h-icon) {
  width: 28px;
  flex-shrink: 0;
}
:deep(.h-name),
:deep(.h-type),
:deep(.h-date) {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
:deep(.h-name) {
  flex: 1;
}
:deep(.h-type) {
  width: 100px;
}
:deep(.h-date) {
  width: 130px;
  text-align: right;
}

/* ── Folder Card ────────────────────────────────────────────── */
:deep(.folder-card) {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 14px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  position: relative;
  transition:
    box-shadow var(--ease),
    transform var(--ease),
    border-color var(--ease);
  user-select: none;
}
:deep(.folder-card:hover) {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: transparent;
}
:deep(.folder-card.selected) {
  border-color: var(--accent2);
  box-shadow: 0 0 0 2px var(--accent2);
}
:deep(.folder-card.sortable-ghost) {
  opacity: 0.35;
}
:deep(.folder-card.sortable-chosen) {
  box-shadow: var(--shadow-md);
}

:deep(.card-icon) {
  width: 56px;
  height: 56px;
}
:deep(.card-name) {
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  color: var(--text);
  line-height: 1.3;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
:deep(.card-meta) {
  font-size: 11px;
  color: var(--muted);
}

:deep(.drag-grip) {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 14px;
  color: var(--muted);
  opacity: 0;
  cursor: grab;
  transition: opacity var(--ease);
  user-select: none;
}
:deep(.folder-card:hover .drag-grip) {
  opacity: 1;
}

/* ── Folder Row ─────────────────────────────────────────────── */
:deep(.folder-row) {
  background: var(--card);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition:
    background var(--ease),
    border-color var(--ease);
  user-select: none;
}
:deep(.folder-row:hover) {
  background: var(--surface);
  border-color: var(--border);
}
:deep(.folder-row.selected) {
  border-color: var(--accent2);
  background: rgba(91, 127, 166, 0.06);
}
:deep(.folder-row.sortable-ghost) {
  opacity: 0.35;
}

:deep(.row-icon) {
  flex-shrink: 0;
}
:deep(.row-name) {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
:deep(.row-type) {
  font-size: 13px;
  color: var(--muted);
  width: 100px;
  flex-shrink: 0;
}
:deep(.row-date) {
  font-size: 13px;
  color: var(--muted);
  width: 130px;
  flex-shrink: 0;
  text-align: right;
}

/* ── Dots menu ──────────────────────────────────────────────── */
:deep(.card-menu) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: 6px;
  opacity: 0;
  transition:
    opacity var(--ease),
    background var(--ease);
  display: flex;
  align-items: center;
}
:deep(.folder-card:hover .card-menu),
:deep(.folder-row:hover .card-menu) {
  opacity: 1;
}
:deep(.card-menu:hover) {
  background: var(--bg);
  color: var(--text);
}
:deep(.folder-row .card-menu) {
  position: static;
}

/* ── Empty State ────────────────────────────────────────────── */
:deep(.empty-state) {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--muted);
  text-align: center;
  opacity: 0.5;
}

/* ── Context Menu ───────────────────────────────────────────── */
:deep(.ctx-menu) {
  position: fixed;
  z-index: 300;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  padding: 6px;
  min-width: 160px;
}
:deep(.ctx-item) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 6px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  border: none;
  background: none;
  cursor: pointer;
  transition: background var(--ease);
}
:deep(.ctx-item:hover) {
  background: var(--bg);
}
:deep(.ctx-item.danger) {
  color: #c0392b;
}
:deep(.ctx-item.danger:hover) {
  background: rgba(192, 57, 43, 0.08);
}
:deep(.ctx-divider) {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

:deep(.btn-cancel) {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text);
  transition: background var(--ease);
}
:deep(.btn-cancel:hover) {
  background: var(--border);
}
:deep(.btn-create) {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ease);
}
:deep(.btn-create:hover) {
  background: #c96835;
}

/* ── Toast Stack ────────────────────────────────────────────── */
:deep(.toast-wrap) {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}
:deep(.toast) {
  background: var(--text);
  color: #fff;
  padding: 10px 20px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  animation:
    toastIn 0.25s ease,
    toastOut 0.3s ease 1.7s forwards;
  pointer-events: auto;
}
@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
  }
}
@keyframes toastOut {
  to {
    opacity: 0;
  }
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  .content {
    padding: 20px 16px;
  }
  .folder-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  :deep(.row-type),
  :deep(.row-date),
  :deep(.h-type),
  :deep(.h-date) {
    display: none;
  }
  .topbar {
    padding: 0 16px;
    gap: 10px;
  }
  .topbar-search {
    max-width: 200px;
  }
}
@media (max-width: 480px) {
  .btn-new span {
    display: none;
  }
  .folder-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
  }
}
</style>
