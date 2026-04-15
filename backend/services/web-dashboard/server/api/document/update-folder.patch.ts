export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  try {
    console.log(body);

    const response = await $fetch(
      "http://localhost:8001/api/document/update-folder",
      {
        method: "PATCH",
        body: body,
      },
    );

    return response;
  } catch (e: any) {
    throw createError({
      statusCode: e?.response?.status ?? 500,
      message: e?.data?.message ?? e?.message ?? "Error creating folder",
    });
  }
});
