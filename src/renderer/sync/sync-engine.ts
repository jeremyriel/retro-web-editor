import { SyncOrigin, SourceNode } from '../../shared/types'
import { SYNC_DEBOUNCE_MS } from '../../shared/constants'
import { debounce } from './debounce'
import { parseHTML, findNodeBySelector } from './html-parser'

type SyncCallback = (content: string, origin: SyncOrigin) => void

export class SyncEngine {
  private sourceNodes: SourceNode[] = []
  private currentOrigin: SyncOrigin | null = null
  private onPreviewUpdate: SyncCallback | null = null
  private onCodeUpdate: SyncCallback | null = null
  private onPropertyUpdate: SyncCallback | null = null
  private htmlContent = ''

  readonly debouncedCodeToPreview: ReturnType<typeof debounce>

  constructor() {
    this.debouncedCodeToPreview = debounce(() => {
      if (this.onPreviewUpdate && this.currentOrigin !== 'code') {
        // Don't suppress — always update preview from code
      }
      this.rebuildSourceMap()
      if (this.onPreviewUpdate) {
        this.onPreviewUpdate(this.htmlContent, 'code')
      }
    }, SYNC_DEBOUNCE_MS)
  }

  setCallbacks(callbacks: {
    onPreviewUpdate?: SyncCallback
    onCodeUpdate?: SyncCallback
    onPropertyUpdate?: SyncCallback
  }): void {
    if (callbacks.onPreviewUpdate) this.onPreviewUpdate = callbacks.onPreviewUpdate
    if (callbacks.onCodeUpdate) this.onCodeUpdate = callbacks.onCodeUpdate
    if (callbacks.onPropertyUpdate) this.onPropertyUpdate = callbacks.onPropertyUpdate
  }

  // Called when code editor content changes
  codeChanged(content: string): void {
    this.htmlContent = content
    if (this.currentOrigin === 'visual' || this.currentOrigin === 'property') {
      // This change was triggered by us writing back to the editor — skip preview update
      this.currentOrigin = null
      return
    }
    this.debouncedCodeToPreview()
  }

  // Called when a visual edit happens in the preview
  visualEdit(selectorPath: string, newOuterHTML: string): void {
    this.currentOrigin = 'visual'
    const node = findNodeBySelector(this.sourceNodes, selectorPath)
    if (!node || !this.onCodeUpdate) {
      this.currentOrigin = null
      return
    }
    const newContent = this.htmlContent.substring(0, node.startOffset) + newOuterHTML + this.htmlContent.substring(node.endOffset)
    this.htmlContent = newContent
    this.onCodeUpdate(newContent, 'visual')
    this.rebuildSourceMap()
    this.currentOrigin = null
  }

  // Called when element is moved via drag-and-drop
  moveElement(sourcePath: string, targetPath: string, position: 'before' | 'after' | 'inside'): void {
    this.currentOrigin = 'visual'
    const sourceNode = findNodeBySelector(this.sourceNodes, sourcePath)
    const targetNode = findNodeBySelector(this.sourceNodes, targetPath)
    if (!sourceNode || !targetNode || !this.onCodeUpdate) {
      this.currentOrigin = null
      return
    }

    const sourceHTML = this.htmlContent.substring(sourceNode.startOffset, sourceNode.endOffset)

    // Remove source first
    let newContent = this.htmlContent.substring(0, sourceNode.startOffset) + this.htmlContent.substring(sourceNode.endOffset)

    // Recalculate target position after removal
    const offset = sourceNode.startOffset < targetNode.startOffset ? -(sourceNode.endOffset - sourceNode.startOffset) : 0
    let insertPos: number
    if (position === 'before') {
      insertPos = targetNode.startOffset + offset
    } else if (position === 'after') {
      insertPos = targetNode.endOffset + offset
    } else {
      insertPos = targetNode.openTagEnd + offset
    }

    newContent = newContent.substring(0, insertPos) + '\n' + sourceHTML + '\n' + newContent.substring(insertPos)
    this.htmlContent = newContent
    this.onCodeUpdate(newContent, 'visual')
    this.rebuildSourceMap()
    this.currentOrigin = null
  }

