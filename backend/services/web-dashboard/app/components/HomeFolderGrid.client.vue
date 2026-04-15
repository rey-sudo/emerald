<template>
  <div class="drive-shell">
    <!--------------------------------------------------
         NEW FOLDER MODAL
    ---------------------------------------------------->
    <UModal
      v-model:open="newFolderDialog"
      title="New folder"
      :ui="{
        content: 'w-auto max-w-fit',
        body: 'p-4 sm:p-6',
        footer: 'justify-end',
      }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-x-4">
            <UPopover>
              <UButton
                label="Color"
                color="neutral"
                variant="outline"
                size="md"
              >
                <template #leading>
                  <span
                    :style="newFolderColorChip"
                    class="size-3 rounded-full"
                  />
                </template>
              </UButton>

              <template #content>
                <UColorPicker
                  v-model="newFolderColor"
                  class="p-2"
                  format="hex"
                />
              </template>
            </UPopover>

            <UFieldGroup orientation="horizontal" size="md">
              <UButton
                v-for="color in FOLDER_COLORS"
                color="neutral"
                variant="ghost"
                @click="newFolderColor = color"
              >
                <span
                  :style="{ backgroundColor: color }"
                  class="size-3 rounded-full"
                />
              </UButton>
            </UFieldGroup>
          </div>

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
        <UButton
          label="Create"
          color="primary"
          :loading="isSubmiting"
          @click="onCreateFolder(close)"
        />
      </template>
    </UModal>
    <!--------------------------------------------------
         UPDATE FOLDER MODAL
    ---------------------------------------------------->
    <UModal
      v-model:open="updateFolderDialog"
      title="Update folder"
      :ui="{
        content: 'w-auto max-w-fit',
        body: 'p-4 sm:p-6',
        footer: 'justify-end',
      }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-x-4">
            <UPopover>
              <UButton
                label="Color"
                color="neutral"
                variant="outline"
                size="md"
              >
                <template #leading>
                  <span
                    :style="updateFolderColorChip"
                    class="size-3 rounded-full"
                  />
                </template>
              </UButton>

              <template #content>
                <UColorPicker
                  v-model="updateFolderColor"
                  class="p-2"
                  format="hex"
                />
              </template>
            </UPopover>

            <UFieldGroup orientation="horizontal" size="md">
              <UButton
                v-for="color in FOLDER_COLORS"
                color="neutral"
                variant="ghost"
                @click="updateFolderColor = color"
              >
                <span
                  :style="{ backgroundColor: color }"
                  class="size-3 rounded-full"
                />
              </UButton>
            </UFieldGroup>
          </div>

          <UInput
            v-model="updateFolderName"
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
        <UButton
          label="Save"
          color="primary"
          :loading="isSubmiting"
          @click="onUpdateFolder(close)"
        />
      </template>
    </UModal>

    <!--------------------------------------------------
         HEADER
    ---------------------------------------------------->
    <header class="topbar" oncontextmenu="return false;">
      <label class="topbar-search">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          size="md"
          variant="outline"
          color="secondary"
          placeholder="Search..."
          :ui="{ base: 'caret-[initial]' }"
        />
      </label>

      <div class="topbar-actions">
        <UFieldGroup size="md">
          <UButton
            :color="view === 'list' ? 'primary' : 'neutral'"
            variant="outline"
            icon="material-symbols:menu-rounded"
            @click="view = 'list'"
          />
          <UButton
            :color="view === 'grid' ? 'primary' : 'neutral'"
            variant="outline"
            icon="material-symbols:grid-view-outline-rounded"
            @click="view = 'grid'"
          />
        </UFieldGroup>
        <UButton
          color="primary"
          variant="outline"
          icon="ic:round-plus"
          label="New folder"
          size="md"
          @click="newFolderDialog = true"
        />
      </div>
    </header>
    <!----------------------------------------------------
         MAIN LAYOUT
    ------------------------------------------------------>
    <div class="main">
      <!-- Content -->
      <main class="content">
        <UBreadcrumb
          :items="breadItems"
          :ui="{
            link: 'group relative flex items-center gap-1.5 text-lg min-w-0 focus-visible:outline-primary font-medium',
          }"
        >
          <template #separator>
            <span class="mx-2 text-muted">/</span>
          </template>
        </UBreadcrumb>

        <!-- ── Grid view ── -->
        <div v-if="view === 'grid'" ref="gridRef" class="folder-grid">
          <FolderCard
            v-for="folder in documentStore.filteredFolders"
            :key="folder.folder_id"
            :folder="folder"
            :selected="selectedId === folder.folder_id"
            @events="handleFolderEvents($event, folder)"
          />
        </div>

        <!-- ── List view ── -->
        <div v-else ref="listRef" class="folder-list">
          <ListHeader v-if="documentStore.filteredFolders.length > 0" />

          <FolderRow
            v-for="folder in documentStore.filteredFolders"
            :key="folder.folder_id"
            :folder="folder"
            :selected="selectedId === folder.folder_id"
            @click.stop="selectedId = folder.folder_id"
            @dblclick=""
            @menu="(e) => console.log(e)"
          />
        </div>

        <HomeEmptyFolders v-if="documentStore.filteredFolders.length === 0" />
      </main>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  defineComponent,
  h,
} from "vue";
import { promiseTimeout } from "@vueuse/core";

