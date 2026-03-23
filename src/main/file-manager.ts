import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, unlink, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, dirname, extname, join, resolve } from 'path'
import { FILE_FILTERS, AUTOSAVE_PREFIX, AUTOSAVE_SUFFIX } from '../shared/constants'
import { FileType, OpenFileResult, LinkedFile } from '../shared/types'
import { addRecentFile } from './window-state'

function getFileType(filePath: string): FileType {
  const ext = extname(filePath).toLowerCase().replace('.', '')
  if (ext === 'htm') return 'html'
  if (ext === 'css') return 'css'
  if (ext === 'js') return 'js'
  return 'html'
}

export async function openFileDialog(win: BrowserWindow): Promise<OpenFileResult | null> {
  const result = await dialog.showOpenDialog(win, {
    filters: [FILE_FILTERS.all, FILE_FILTERS.html, FILE_FILTERS.css, FILE_FILTERS.js],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return readFileFromPath(result.filePaths[0])
}

export async function readFileFromPath(filePath: string): Promise<OpenFileResult> {
  const content = await readFile(filePath, 'utf-8')
  const fileType = getFileType(filePath)
  addRecentFile(filePath)
  return { filePath, content, fileType }
}

export async function saveFile(filePath: string, content: string): Promise<boolean> {
  await writeFile(filePath, content, 'utf-8')
  cleanupAutosave(filePath)
  return true
}

export async function saveFileAs(win: BrowserWindow, content: string, defaultType: FileType): Promise<{ filePath: string; success: boolean } | null> {
  const filterMap: Record<FileType, Electron.FileFilter> = {
    html: FILE_FILTERS.html,
    css: FILE_FILTERS.css,
    js: FILE_FILTERS.js,
  }
  const result = await dialog.showSaveDialog(win, {
    filters: [filterMap[defaultType], FILE_FILTERS.all],
  })
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, content, 'utf-8')
  addRecentFile(result.filePath)
  return { filePath: result.filePath, success: true }
}

export function getAutosavePath(filePath: string): string {
  const dir = dirname(filePath)
  const name = basename(filePath)
  return join(dir, `${AUTOSAVE_PREFIX}${name}${AUTOSAVE_SUFFIX}`)
}

export async function writeAutosave(filePath: string, content: string): Promise<void> {
  const tmpPath = getAutosavePath(filePath)
  await writeFile(tmpPath, content, 'utf-8')
}

export async function cleanupAutosave(filePath: string): Promise<void> {
  const tmpPath = getAutosavePath(filePath)
  try {
    if (existsSync(tmpPath)) await unlink(tmpPath)
  } catch { /* ignore */ }
}

export async function findAutosaveFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await readdir(dirPath)
    return files
      .filter(f => f.startsWith(AUTOSAVE_PREFIX) && f.endsWith(AUTOSAVE_SUFFIX))
      .map(f => join(dirPath, f))
  } catch {
    return []
  }
}

export function extractLinkedFiles(htmlContent: string, htmlFilePath: string): LinkedFile[] {
  const dir = dirname(htmlFilePath)
  const linked: LinkedFile[] = []

  // Match <link href="..."> for CSS
  const linkRegex = /<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1]
    const fullPath = resolve(dir, href)
    if (existsSync(fullPath)) {
      linked.push({ type: 'css', href, fullPath })
    }
  }

  // Match <script src="..."> for JS
  const scriptRegex = /<script[^>]+src=["']([^"']+\.js)["'][^>]*>/gi
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const href = match[1]
    const fullPath = resolve(dir, href)
    if (existsSync(fullPath)) {
      linked.push({ type: 'js', href, fullPath })
    }
  }

  return linked
}

export async function confirmSaveBeforeClose(win: BrowserWindow, fileName: string): Promise<'save' | 'discard' | 'cancel'> {
  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Unsaved Changes',
    message: `Do you want to save changes to ${fileName}?`,
    detail: 'Your changes will be lost if you close without saving.',
  })
  return (['save', 'discard', 'cancel'] as const)[result.response]
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
