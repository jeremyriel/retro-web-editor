import { ipcMain, BrowserWindow, app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { IPC } from '../shared/types'
import {
  openFileDialog,
  readFileFromPath,
  saveFile,
  saveFileAs,
  writeAutosave,
  confirmSaveBeforeClose,
  extractLinkedFiles,
  getAutosavePath,
  cleanupAutosave,
} from './file-manager'
import { getTheme, setTheme, getRecentFiles, removeRecentFile, clearRecentFiles } from './window-state'
import { setMenuTheme, createMenu } from './menu'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.FILE_OPEN, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    return openFileDialog(win)
  })

  ipcMain.handle(IPC.FILE_READ, async (_event, filePath: string) => {
    return readFileFromPath(filePath)
  })

  ipcMain.handle(IPC.FILE_SAVE, async (_event, filePath: string, content: string) => {
    return saveFile(filePath, content)
  })

  ipcMain.handle(IPC.FILE_SAVE_AS, async (event, content: string, fileType: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    return saveFileAs(win, content, fileType as 'html' | 'css' | 'js')
  })

  ipcMain.handle(IPC.FILE_GET_RECENT, async () => {
    return getRecentFiles()
  })

  ipcMain.handle('file:remove-recent', async (_event, filePath: string) => {
    removeRecentFile(filePath)
    return getRecentFiles()
  })

  ipcMain.handle('file:clear-recent', async () => {
    clearRecentFiles()
    return []
  })

  ipcMain.handle(IPC.AUTOSAVE_TICK, async (_event, filePath: string, content: string) => {
    await writeAutosave(filePath, content)
  })

  ipcMain.handle(IPC.AUTOSAVE_CHECK, async (_event, filePath: string) => {
    const tmpPath = getAutosavePath(filePath)
    if (!existsSync(tmpPath)) return null
    const original = await readFile(filePath, 'utf-8')
    const recovered = await readFile(tmpPath, 'utf-8')
    if (original === recovered) {
      // Autosave matches original — clean it up silently
      await cleanupAutosave(filePath)
      return null
    }
    return { autosavePath: tmpPath, content: recovered }
  })

  ipcMain.handle(IPC.AUTOSAVE_READ, async (_event, filePath: string) => {
    const tmpPath = getAutosavePath(filePath)
    return readFile(tmpPath, 'utf-8')
  })

  ipcMain.handle(IPC.AUTOSAVE_DISCARD, async (_event, filePath: string) => {
    await cleanupAutosave(filePath)
  })

  ipcMain.handle(IPC.THEME_GET, async () => {
    return getTheme()
  })

  ipcMain.handle(IPC.THEME_SET, async (event, theme: string) => {
    setTheme(theme)
    setMenuTheme(theme as 'light' | 'dark')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) createMenu(win)
  })

  ipcMain.handle(IPC.DIALOG_CONFIRM, async (event, fileName: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return 'cancel'
    return confirmSaveBeforeClose(win, fileName)
  })

  ipcMain.handle('file:extract-linked', async (_event, htmlContent: string, htmlFilePath: string) => {
    return extractLinkedFiles(htmlContent, htmlFilePath)
  })

  ipcMain.handle(IPC.LICENSE_READ, async () => {
    const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
    const licensePath = join(base, 'copying', 'LICENSE_GNU_GPL_3.0.txt')
    return readFile(licensePath, 'utf-8')
  })

  ipcMain.handle(IPC.REPORT_SAVE, async (event, content: string, defaultName: string, filePath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const defaultPath = filePath ? join(dirname(filePath), defaultName) : defaultName
    const result = await dialog.showSaveDialog(win, {
      defaultPath,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, content, 'utf-8')
    return true
  })

  let googleFontsCache: { family: string; category: string }[] | null = null

  ipcMain.handle(IPC.GOOGLE_FONTS_FETCH, async () => {
    if (googleFontsCache) return googleFontsCache
    const res = await fetch('https://fonts.google.com/metadata/fonts')
    const text = await res.text()
    // Strip XSS protection prefix )]}'
    const jsonStr = text.replace(/^\)\]\}'?\n?/, '')
    const data = JSON.parse(jsonStr)
    googleFontsCache = data.familyMetadataList.map((f: { family: string; category: string }) => ({
      family: f.family,
      category: f.category,
    }))
    return googleFontsCache
  })
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
