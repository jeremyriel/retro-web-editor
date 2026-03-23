import { app, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { createMenu, setMenuTheme } from './menu'
import { getWindowState, saveWindowState, getTheme } from './window-state'
import { MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../shared/constants'
import { IPC } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const state = getWindowState()

  // In dev: __dirname = out/main, so ../../resources/icon.png reaches project root resources/
  // In production: app.isPackaged, resources are in process.resourcesPath
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: 'Retro Web Editor',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
      webSecurity: false, // Allow iframe srcdoc to load local file:// resources (CSS, JS, images)
    },
  })

  if (state.isMaximized) {
    mainWindow.maximize()
  }

  const savedTheme = getTheme() as 'light' | 'dark'
  if (savedTheme === 'dark') setMenuTheme('dark')
  createMenu(mainWindow)

  // Save window state on close/resize
  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })

  // Dirty-state quit handling
  mainWindow.on('close', (e) => {
    // The renderer will handle confirming save via IPC
    // This is handled by the renderer sending back 'can-close'
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()

  ipcMain.handle(IPC.WINDOW_SET_TITLE, (_event, title: string) => {
    if (mainWindow) mainWindow.setTitle(title)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
