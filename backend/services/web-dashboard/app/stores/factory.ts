import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useFactoryStore = defineStore("factory", () => {
  const fakeFolders = [
    {
      folder_id: "019d68b0-3a11-729a-8ee6-36941b1ee84c",
      user_id: "019d2612-a01d-734c-ab63-917106f31187",
      folder_name: "Analisis",
      folder_status: "created",
      color: "#c95e6e",
      folder_storage_path:
        "019d2612-a01d-734c-ab63-917106f31187/019d68b0-3a11-729a-8ee6-36941b1ee84c",
      folder_created_at: "1775577872913",
      folder_updated_at: null,
      documents: [
        {
          id: "019d68be-afaa-73d7-a09a-c33de046bdc6",
          originalName: "acuerdo-001-2024.pdf",
          internalName: "019d68be-afaa-73d7-a09a-c33de046bdc6.pdf",
          contentType: "application/pdf",
          mimeType: "application/pdf",
          sizeBytes: 1736174,
          storagePath:
            "019d2612-a01d-734c-ab63-917106f31187/019d68b0-3a11-729a-8ee6-36941b1ee84c/019d68be-afaa-73d7-a09a-c33de046bdc6.pdf",
          status: "processed",
          checksum: null,
          context: null,
          keywords: null,
          metadata:
            '{"folder_id": "019d68b0-3a11-729a-8ee6-36941b1ee84c", "size_bytes": 1736174, "original_name": "acuerdo-001-2024.pdf"}',
          createdAt: 1775578820522,
          updatedAt: 1775578833737,
        },
        {
          id: "019d68b0-5a93-7fa7-935d-35f54f39742e",
          originalName: "ACUERDO No. 001 del 2024.pdf",
          internalName: "019d68b0-5a93-7fa7-935d-35f54f39742e.pdf",
          contentType: "application/pdf",
          mimeType: "application/pdf",
          sizeBytes: 1656288,
          storagePath:
            "019d2612-a01d-734c-ab63-917106f31187/019d68b0-3a11-729a-8ee6-36941b1ee84c/019d68b0-5a93-7fa7-935d-35f54f39742e.pdf",
          status: "pending",
          checksum: null,
          context: null,
          keywords: null,
          metadata:
            '{"folder_id": "019d68b0-3a11-729a-8ee6-36941b1ee84c", "size_bytes": 1656288, "original_name": "ACUERDO No. 001 del 2024.pdf"}',
          createdAt: 1775577881235,
          updatedAt: null,
        },
      ],
    },
  ];

  const folders = ref(fakeFolders);
  const pending = ref(false);

  const filteredFolders = computed(() =>
    folders.value.filter((folder) => true),
  );
  const sidebarFolders = computed(() => folders.value.filter((folder) => true));

  async function getFolders() {
    pending.value = true;
    try {
      folders.value = await $fetch("/api/editor/get-folders");
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
    sidebarFolders
  };
});
