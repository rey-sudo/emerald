export default defineEventHandler(async (event) => {
  const files = await readMultipartFormData(event)
  
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No files' })
  }

  const file = files[0]
  
  console.log(file)

  return { success: true }
})