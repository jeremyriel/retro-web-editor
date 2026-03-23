export class Toolbar {
  private container: HTMLElement
  private onAction: ((action: string, value?: string) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
  }

  private render(): void {
    this.container.innerHTML = ''
    this.container.setAttribute('role', 'toolbar')
    this.container.setAttribute('aria-label', 'Formatting toolbar')

    const groups: { items: ToolbarItem[], separator?: boolean }[] = [
      {
        items: [
          { action: 'bold', icon: SVG.bold, title: 'Bold (Ctrl+B)' },
          { action: 'italic', icon: SVG.italic, title: 'Italic (Ctrl+I)' },
          { action: 'underline', icon: SVG.underline, title: 'Underline (Ctrl+U)' },
          { action: 'strikethrough', icon: SVG.strikethrough, title: 'Strikethrough' },
        ],
      },
      {
        separator: true,
        items: [
          { action: 'heading', type: 'select', options: ['Paragraph', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'], title: 'Heading level' },
        ],
      },
      {
        separator: true,
        items: [
          { action: 'link', icon: SVG.link, title: 'Insert Link' },
          { action: 'image', icon: SVG.image, title: 'Insert Image' },
          { action: 'table', icon: SVG.table, title: 'Insert Table' },
          { action: 'div', icon: SVG.div, title: 'Insert Div' },
          { action: 'ul', icon: SVG.ul, title: 'Unordered List' },
          { action: 'ol', icon: SVG.ol, title: 'Ordered List' },
        ],
      },
      {
        separator: true,
        items: [
          { action: 'align-left', icon: SVG.alignLeft, title: 'Align Left' },
          { action: 'align-center', icon: SVG.alignCenter, title: 'Align Center' },
          { action: 'align-right', icon: SVG.alignRight, title: 'Align Right' },
          { action: 'align-justify', icon: SVG.alignJustify, title: 'Justify' },
        ],
      },
      {
        separator: true,
        items: [
          { action: 'wcag-validate', icon: SVG.accessibility, title: 'WCAG Accessibility Validator' },
          { action: 'show-hotkeys', icon: SVG.keyboard, title: 'Keyboard Shortcuts (Ctrl+/)' },
          { action: 'toggle-help-hovers', icon: SVG.help, title: 'Toggle Help Hovers', id: 'help-hover-btn' },
        ],
      },
    ]

    for (const group of groups) {
      if (group.separator) {
        const sep = document.createElement('div')
        sep.className = 'separator'
        sep.setAttribute('role', 'separator')
        this.container.appendChild(sep)
      }

      for (const item of group.items) {
        if (item.type === 'select') {
          const select = document.createElement('select')
          select.title = item.title
          select.setAttribute('aria-label', item.title)
          for (const opt of item.options!) {
            const option = document.createElement('option')
            option.value = opt.toLowerCase()
            option.textContent = opt
            select.appendChild(option)
          }
          select.addEventListener('change', () => {
            if (this.onAction) this.onAction(item.action, select.value)
            select.value = 'paragraph'
          })
          this.container.appendChild(select)
        } else {
          const btn = document.createElement('button')
          btn.title = item.title
          btn.setAttribute('aria-label', item.title)
          btn.innerHTML = item.icon!
          // Mark SVGs as decorative
          btn.querySelectorAll('svg').forEach(svg => svg.setAttribute('aria-hidden', 'true'))
          if (item.id) btn.id = item.id
          btn.addEventListener('click', () => {
            if (this.onAction) this.onAction(item.action)
          })
          this.container.appendChild(btn)
        }
      }
    }
  }

  onToolbarAction(callback: (action: string, value?: string) => void): void {
    this.onAction = callback
  }
}

interface ToolbarItem {
  action: string
  icon?: string
  title: string
  type?: 'select'
  options?: string[]
  id?: string
}

const SVG = {
  bold: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>`,
  italic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`,
  underline: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>`,
  strikethrough: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  table: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  div: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  ul: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>`,
  ol: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="4" y="7" font-size="6" fill="currentColor" stroke="none">1</text><text x="4" y="13" font-size="6" fill="currentColor" stroke="none">2</text><text x="4" y="19" font-size="6" fill="currentColor" stroke="none">3</text></svg>`,
  alignLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>`,
  alignCenter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
  alignRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>`,
  alignJustify: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  help: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  keyboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`,
  accessibility: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
