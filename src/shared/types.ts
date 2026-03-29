// IPC channel names
export const IPC = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_GET_RECENT: 'file:get-recent',
  FILE_DIRTY: 'file:dirty',
  AUTOSAVE_TICK: 'autosave:tick',
  AUTOSAVE_CHECK: 'autosave:check',
  AUTOSAVE_READ: 'autosave:read',
  AUTOSAVE_DISCARD: 'autosave:discard',
  DIALOG_CONFIRM: 'dialog:confirm',
  MENU_ACTION: 'menu:action',
  THEME_SET: 'theme:set',
  THEME_GET: 'theme:get',
  WINDOW_STATE_GET: 'window-state:get',
  WINDOW_STATE_SET: 'window-state:set',
  WINDOW_SET_TITLE: 'window:set-title',
  LICENSE_READ: 'license:read',
  GOOGLE_FONTS_FETCH: 'fonts:fetch-google',
  REPORT_SAVE: 'report:save',
} as const

// File types supported
export interface OpenFileResult {
  filePath: string
  content: string
  fileType: FileType
}

export type FileType = 'html' | 'css' | 'js'

export interface SaveFileResult {
  filePath: string
  success: boolean
}

export interface FileTab {
  id: string
  filePath: string | null
  fileName: string
  fileType: FileType
  content: string
  isDirty: boolean
}

export interface LinkedFile {
  type: FileType
  href: string
  fullPath: string
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

export interface EditorTheme {
  name: 'light' | 'dark'
}

// Matched CSS rule from stylesheets
export interface MatchedCSSRule {
  selector: string
  cssText: string        // full rule text: "selector { ... }"
  properties: string     // just the declaration block contents
  source: string         // 'embedded' | filename
  specificity: 'element' | 'class' | 'id' | 'inline'
  inherited: boolean     // true if rule matches a parent, not the element itself
}

// Preview messages sent via postMessage between iframe and parent
export interface PreviewSelectMessage {
  type: 'element-selected'
  selectorPath: string
  tagName: string
  computedStyles: Record<string, string>
  attributes: Record<string, string>
  rect: { top: number; left: number; width: number; height: number }
  matchedRules: MatchedCSSRule[]
}

export interface PreviewDragMessage {
  type: 'element-dragged'
  sourcePath: string
  targetPath: string
  position: 'before' | 'after' | 'inside'
}

export interface PreviewHoverMessage {
  type: 'element-hovered'
  selectorPath: string | null
}

export interface PreviewLinkEditMessage {
  type: 'link-edit-request'
  selectedText: string
  existingHref: string | null
  existingTarget: string | null
  existingTitle: string | null
  selectorPath: string | null
}

export interface PreviewTextEditMessage {
  type: 'text-edited'
  selectorPath: string
  newTextContent: string
}

export interface PreviewDeleteMessage {
  type: 'element-deleted'
  selectorPath: string
}

export type PreviewMessage = PreviewSelectMessage | PreviewDragMessage | PreviewHoverMessage | PreviewLinkEditMessage | PreviewTextEditMessage | PreviewDeleteMessage

// Source mapping
export interface SourceNode {
  tagName: string
  selectorPath: string
  startOffset: number
  endOffset: number
  openTagEnd: number
  children: SourceNode[]
  attributes: Record<string, string>
}

// Sync origins to prevent loops
export type SyncOrigin = 'code' | 'visual' | 'property'

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
