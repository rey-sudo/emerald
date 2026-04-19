export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  try {
    const response = await $fetch(
      `http://localhost:8001/api/document/delete-document/${id}`,
      {
        method: "DELETE",
      },
    );

    return response;
  } catch (e: any) {
    throw createError({
      statusCode: e?.response?.status ?? 500,
      message: e?.data?.message ?? e?.message ?? "Error deleting document",
    });
  }
});
