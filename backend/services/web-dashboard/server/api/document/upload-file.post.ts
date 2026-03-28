import type { FetchError } from 'ofetch'

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);

  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No files provided." });
  }

  const filePart = parts.find((p) => p.name === "file");
  const folderPart = parts.find((p) => p.name === "folder_id");

  if (!filePart?.data || !filePart.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: "Campo 'file' requerido.",
    });
  }

  if (!folderPart?.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Campo 'folder_id' requerido.",
    });
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([filePart.data], {
      type: filePart.type ?? "application/octet-stream",
    }),
    filePart.filename,
  );
  form.append("folder_id", folderPart.data.toString());

  const config = useRuntimeConfig();

  try {
    const response = await $fetch(
      "http://localhost:8001/api/document/upload-file",
      {
        method: "POST",
        body: form,
      },
    );

    return response;
  } catch (err: any) {
    const error = err as FetchError

    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Internal Server Error',
      data: error.data || { message: "No details" },
    });
  }
});
