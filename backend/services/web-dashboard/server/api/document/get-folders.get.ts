export default defineEventHandler(async (event) => {
  try {
    const response = await $fetch('http://localhost:8001/api/document/get-folders', {
      method: 'GET',
      headers: {
        Authorization: getHeader(event, 'authorization') ?? '',
      },
    })

    return response
  } catch (error: any) {
    throw createError({
      statusCode: error?.response?.status ?? 500,
      message: error?.message ?? 'Error fetching folders',
    })
  }
})