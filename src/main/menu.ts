import { Menu, BrowserWindow, app } from 'electron'

let gridChecked = false
let outlinesChecked = false
let propertiesChecked = false
let helpHoversChecked = false
let currentThemeMenu: 'light' | 'dark' = 'light'

export function setMenuTheme(theme: 'light' | 'dark'): void {
  currentThemeMenu = theme
}

export function createMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => win.webContents.send('menu:action', 'open'),
        },
        {
          label: 'Open Recent...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => win.webContents.send('menu:action', 'open-recent'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.send('menu:action', 'save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => win.webContents.send('menu:action', 'save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'WCAG Validator',
          click: () => win.webContents.send('menu:action', 'wcag-validate'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Code/Preview',
          accelerator: 'CmdOrCtrl+\\',
          click: () => win.webContents.send('menu:action', 'toggle-view'),
        },
        {
          label: 'Code Only',
          accelerator: 'CmdOrCtrl+1',
          click: () => win.webContents.send('menu:action', 'view-code'),
        },
        {
          label: 'Split View',
          accelerator: 'CmdOrCtrl+2',
          click: () => win.webContents.send('menu:action', 'view-split'),
        },
        {
          label: 'Preview Only',
          accelerator: 'CmdOrCtrl+3',
          click: () => win.webContents.send('menu:action', 'view-preview'),
        },
        { type: 'separator' },
        {
          label: 'Grid Overlay',
          accelerator: 'CmdOrCtrl+G',
          type: 'checkbox',
          checked: gridChecked,
          click: (menuItem) => { gridChecked = menuItem.checked; win.webContents.send('menu:action', 'toggle-grid') },
        },
        {
          label: 'DOM Outlines',
          accelerator: 'CmdOrCtrl+Shift+G',
          type: 'checkbox',
          checked: outlinesChecked,
          click: (menuItem) => { outlinesChecked = menuItem.checked; win.webContents.send('menu:action', 'toggle-outlines') },
        },
        { type: 'separator' },
        {
          label: 'Properties Panel',
          accelerator: 'CmdOrCtrl+P',
          type: 'checkbox',
          checked: propertiesChecked,
          click: (menuItem) => { propertiesChecked = menuItem.checked; win.webContents.send('menu:action', 'toggle-properties') },
        },
        { type: 'separator' },
        {
          label: 'Theme: Light',
          type: 'radio',
          checked: currentThemeMenu === 'light',
          click: () => { currentThemeMenu = 'light'; win.webContents.send('menu:action', 'theme-light') },
        },
        {
          label: 'Theme: Dark',
          type: 'radio',
          checked: currentThemeMenu === 'dark',
          click: () => { currentThemeMenu = 'dark'; win.webContents.send('menu:action', 'theme-dark') },
        },
        { type: 'separator' },
        {
          label: 'Zoom In Code',
          accelerator: 'CmdOrCtrl+=',
          click: () => win.webContents.send('menu:action', 'code-zoom-in'),
        },
        {
          label: 'Zoom Out Code',
          accelerator: 'CmdOrCtrl+-',
          click: () => win.webContents.send('menu:action', 'code-zoom-out'),
        },
        {
          label: 'Reset Code Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => win.webContents.send('menu:action', 'code-zoom-reset'),
        },
        { type: 'separator' },
        {
          label: 'Zoom In Preview',
          accelerator: 'CmdOrCtrl+Shift+=',
          click: () => win.webContents.send('menu:action', 'preview-zoom-in'),
        },
        {
          label: 'Zoom Out Preview',
          accelerator: 'CmdOrCtrl+Shift+-',
          click: () => win.webContents.send('menu:action', 'preview-zoom-out'),
        },
        {
          label: 'Reset Preview Zoom',
          accelerator: 'CmdOrCtrl+Shift+0',
          click: () => win.webContents.send('menu:action', 'preview-zoom-reset'),
        },
        { type: 'separator' },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => win.webContents.send('menu:action', 'show-hotkeys'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Help Hovers',
          accelerator: 'F1',
          type: 'checkbox',
          checked: helpHoversChecked,
          click: (menuItem) => { helpHoversChecked = menuItem.checked; win.webContents.send('menu:action', 'toggle-help-hovers') },
        },
        { type: 'separator' },
        {
          label: 'About WIRED',
          click: () => win.webContents.send('menu:action', 'about'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
