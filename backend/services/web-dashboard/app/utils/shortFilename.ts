export function shortFileName(fileName: string, maxLength = 20) {
  const lastDot = fileName.lastIndexOf(".");
  const hasExtension = lastDot !== -1;

  const name = hasExtension ? fileName.slice(0, lastDot) : fileName;
  const ext = hasExtension ? fileName.slice(lastDot) : ""; 

  if (fileName.length <= maxLength) return fileName;

  const maxNameLength = maxLength - ext.length;
  const shortName = name.slice(0, maxNameLength).trimEnd();

  return shortName + '..' + ext;
}
