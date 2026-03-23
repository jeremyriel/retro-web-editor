export const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
export const SYNC_DEBOUNCE_MS = 300
export const AUTOSAVE_PREFIX = '.~rwe-'
export const AUTOSAVE_SUFFIX = '.tmp'
export const DEFAULT_WINDOW_WIDTH = 1400
export const DEFAULT_WINDOW_HEIGHT = 900
export const MIN_WINDOW_WIDTH = 800
export const MIN_WINDOW_HEIGHT = 600
export const DEFAULT_GRID_SIZE = 20
export const GRID_COLOR = 'rgba(100, 149, 237, 0.15)'
export const GRID_COLOR_DARK = 'rgba(100, 149, 237, 0.1)'

export const FILE_FILTERS = {
  html: { name: 'HTML Files', extensions: ['html', 'htm'] },
  css: { name: 'CSS Files', extensions: ['css'] },
  js: { name: 'JavaScript Files', extensions: ['js'] },
  all: { name: 'Web Files', extensions: ['html', 'htm', 'css', 'js'] },
}

export const SUPPORTED_EXTENSIONS = new Set(['html', 'htm', 'css', 'js'])

export const CSS_PROPERTY_GROUPS = {
  'Box Model': ['margin', 'padding', 'border', 'border-radius', 'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height'],
  'Typography': ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'color'],
  'Layout': ['display', 'position', 'flex-direction', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'grid-template-rows'],
  'Colors & Background': ['background-color', 'background-image', 'opacity'],
  'Position': ['top', 'right', 'bottom', 'left', 'z-index'],
  'Overflow & Visibility': ['overflow', 'visibility'],
  'Accessibility': ['outline', 'outline-offset', 'cursor'],
}

export const HTML_ATTRIBUTES_BY_TAG: Record<string, string[]> = {
  '*': ['id', 'class', 'title', 'style', 'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden', 'tabindex'],
  'a': ['href', 'target', 'rel'],
  'img': ['src', 'alt', 'width', 'height'],
  'input': ['type', 'name', 'value', 'placeholder'],
  'form': ['action', 'method'],
  'button': ['type', 'disabled'],
  'table': ['border', 'cellpadding', 'cellspacing'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan', 'scope'],
  'iframe': ['src', 'width', 'height', 'frameborder'],
  'video': ['src', 'controls', 'autoplay', 'loop'],
  'audio': ['src', 'controls', 'autoplay', 'loop'],
  'link': ['rel', 'href', 'type'],
  'script': ['src', 'type', 'async', 'defer'],
  'meta': ['name', 'content', 'charset'],
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
