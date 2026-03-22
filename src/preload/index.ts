import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

const api = {
  // File operations
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ, filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC.FILE_SAVE, filePath, content),
  saveFileAs: (content: string, fileType: string) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, content, fileType),
  getRecentFiles: () => ipcRenderer.invoke(IPC.FILE_GET_RECENT),
  extractLinkedFiles: (htmlContent: string, htmlFilePath: string) =>
    ipcRenderer.invoke('file:extract-linked', htmlContent, htmlFilePath),
  removeRecentFile: (filePath: string) => ipcRenderer.invoke('file:remove-recent', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('file:clear-recent'),

  // Autosave
  autosave: (filePath: string, content: string) => ipcRenderer.invoke(IPC.AUTOSAVE_TICK, filePath, content),
  checkAutosave: (filePath: string) => ipcRenderer.invoke(IPC.AUTOSAVE_CHECK, filePath) as Promise<{ autosavePath: string; content: string } | null>,
  discardAutosave: (filePath: string) => ipcRenderer.invoke(IPC.AUTOSAVE_DISCARD, filePath),

  // Theme
  getTheme: () => ipcRenderer.invoke(IPC.THEME_GET),
  setTheme: (theme: string) => ipcRenderer.invoke(IPC.THEME_SET, theme),

  // License
  readLicenseFile: () => ipcRenderer.invoke(IPC.LICENSE_READ),

  // Google Fonts
  fetchGoogleFonts: () => ipcRenderer.invoke(IPC.GOOGLE_FONTS_FETCH) as Promise<{ family: string; category: string }[]>,

  // Reports
  saveReport: (content: string, defaultName: string, filePath?: string) => ipcRenderer.invoke(IPC.REPORT_SAVE, content, defaultName, filePath) as Promise<boolean>,

  // Dialogs
  confirmSave: (fileName: string) => ipcRenderer.invoke(IPC.DIALOG_CONFIRM, fileName),

  // Window title
  setWindowTitle: (title: string) => ipcRenderer.invoke(IPC.WINDOW_SET_TITLE, title),

  // Menu actions from main process
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on(IPC.MENU_ACTION, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_ACTION, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type WiredAPI = typeof api

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
