import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { FileType } from '../../shared/types'

export class CodeEditor {
  private view: EditorView | null = null
  private container: HTMLElement
  private onChange: ((content: string) => void) | null = null
  private currentTheme: 'light' | 'dark' = 'light'
  private currentLang: FileType = 'html'
  private suppressChange = false
  private fontSize = 14

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(lang: FileType = 'html', theme: 'light' | 'dark' = 'light'): void {
    this.currentTheme = theme
    this.currentLang = lang

    const extensions = this.buildExtensions(lang, theme)

    const state = EditorState.create({
      doc: '',
      extensions,
    })

    this.view = new EditorView({
      state,
      parent: this.container,
    })
    this.view.dom.setAttribute('aria-label', 'Code editor')
  }

  private buildExtensions(lang: FileType, theme: 'light' | 'dark'): Extension[] {
    const langExt = lang === 'css' ? css() : lang === 'js' ? javascript() : html()

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      langExt,
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: this.fontSize + 'px' },
        '.cm-content': { fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace" },
        '.cm-gutters': { fontSize: this.fontSize + 'px' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.suppressChange && this.onChange) {
          this.onChange(this.getContent())
        }
      }),
    ]

    if (theme === 'dark') {
      extensions.push(oneDark)
      extensions.push(EditorView.theme({
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: 'rgba(81, 139, 219, 0.4) !important',
        },
      }, { dark: true }))
    }

    return extensions
  }

  setContent(content: string): void {
    if (!this.view) return
    this.suppressChange = true
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content,
      },
    })
    this.suppressChange = false
  }

  getContent(): string {
    return this.view?.state.doc.toString() ?? ''
  }

  setLanguage(lang: FileType): void {
    if (lang === this.currentLang) return
    this.currentLang = lang
    this.recreateEditor()
  }

  setTheme(theme: 'light' | 'dark'): void {
    if (theme === this.currentTheme) return
    this.currentTheme = theme
    this.recreateEditor()
  }

  private recreateEditor(): void {
    if (!this.view) return
    const content = this.getContent()
    const cursorPos = this.view.state.selection.main.head
    this.view.destroy()

    const extensions = this.buildExtensions(this.currentLang, this.currentTheme)
    const state = EditorState.create({ doc: content, extensions })
    this.view = new EditorView({ state, parent: this.container })
    this.view.dom.setAttribute('aria-label', 'Code editor')

    // Restore cursor
    const safePos = Math.min(cursorPos, content.length)
    this.view.dispatch({ selection: { anchor: safePos } })
  }

  onContentChange(callback: (content: string) => void): void {
    this.onChange = callback
  }

  replaceRange(from: number, to: number, text: string): void {
    if (!this.view) return
    this.suppressChange = true
    this.view.dispatch({ changes: { from, to, insert: text } })
    this.suppressChange = false
  }

  focus(): void {
    this.view?.focus()
  }

  destroy(): void {
    this.view?.destroy()
    this.view = null
  }

  zoomIn(): void {
    this.fontSize = Math.min(32, this.fontSize + 2)
    this.recreateEditor()
  }

  zoomOut(): void {
    this.fontSize = Math.max(8, this.fontSize - 2)
    this.recreateEditor()
  }

  resetZoom(): void {
    this.fontSize = 14
    this.recreateEditor()
  }

  getFontSize(): number {
    return this.fontSize
  }

  getView(): EditorView | null {
    return this.view
  }

  scrollToOffset(offset: number, endOffset?: number): void {
    if (!this.view) return
    const pos = Math.min(offset, this.view.state.doc.length)
    const end = endOffset !== undefined ? Math.min(endOffset, this.view.state.doc.length) : pos
    this.view.dispatch({
      selection: { anchor: pos, head: end },
      scrollIntoView: true,
    })
  }
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
