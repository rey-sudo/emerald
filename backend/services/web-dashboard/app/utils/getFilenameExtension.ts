// Emerald
// Copyright (C) 2026 Juan José Caballero Rey - https://github.com/rey-sudo
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

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
