import { FileTab, FileType } from '../../shared/types'

let tabIdCounter = 0

export class EditorTabs {
  private tabs: FileTab[] = []
  private activeTabId: string | null = null
  private container: HTMLElement
  private onTabSwitch: ((tab: FileTab) => void) | null = null
  private onTabClose: ((tab: FileTab) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.container.addEventListener('keydown', (e) => this.handleKeydown(e))
  }

  addTab(filePath: string | null, fileName: string, fileType: FileType, content: string): FileTab {
    if (filePath) {
      const existing = this.tabs.find(t => t.filePath === filePath)
      if (existing) {
        this.switchTo(existing.id)
        return existing
      }
    }

    const tab: FileTab = {
      id: `tab-${++tabIdCounter}`,
      filePath,
      fileName,
      fileType,
      content,
      isDirty: false,
    }
    this.tabs.push(tab)
    this.switchTo(tab.id)
    this.render()
    return tab
  }

  closeTab(tabId: string): void {
    const idx = this.tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    const tab = this.tabs[idx]
    this.tabs.splice(idx, 1)

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIdx = Math.min(idx, this.tabs.length - 1)
        this.switchTo(this.tabs[newIdx].id)
        // Focus the new active tab after render
        requestAnimationFrame(() => {
          const activeEl = this.container.querySelector<HTMLElement>('[aria-selected="true"]')
          activeEl?.focus()
        })
      } else {
        this.activeTabId = null
        if (this.onTabClose) this.onTabClose(tab)
      }
    }
    this.render()
  }

  switchTo(tabId: string): void {
    const prevTab = this.getActiveTab()
    this.activeTabId = tabId

    const newTab = this.getActiveTab()
    if (newTab && this.onTabSwitch) {
      this.onTabSwitch(newTab)
    }
    this.render()
  }

  updateContent(tabId: string, content: string): void {
    const tab = this.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.content = content
      if (!tab.isDirty) {
        tab.isDirty = true
        this.render()
      }
    }
  }

  markClean(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.isDirty = false
      this.render()
    }
  }

  markDirty(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.isDirty = true
      this.render()
    }
  }

  updateFilePath(tabId: string, filePath: string, fileName: string): void {
    const tab = this.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.filePath = filePath
      tab.fileName = fileName
      this.render()
    }
  }

  getActiveTab(): FileTab | null {
    return this.tabs.find(t => t.id === this.activeTabId) ?? null
  }

  getAllTabs(): FileTab[] {
    return this.tabs
  }

  getDirtyTabs(): FileTab[] {
    return this.tabs.filter(t => t.isDirty)
  }

  onSwitch(callback: (tab: FileTab) => void): void {
    this.onTabSwitch = callback
  }

  onClose(callback: (tab: FileTab) => void): void {
    this.onTabClose = callback
  }

  private handleKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement
    if (!target.hasAttribute('role') || target.getAttribute('role') !== 'tab') return

    const tabElements = Array.from(this.container.querySelectorAll<HTMLElement>('[role="tab"]'))
    const currentIdx = tabElements.indexOf(target)
    if (currentIdx === -1) return

    let newIdx = currentIdx
    switch (e.key) {
      case 'ArrowRight':
        newIdx = (currentIdx + 1) % tabElements.length
        break
      case 'ArrowLeft':
        newIdx = (currentIdx - 1 + tabElements.length) % tabElements.length
        break
      case 'Home':
        newIdx = 0
        break
      case 'End':
        newIdx = tabElements.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    const tabId = tabElements[newIdx].dataset.tabId
    if (tabId) {
      this.switchTo(tabId)
      tabElements[newIdx]?.focus()
    }
  }

  render(): void {
    this.container.innerHTML = ''
    for (const tab of this.tabs) {
      const isActive = tab.id === this.activeTabId
      const el = document.createElement('div')
      el.className = `tab${isActive ? ' active' : ''}${tab.isDirty ? ' dirty' : ''}`
      el.dataset.tabId = tab.id
      el.setAttribute('role', 'tab')
      el.setAttribute('aria-selected', isActive ? 'true' : 'false')
      el.setAttribute('tabindex', isActive ? '0' : '-1')
      const dirtyLabel = tab.isDirty ? ' (unsaved)' : ''
      el.setAttribute('aria-label', `${tab.fileName}${dirtyLabel}`)

      const typeIcon = tab.fileType === 'html' ? '&lt;/&gt;' : tab.fileType === 'css' ? '#' : 'JS'
      el.innerHTML = `
        <span class="dirty-dot" aria-hidden="true"></span>
        <span class="tab-type" style="font-size:0.625rem;opacity:0.6;font-weight:600" aria-hidden="true">${typeIcon}</span>
        <span class="tab-name">${tab.fileName}</span>
        <button class="tab-close" aria-label="Close ${tab.fileName}">&times;</button>
      `

      el.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).classList.contains('tab-close')) {
          this.switchTo(tab.id)
          el.focus()
        }
      })

      el.querySelector('.tab-close')!.addEventListener('click', (e) => {
        e.stopPropagation()
        if (this.onTabClose) this.onTabClose(tab)
      })

      this.container.appendChild(el)
    }
  }
}

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