const toast = useToast();

const router = useRouter();

const documentStore = useDocumentStore();

const FOLDER_COLORS = [
  "#85B7EB", // blue
  "#5DCAA5", // teal
  "#AFA9EC", // purple
  "#EF9F27", // amber
  "#F0997B", // coral
  "#ED93B1", // pink
  "#97C459", // green
  "#F09595", // red
  "#B4B2A9", // gray
];

const newFolderDialog = ref(false);
const newFolderName = ref("Untitled folder");
const newFolderColor = ref("#e0a84b");
const newFolderColorChip = computed(() => ({
  backgroundColor: newFolderColor.value,
}));

const updateFolderId = ref(null);
const updateFolderDialog = ref(false);
const updateFolderName = ref("Untitled folder");
const updateFolderColor = ref("#e0a84b");
const updateFolderColorChip = computed(() => ({
  backgroundColor: updateFolderColor.value,
}));

const isSubmiting = ref(false);

const onCreateFolder = async (close) => {
  try {
    isSubmiting.value = true;

    await documentStore.createFolder(newFolderName.value, newFolderColor.value);

    toast.add({
      title: `Folder created`,
      icon: "i-lucide-circle-check",
      duration: 1_000,
      progress: false,
    });
  } catch (e) {
    toast.add({
      title: `Something is wrong`,
      icon: "i-lucide-x",
      duration: 1_000,
      color: "error",
      progress: false,
    });
  } finally {
    await promiseTimeout(1_000);
    isSubmiting.value = false;
    close();
  }
};

const handleFolderEvents = (event, folder) => {
  console.log(event, folder);

  if (event.name === "click") {
    selectedId.value = folder.folder_id;
  }

  if (event.name === "dblclick") {
    router.push({
      path: `/folder/${folder.folder_id}`,
      query: {
        folderName: folder.folder_name,
      },
    });
  }

  if (event.name === "update") {
    updateFolderId.value = folder.folder_id;
    updateFolderName.value = folder.folder_name;
    updateFolderColor.value = folder.color;
    updateFolderDialog.value = true;
  }
};

const onUpdateFolder = async (close) => {
  try {
    isSubmiting.value = true;

    await documentStore.updateFolder(
      updateFolderId.value,
      updateFolderName.value,
      updateFolderColor.value,
    );

    updateFolderId.value = null;

    toast.add({
      title: `Folder updated`,
      icon: "i-lucide-circle-check",
      duration: 1_000,
      progress: false,
    });
  } catch (e) {
    toast.add({
      title: `Something is wrong`,
      icon: "i-lucide-x",
      duration: 1_000,
      color: "error",
      progress: false,
    });
  } finally {
    await promiseTimeout(1_000);
    isSubmiting.value = false;
    close();
  }
};

const breadItems = [
  {
    label: "Home",
    icon: "material-symbols:home-outline-rounded",
    to: "/",
  },
];

const view = ref("grid"); // 'grid' | 'list'
const search = ref("");
const selectedId = ref(null);

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

function openNewFolderDialog() {
  newFolderDialog.value = true;
}

defineExpose({
  openNewFolderDialog,
});
</script>

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
  caret-color: transparent;
}

/* ── Top Bar ────────────────────────────────────────────────── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  height: 60px;
  padding: 0 1rem;
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

/* ── Layout ─────────────────────────────────────────────────── */
.main {
  display: flex;
  flex: 1;
}

/* ── Content ────────────────────────────────────────────────── */
.content {
  flex: 1;
  overflow: auto;
  padding: 1rem 2rem;
}

.folder-grid {
  gap: 1rem;
  display: grid;
  margin-top: 2rem;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

/* ── List ───────────────────────────────────────────────────── */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 1rem;
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

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 768px) {
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