  // Called when a CSS property is changed in the property panel
  propertyChanged(selectorPath: string, property: string, value: string): void {
    this.currentOrigin = 'property'
    const node = findNodeBySelector(this.sourceNodes, selectorPath)
    if (!node || !this.onCodeUpdate) {
      this.currentOrigin = null
      return
    }

    // Update inline style
    const tagContent = this.htmlContent.substring(node.startOffset, node.openTagEnd)
    const styleMatch = tagContent.match(/style=["']([^"']*)["']/)
    let newTagContent: string

    if (styleMatch) {
      const existingStyle = styleMatch[1]
      const styles = parseInlineStyles(existingStyle)
      if (value) {
        styles[property] = value
      } else {
        delete styles[property]
      }
      const newStyleStr = Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('; ')
      if (newStyleStr) {
        newTagContent = tagContent.replace(/style=["'][^"']*["']/, `style="${newStyleStr}"`)
      } else {
        newTagContent = tagContent.replace(/\s*style=["'][^"']*["']/, '')
      }
    } else if (value) {
      // Add style attribute before closing >
      const insertPos = tagContent.length - 1
      newTagContent = tagContent.substring(0, insertPos) + ` style="${property}: ${value}"` + tagContent.substring(insertPos)
    } else {
      this.currentOrigin = null
      return
    }

    const newContent = this.htmlContent.substring(0, node.startOffset) + newTagContent + this.htmlContent.substring(node.openTagEnd)
    this.htmlContent = newContent
    this.onCodeUpdate(newContent, 'property')
    this.rebuildSourceMap()
    this.currentOrigin = null
  }

  // Called when an HTML attribute is changed in the property panel
  attributeChanged(selectorPath: string, attrName: string, attrValue: string): void {
    this.currentOrigin = 'property'
    const node = findNodeBySelector(this.sourceNodes, selectorPath)
    if (!node || !this.onCodeUpdate) {
      this.currentOrigin = null
      return
    }

    const tagContent = this.htmlContent.substring(node.startOffset, node.openTagEnd)
    const attrRegex = new RegExp(`${attrName}=["'][^"']*["']`)
    let newTagContent: string

    if (attrRegex.test(tagContent)) {
      if (attrValue) {
        newTagContent = tagContent.replace(attrRegex, `${attrName}="${attrValue}"`)
      } else {
        newTagContent = tagContent.replace(new RegExp(`\\s*${attrName}=["'][^"']*["']`), '')
      }
    } else if (attrValue) {
      const insertPos = tagContent.length - 1
      newTagContent = tagContent.substring(0, insertPos) + ` ${attrName}="${attrValue}"` + tagContent.substring(insertPos)
    } else {
      this.currentOrigin = null
      return
    }

    const newContent = this.htmlContent.substring(0, node.startOffset) + newTagContent + this.htmlContent.substring(node.openTagEnd)
    this.htmlContent = newContent
    this.onCodeUpdate(newContent, 'property')
    this.rebuildSourceMap()
    this.currentOrigin = null
  }

  getSourceNodes(): SourceNode[] {
    return this.sourceNodes
  }

  getContent(): string {
    return this.htmlContent
  }

  setContent(content: string): void {
    this.htmlContent = content
    this.rebuildSourceMap()
  }

  private rebuildSourceMap(): void {
    this.sourceNodes = parseHTML(this.htmlContent)
  }
}

function parseInlineStyles(styleStr: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of styleStr.split(';')) {
    const colonIdx = part.indexOf(':')
    if (colonIdx > 0) {
      const prop = part.substring(0, colonIdx).trim()
      const val = part.substring(colonIdx + 1).trim()
      if (prop && val) result[prop] = val
    }
  }
  return result
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
