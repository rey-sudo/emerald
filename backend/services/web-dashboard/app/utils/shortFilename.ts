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
