/**
 * Extracts the extension from a filename and returns it in uppercase.
 * @param fileName - The full name of the file (e.g., "test3.pdf")
 * @returns The extension in uppercase (e.g., "PDF") or an empty string if none exists.
 */
export const getFileExtension = (fileName: string): string => {
  if (!fileName || !fileName.includes('.')) {
    return '';
  }

  // Extract the part after the last dot
  const extension = fileName.split('.').pop();

  return extension ? extension.toUpperCase() : '';
};
