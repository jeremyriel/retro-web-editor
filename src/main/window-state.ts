import Store from 'electron-store'
import { BrowserWindow } from 'electron'
import { WindowState } from '../shared/types'
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from '../shared/constants'

const store = new Store<{ windowState: WindowState; theme: string; recentFiles: string[] }>({
  defaults: {
    windowState: {
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
      isMaximized: false,
    },
    theme: 'light',
    recentFiles: [],
  },
})

export function getWindowState(): WindowState {
  return store.get('windowState')
}

export function saveWindowState(win: BrowserWindow): void {
  if (win.isMaximized()) {
    store.set('windowState.isMaximized', true)
  } else {
    const bounds = win.getBounds()
    store.set('windowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
    })
  }
}

export function getTheme(): string {
  return store.get('theme')
}

export function setTheme(theme: string): void {
  store.set('theme', theme)
}

export function getRecentFiles(): string[] {
  return store.get('recentFiles')
}

export function addRecentFile(filePath: string): void {
  const recent = store.get('recentFiles')
  const filtered = recent.filter((f: string) => f !== filePath)
  filtered.unshift(filePath)
  store.set('recentFiles', filtered.slice(0, 10))
}

export function removeRecentFile(filePath: string): void {
  const recent = store.get('recentFiles')
  store.set('recentFiles', recent.filter((f: string) => f !== filePath))
}

export function clearRecentFiles(): void {
  store.set('recentFiles', [])
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
