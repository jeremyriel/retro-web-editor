export type ViewMode = 'split' | 'code-only' | 'preview-only'

export class SplitView {
  private workspace: HTMLElement
  private handle: HTMLElement
  private editorPane: HTMLElement
  private previewPane: HTMLElement
  private dragOverlay: HTMLElement
  private mode: ViewMode = 'split'
  private splitRatio = 0.5
  private isDragging = false

  constructor() {
    this.workspace = document.getElementById('workspace')!
    this.handle = document.getElementById('split-handle')!
    this.editorPane = document.getElementById('editor-pane')!
    this.previewPane = document.getElementById('preview-pane')!
    this.dragOverlay = document.getElementById('drag-overlay')!

    this.handle.addEventListener('mousedown', (e) => this.startDrag(e))
    document.addEventListener('mousemove', (e) => this.onDrag(e))
    document.addEventListener('mouseup', () => this.stopDrag())
    this.handle.addEventListener('keydown', (e) => this.onKeydown(e))

    this.applyRatio()
  }

  setMode(mode: ViewMode): void {
    this.mode = mode
    this.workspace.classList.remove('code-only', 'preview-only')
    if (mode !== 'split') {
      this.workspace.classList.add(mode)
    }
    if (mode === 'split') {
      this.applyRatio()
    }
  }

  getMode(): ViewMode {
    return this.mode
  }

  toggleMode(): void {
    const modes: ViewMode[] = ['split', 'code-only', 'preview-only']
    const idx = modes.indexOf(this.mode)
    this.setMode(modes[(idx + 1) % modes.length])
  }

  private startDrag(e: MouseEvent): void {
    e.preventDefault()
    this.isDragging = true
    this.handle.classList.add('dragging')
    this.dragOverlay.classList.add('active')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  private onDrag(e: MouseEvent): void {
    if (!this.isDragging) return
    const rect = this.workspace.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    this.splitRatio = Math.max(0.1, Math.min(0.9, ratio))
    this.applyRatio()
  }

  private stopDrag(): void {
    if (!this.isDragging) return
    this.isDragging = false
    this.handle.classList.remove('dragging')
    this.dragOverlay.classList.remove('active')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  private onKeydown(e: KeyboardEvent): void {
    const step = 0.02 // ~20px on a 1000px workspace
    let newRatio = this.splitRatio

    switch (e.key) {
      case 'ArrowLeft':
        newRatio = Math.max(0.1, this.splitRatio - step)
        break
      case 'ArrowRight':
        newRatio = Math.min(0.9, this.splitRatio + step)
        break
      case 'Home':
        newRatio = 0.1
        break
      case 'End':
        newRatio = 0.9
        break
      default:
        return
    }

    e.preventDefault()
    this.splitRatio = newRatio
    this.applyRatio()
  }

  private applyRatio(): void {
    this.editorPane.style.flex = `${this.splitRatio}`
    this.previewPane.style.flex = `${1 - this.splitRatio}`
    this.handle.setAttribute('aria-valuenow', String(Math.round(this.splitRatio * 100)))
  }
}

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
