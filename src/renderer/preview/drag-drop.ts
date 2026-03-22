import { PreviewFrame } from './preview-frame'

export class DragDropManager {
  private previewFrame: PreviewFrame
  private enabled = false

  constructor(previewFrame: PreviewFrame) {
    this.previewFrame = previewFrame
  }

  toggle(): void {
    this.enabled = !this.enabled
    this.previewFrame.setDragDrop(this.enabled)
  }

  enable(): void {
    this.enabled = true
    this.previewFrame.setDragDrop(true)
  }

  disable(): void {
    this.enabled = false
    this.previewFrame.setDragDrop(false)
  }

  isEnabled(): boolean {
    return this.enabled
  }
}

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
