import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useDocumentStore = defineStore("document", () => {
  const fakeFolders = [
    {
      id: "019d265f-79d6-7f8f-a0e8-73d727d70cd0",
      user_id: "019d2612-a01d-734c-ab63-917106f31187",
      status: "created",
      name: "folder1",
      storage_path:
        "/storage/019d2612-a01d-734c-ab63-917106f31187/019d265f-79d6-7f8f-a0e8-73d727d70cd0",
      document_count: 2,
      color: "red",
      created_at: 1774465284566,
      readed_at: null,
      updated_at: null,
      deleted_at: null,
      v: 0,
    },
    {
      id: "019d285b-f0ff-798f-b27d-9f28646d76e2",
      user_id: "019d2612-a01d-734c-ab63-917106f31187",
      status: "created",
      name: "folder1",
      storage_path:
        "/storage/019d2612-a01d-734c-ab63-917106f31187/019d285b-f0ff-798f-b27d-9f28646d76e2",
      color: "green",
      document_count: 0,
      created_at: 1774498607359,
      readed_at: null,
      updated_at: null,
      deleted_at: null,
      v: 0,
    },
  ];

  const folders = ref(fakeFolders);
  const pending = ref(false);
  const error = ref(null);

  const filteredFolders = computed(() =>
    folders.value.filter((folder) => folder.status === "created"),
  );

  async function getFolders() {
    pending.value = true;
    error.value = null;

    try {
      folders.value = await $fetch("/api/document/get-folders");
    } catch (e: any) {
      error.value = e;
    } finally {
      pending.value = false;
    }
  }

  async function createFolder(name: string, color: string) {
    pending.value = true;
    error.value = null;

    try {
      const response = await $fetch("/api/document/create-folder", {
        method: "POST",
        body: { name, color },
      });

      await getFolders();
      return response;
    } catch (e: any) {
      error.value = e;
    } finally {
      pending.value = false;
    }
  }

  async function uploadFile(file: File) {
    pending.value = true;
    error.value = null;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await $fetch("/api/document/upload-document", {
        method: "POST",
        body: formData,
        // headers: { Authorization: `Bearer ${token}` }
      });

      console.log("Server response:", response);

      return response;
    } catch (e: any) {
      error.value = e.data || e.message;
      console.error("Upload failed:", e);
      throw e;
    } finally {
      pending.value = false;
    }
  }

  return {
    folders,
    pending,
    error,
    filteredFolders,
    getFolders,
    createFolder,
    uploadFile,
  };
});
