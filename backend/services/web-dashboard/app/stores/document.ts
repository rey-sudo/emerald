import { defineStore } from "pinia";
import { ref, computed } from "vue";

/**
 * Metadatos internos de cada documento
 */
export interface IDocumentMetadata {
  folder_id: string;
  size_bytes: number;
  original_name: string;
}

/**
 * Representa un archivo individual dentro de una carpeta
 */
export interface IDocument {
  id: string;
  originalName: string;
  internalName: string;
  contentType: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: "processed" | "pending" | "error" | string;
  checksum: string | null;
  context: string | null;
  keywords: string[] | null;
  metadata: IDocumentMetadata;
  createdAt: number;
  updatedAt: number;
}

/**
 * Representa la estructura de la carpeta (Folder)
 */
export interface IFolder {
  folder_id: string;
  user_id: string;
  folder_name: string;
  folder_status: "created" | string;
  color: string;
  folder_storage_path: string;
  folder_created_at: number;
  folder_updated_at: number | null;
  documents: IDocument[];
}

/**
 * Tipo para la respuesta de la API (Array de carpetas)
 */
export type FolderListResponse = IFolder[];

export const useDocumentStore = defineStore("document", () => {
  const folders = ref<IFolder[]>([]);
  const pending = ref(false);

  const filteredFolders = computed(() =>
    folders.value.filter((folder: any) => folder?.folder_status === "created"),
  );

  function getDocumentsByFolderId (folderId: string) {
    const folder = filteredFolders.value.find((f) => f.folder_id === folderId);

    if (!folder) return [];

    return folder.documents;
  };

  async function getFolders() {
    pending.value = true;
    try {
      folders.value = await $fetch("/api/document/get-folders");
    } catch (e: any) {
      throw e;
    } finally {
      pending.value = false;
    }
  }

  async function createFolder(name: string, color: string) {
    pending.value = true;
    try {
      const response = await $fetch("/api/document/create-folder", {
        method: "POST",
        body: { name, color },
      });

      await getFolders();
      return response;
    } catch (e: any) {
      throw e;
    } finally {
      pending.value = false;
    }
  }

  async function uploadFile(file: File, folderId: string) {
    pending.value = true;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder_id", folderId);

    try {
      const response = await $fetch("/api/document/upload-file", {
        method: "POST",
        body: formData,
        // headers: { Authorization: `Bearer ${token}` }
      });

      return response;
    } catch (e: any) {
      throw e;
    } finally {
      pending.value = false;
    }
  }

  return {
    folders,
    pending,
    filteredFolders,
    getFolders,
    createFolder,
    uploadFile,
    getDocumentsByFolderId,
  };
});
