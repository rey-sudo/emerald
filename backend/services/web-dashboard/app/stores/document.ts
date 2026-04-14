import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useDocumentStore = defineStore("document", () => {
  const fakeFolders = [
    {
      folder_id: "019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe",
      user_id: "019d2612-a01d-734c-ab63-917106f31187",
      folder_name: "Aduanero",
      folder_status: "created",
      color: "#e0a84b",
      folder_storage_path:
        "019d2612-a01d-734c-ab63-917106f31187/019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe",
      folder_created_at: 1775916105006,
      folder_updated_at: null,
      documents:
        '[{"id" : "019d7f53-6704-7746-8a20-fb7cc408e25e", "originalName" : "DECRETO 1080 DE 2015 _ Normatividad AGN.pdf", "internalName" : "019d7f53-6704-7746-8a20-fb7cc408e25e.pdf", "contentType" : "application/pdf", "mimeType" : "application/pdf", "sizeBytes" : 2548421, "storagePath" : "019d2612-a01d-734c-ab63-917106f31187/019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe/019d7f53-6704-7746-8a20-fb7cc408e25e.pdf", "status" : "processed", "checksum" : null, "context" : null, "keywords" : null, "metadata" : {"folder_id": "019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe", "size_bytes": 2548421, "original_name": "DECRETO 1080 DE 2015 _ Normatividad AGN.pdf"}, "createdAt" : 1775957665540, "updatedAt" : 1775957684223}, {"id" : "019d7e00-4165-727f-95c1-ff8c2d871671", "originalName" : "ACUERDO No. 001 del 2024.pdf", "internalName" : "019d7e00-4165-727f-95c1-ff8c2d871671.pdf", "contentType" : "application/pdf", "mimeType" : "application/pdf", "sizeBytes" : 1656288, "storagePath" : "019d2612-a01d-734c-ab63-917106f31187/019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe/019d7e00-4165-727f-95c1-ff8c2d871671.pdf", "status" : "processed", "checksum" : null, "context" : null, "keywords" : null, "metadata" : {"folder_id": "019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe", "size_bytes": 1656288, "original_name": "ACUERDO No. 001 del 2024.pdf"}, "createdAt" : 1775935439205, "updatedAt" : 1775935451719}, {"id" : "019d7dff-9653-7800-9343-92f54f5bd4aa", "originalName" : "acuerdo-001-2024.pdf", "internalName" : "019d7dff-9653-7800-9343-92f54f5bd4aa.pdf", "contentType" : "application/pdf", "mimeType" : "application/pdf", "sizeBytes" : 1736174, "storagePath" : "019d2612-a01d-734c-ab63-917106f31187/019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe/019d7dff-9653-7800-9343-92f54f5bd4aa.pdf", "status" : "processed", "checksum" : null, "context" : null, "keywords" : null, "metadata" : {"folder_id": "019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe", "size_bytes": 1736174, "original_name": "acuerdo-001-2024.pdf"}, "createdAt" : 1775935395411, "updatedAt" : 1775935406756}, {"id" : "019d7cda-6850-79e1-a203-a3a46a34a90b", "originalName" : "acuerdo-001-2024.pdf", "internalName" : "019d7cda-6850-79e1-a203-a3a46a34a90b.pdf", "contentType" : "application/pdf", "mimeType" : "application/pdf", "sizeBytes" : 1736174, "storagePath" : "019d2612-a01d-734c-ab63-917106f31187/019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe/019d7cda-6850-79e1-a203-a3a46a34a90b.pdf", "status" : "processed", "checksum" : null, "context" : null, "keywords" : null, "metadata" : {"folder_id": "019d7cd9-3d2e-7aee-bd03-2be84e0fc9fe", "size_bytes": 1736174, "original_name": "acuerdo-001-2024.pdf"}, "createdAt" : 1775916181584, "updatedAt" : 1775916195577}]',
    },
  ];

  const folders = ref(fakeFolders);
  const pending = ref(false);

  const filteredFolders = computed(() =>
    folders.value.filter((folder) => folder.folder_status === "created"),
  );

  async function getFolders() {
    pending.value = true;
    try {
      //folders.value = await $fetch("/api/document/get-folders");
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
  };
});
