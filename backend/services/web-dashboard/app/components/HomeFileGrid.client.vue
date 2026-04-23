<template>
  <div class="drive-shell">
    <!--------------------------------------------------
         UPLOAD FILE MODAL
    ---------------------------------------------------->
    <UModal
      v-model:open="fileUploadDialog"
      title="File upload"
      :ui="{
        content: 'w-auto max-w-fit',
        body: 'p-4 sm:p-6',
        footer: 'justify-end',
      }"
    >
      <template #body>
        <div class="space-y-4">
          <UFileUpload
            v-model="filesToUpload"
            layout="list"
            multiple
            label="Drop your files here"
            description="PDF, DOCX, MD or TXT (max. 200MB)"
            class="w-96"
            :ui="{
              base: 'min-h-48',
            }"
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
          label="Upload"
          color="primary"
          :loading="isSubmiting"
          @click="onSubmit(close)"
        />
      </template>
    </UModal>
    <!--------------------------------------------------
         UPDATE FILE MODAL
    ---------------------------------------------------->
    <UModal
      v-model:open="updateFileDialog"
      title="Update file"
      :ui="{
        content: 'w-auto max-w-fit',
        body: 'p-4 sm:p-6',
        footer: 'justify-end',
      }"
    >
      <template #body>
        <div class="space-y-4">
          <UInput
            v-model="updateFileName"
            class="w-full"
            placeholder="Filename"
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
          @click="onUpdateDocument(close)"
        />
      </template>
    </UModal>

    <!--------------------------------------------------
         DELETE FOLDER MODAL
    ---------------------------------------------------->
    <UModal
      v-model:open="deleteDocumentDialog"
      title="Delete document"
      :ui="{
        content: 'w-auto max-w-fit',
        body: 'p-4 sm:p-6',
        footer: 'justify-end',
      }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-x-4">
            Are you sure you want to delete this document?
          </div>
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
          label="Delete"
          color="primary"
          :loading="isSubmiting"
          @click="onDeleteDocument(close)"
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
          size="lg"
          variant="outline"
          color="secondary"
          placeholder="Search..."
          :ui="{ base: 'caret-[initial]' }"
        />
      </label>

      <div class="topbar-actions">
        <UFieldGroup size="lg">
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
          icon="material-symbols:upload-2-outline-rounded"
          label="File upload"
          size="lg"
          @click="fileUploadDialog = true"
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
          <FileCard
            v-for="file in currentDocuments"
            :key="file.id"
            :file="file"
            :selected="selectedId === file.id"
            @events="handleFolderEvents($event, file)"
          />
        </div>

        <!-- ── List view ── -->
        <div v-else ref="listRef" class="folder-list">
          <ListHeader v-if="currentDocuments.length > 0" />

          <FolderRow
            v-for="folder in currentDocuments"
            :key="folder.id"
            :folder="folder"
            :selected="selectedId === folder.id"
            @click.stop="selectedId = folder.id"
            @dblclick=""
            @menu="(e) => console.log(e)"
          />
        </div>

        <HomeFileEmpty v-if="currentDocuments.length === 0" />
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

const props = defineProps({
  folderId: {
    type: String,
    default: null,
  },

  folderName: {
    type: String,
    default: null,
  },
});

const router = useRouter();

const toast = useToast();

const documentStore = useDocumentStore();

const currentDocuments = computed(() => {
  return documentStore.getDocumentsByFolderId(props.folderId);
});

const fileUploadDialog = ref(false);
const filesToUpload = ref([]);

const selectedId = ref(null);

const updateFileDialog = ref(false);
const updateFileId = ref(null);
const updateFileData = ref(null);
const updateFileName = ref("Filename");

const deleteDocumentDialog = ref(false);
const deleteDocumentId = ref(null);

const isSubmiting = ref(false);

const handleFolderEvents = (event, document) => {
  console.log(event, document);

  if (event.name === "click") {
    selectedId.value = document.id;
  }

  if (event.name === "dblclick") {
    router.push({
      path: `/document/${document.id}`,
    });
  }

  if (event.name === "update") {
    updateFileId.value = document.id;
    updateFileData.value = document;
    updateFileName.value = document.originalName;
    updateFileDialog.value = true;
  }

  if (event.name === "delete") {
    deleteDocumentId.value = document.id;
    deleteDocumentDialog.value = true;
  }
};

const onUpdateDocument = async (close) => {
  try {
    isSubmiting.value = true;

    const params = {
      ...updateFileData.value,
      id: updateFileId.value,
      original_name: updateFileName.value
    };

    if (JSON.stringify(params) === JSON.stringify(updateFileData.value)) {
      return;
    }

    await documentStore.updateDocument(
      params.id,
      params.original_name
    );

    updateFileId.value = null;
    updateFileData.value = null;

    toast.add({
      title: `Document updated`,
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


const onDeleteDocument = async (close) => {
  try {
    isSubmiting.value = true;

    await documentStore.deleteDocument(deleteDocumentId.value);
    deleteDocumentId.value = null;

    toast.add({
      title: `Document deleted`,
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

const onSubmit = async (_close) => {
  isSubmiting.value = true;

  for (let i = filesToUpload.value.length - 1; i >= 0; i--) {
    const file = filesToUpload.value[i];

    try {
      await documentStore.uploadFile(file, props.folderId);

      toast.add({
        id: i.toString(),
        title: `File uploaded: ${file.name}`,
        icon: "i-lucide-circle-check",
        duration: 1_000,
      });
    } catch (e) {
      toast.add({
        id: i.toString(),
        title: `Upload failed: ${file.name}`,
        icon: "i-lucide-x",
        duration: 3_000,
        color: "error",
        progress: false,
      });
    } finally {
      await promiseTimeout(1_000);
      filesToUpload.value.splice(i, 1);
    }
  }

  filesToUpload.value = [];
  isSubmiting.value = false;
};

const breadItems = [
  {
    label: "My folders",
    icon: "",
    to: "/",
  },
  {
    label: props.folderName,
    to: "/",
  },
];

const view = ref("grid"); // 'grid' | 'list'
const search = ref("");

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

function openFileUploadDialog() {
  fileUploadDialog.value = true;
}

defineExpose({
  openFileUploadDialog,
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

/* ── Grid ───────────────────────────────────────────────────── */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
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

:deep(.card-icon) {
  width: 60px;
  height: 60px;
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
