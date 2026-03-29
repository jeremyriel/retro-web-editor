import { CSS_PROPERTY_GROUPS, HTML_ATTRIBUTES_BY_TAG } from '../../shared/constants'
import { MatchedCSSRule, PreviewSelectMessage } from '../../shared/types'
import { createColorInput } from './color-picker'

const COLOR_PROPERTIES = new Set(['color', 'background-color'])
let propInputIdCounter = 0

export class PropertyPanel {
  private container: HTMLElement
  private cssSection: HTMLElement
  private stylesheetSection: HTMLElement
  private attrSection: HTMLElement
  private tabButtons: NodeListOf<Element>
  private currentSelection: PreviewSelectMessage | null = null
  private onCSSChange: ((property: string, value: string) => void) | null = null
  private onAttrChange: ((attr: string, value: string) => void) | null = null
  private onStylesheetRuleChange: ((rule: MatchedCSSRule, newProperties: string) => void) | null = null
  private onAddStylesheetRule: ((selector: string) => void) | null = null
  private getPreferredCSSSource: (() => string) | null = null
  private onGoogleFontsClick: (() => void) | null = null
  private pendingStylesheetCommits: (() => void)[] = []

  constructor() {
    this.container = document.getElementById('properties-panel')!
    this.cssSection = document.getElementById('css-properties')!
    this.stylesheetSection = document.getElementById('stylesheet-properties')!
    this.attrSection = document.getElementById('attr-properties')!
    this.tabButtons = document.querySelectorAll('.prop-tab')

    // Tab switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.tabButtons.forEach(b => {
          b.classList.remove('active')
          b.setAttribute('aria-selected', 'false')
        })
        btn.classList.add('active')
        btn.setAttribute('aria-selected', 'true')
        const tab = (btn as HTMLElement).dataset.tab
        this.cssSection.classList.toggle('active', tab === 'css')
        this.stylesheetSection.classList.toggle('active', tab === 'stylesheet')
        this.attrSection.classList.toggle('active', tab === 'attributes')
      })
    })

    // Close button
    document.getElementById('properties-close')!.addEventListener('click', () => {
      this.hide()
    })
  }

  show(): void {
    this.container.classList.remove('hidden')
  }

  hide(): void {
    this.container.classList.add('hidden')
  }

  toggle(): void {
    this.container.classList.toggle('hidden')
  }

  isVisible(): boolean {
    return !this.container.classList.contains('hidden')
  }

  setSelection(msg: PreviewSelectMessage): void {
    this.currentSelection = msg
    this.show()
    this.renderCSS(msg.computedStyles)
    this.renderStylesheet(msg.matchedRules || [])
    this.renderAttributes(msg.tagName, msg.attributes)
    document.getElementById('properties-title')!.textContent = `<${msg.tagName}>`

    // Show element info bar with tag, id, class
    const infoBar = document.getElementById('properties-element-info')!
    infoBar.classList.remove('hidden')
    document.getElementById('element-info-tag')!.textContent = msg.tagName
    const idVal = msg.attributes['id'] || ''
    const idEl = document.getElementById('element-info-id')!
    idEl.textContent = idVal ? `#${idVal}` : ''
    idEl.classList.toggle('hidden', !idVal)
    const classVal = msg.attributes['class'] || ''
    const classEl = document.getElementById('element-info-class')!
    classEl.textContent = classVal ? `.${classVal.trim().split(/\s+/).join('.')}` : ''
    classEl.classList.toggle('hidden', !classVal)
  }

  clearSelection(): void {
    this.flushPendingStylesheetCommits()
    this.currentSelection = null
    this.cssSection.innerHTML = '<div class="no-selection-msg">Click an element in the preview to inspect its properties</div>'
    this.stylesheetSection.innerHTML = '<div class="no-selection-msg">Click an element in the preview to see stylesheet rules</div>'
    this.attrSection.innerHTML = '<div class="no-selection-msg">Click an element in the preview to inspect its attributes</div>'
    document.getElementById('properties-title')!.textContent = 'Properties'
    document.getElementById('properties-element-info')!.classList.add('hidden')
  }

  onCSSPropertyChange(callback: (property: string, value: string) => void): void {
    this.onCSSChange = callback
  }

  onAttributeChange(callback: (attr: string, value: string) => void): void {
    this.onAttrChange = callback
  }

  onStylesheetRuleChanged(callback: (rule: MatchedCSSRule, newProperties: string) => void): void {
    this.onStylesheetRuleChange = callback
  }

  onAddRule(callback: (selector: string) => void): void {
    this.onAddStylesheetRule = callback
  }

  setPreferredCSSSource(fn: () => string): void {
    this.getPreferredCSSSource = fn
  }

  onGoogleFontsOpen(callback: () => void): void {
    this.onGoogleFontsClick = callback
  }

  setFontFamily(value: string): void {
    if (this.onCSSChange) this.onCSSChange('font-family', value)
  }

  private renderCSS(styles: Record<string, string>): void {
    this.cssSection.innerHTML = ''

    for (const [groupName, properties] of Object.entries(CSS_PROPERTY_GROUPS)) {
      const group = document.createElement('div')
      group.className = 'prop-group'

      const title = document.createElement('div')
      title.className = 'prop-group-title'
      title.textContent = groupName
      group.appendChild(title)

      for (const prop of properties) {
        const value = styles[prop] || ''
        const row = document.createElement('div')
        row.className = 'prop-row'

        const inputId = `prop-css-${++propInputIdCounter}`
        const label = document.createElement('label')
        label.textContent = prop
        label.title = prop
        label.htmlFor = inputId
        row.appendChild(label)

        if (COLOR_PROPERTIES.has(prop)) {
          const colorEl = createColorInput(value, prop, (newVal) => {
            if (this.onCSSChange) this.onCSSChange(prop, newVal)
          })
          row.appendChild(colorEl)
        } else {
          const input = document.createElement('input')
          input.type = 'text'
          input.id = inputId
          input.value = value
          input.addEventListener('change', () => {
            if (this.onCSSChange) this.onCSSChange(prop, input.value)
          })
          row.appendChild(input)

          if (prop === 'font-family') {
            const gfBtn = document.createElement('button')
            gfBtn.className = 'gfonts-prop-btn'
            gfBtn.type = 'button'
            gfBtn.title = 'Browse Google Fonts'
            gfBtn.setAttribute('aria-label', 'Browse Google Fonts')
            gfBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
            gfBtn.addEventListener('click', () => {
              if (this.onGoogleFontsClick) this.onGoogleFontsClick()
            })
            row.appendChild(gfBtn)
          }
        }

        group.appendChild(row)
      }

      this.cssSection.appendChild(group)
    }
  }

  private flushPendingStylesheetCommits(): void {
    const commits = this.pendingStylesheetCommits.splice(0)
    for (const fn of commits) fn()
  }

  private renderStylesheet(rules: MatchedCSSRule[]): void {
    this.flushPendingStylesheetCommits()
    this.stylesheetSection.innerHTML = ''

    // "Add Rule" section — offer to create rules for tag, classes, id
    if (this.currentSelection && this.onAddStylesheetRule) {
      const sel = this.currentSelection
      const addGroup = document.createElement('div')
      addGroup.className = 'prop-group'
      const addTitle = document.createElement('div')
      addTitle.className = 'prop-group-title'
      addTitle.textContent = 'Add rule'
      addGroup.appendChild(addTitle)

      const selectors: string[] = []
      selectors.push(sel.tagName)
      const classVal = sel.attributes['class'] || ''
      if (classVal) {
        for (const cls of classVal.trim().split(/\s+/)) {
          selectors.push(`.${cls}`)
        }
      }
      const idVal = sel.attributes['id'] || ''
      if (idVal) {
        selectors.push(`#${idVal}`)
      }

      // Only show selectors that don't already have a direct rule
      const existingSelectors = new Set(rules.filter(r => !r.inherited).map(r => r.selector))
      const newSelectors = selectors.filter(s => !existingSelectors.has(s))

      if (newSelectors.length > 0) {
        const row = document.createElement('div')
        row.className = 'stylesheet-add-row'
        for (const s of newSelectors) {
          const btn = document.createElement('button')
          btn.className = 'stylesheet-add-btn'
          btn.textContent = `+ ${s}`
          btn.title = `Add ${s} { } rule to stylesheet`
          btn.addEventListener('click', () => {
            if (this.onAddStylesheetRule) this.onAddStylesheetRule(s)
            // Determine the source: first open CSS tab filename, else 'embedded'
            const cssTabName = this.getPreferredCSSSource?.() || 'embedded'
            // Remove the button and add an editable rule block in its place
            btn.remove()
            const newRule: MatchedCSSRule = {
              selector: s,
              cssText: `${s} {  }`,
              properties: '',
              source: cssTabName,
              specificity: s.startsWith('#') ? 'id' : s.startsWith('.') ? 'class' : 'element',
              inherited: false,
            }
            this.appendRuleBlock(newRule)
          })
          row.appendChild(btn)
        }
        addGroup.appendChild(row)
        this.stylesheetSection.appendChild(addGroup)
      }
    }

    if (rules.length === 0) {
      if (!this.stylesheetSection.hasChildNodes()) {
        this.stylesheetSection.innerHTML = '<div class="no-selection-msg">No stylesheet rules match this element</div>'
      }
      return
    }

    // Group by source
    const directRules = rules.filter(r => !r.inherited)
    const inheritedRules = rules.filter(r => r.inherited)

    if (directRules.length > 0) {
      this.renderRuleGroup('Direct rules', directRules)
    }
    if (inheritedRules.length > 0) {
      this.renderRuleGroup('Inherited', inheritedRules)
    }
  }

  private renderRuleGroup(title: string, rules: MatchedCSSRule[]): void {
    const group = document.createElement('div')
    group.className = 'prop-group'

    const groupTitle = document.createElement('div')
    groupTitle.className = 'prop-group-title'
    groupTitle.textContent = title
    group.appendChild(groupTitle)

    // Sub-group by source file
    const bySource = new Map<string, MatchedCSSRule[]>()
    for (const rule of rules) {
      const list = bySource.get(rule.source) || []
      list.push(rule)
      bySource.set(rule.source, list)
    }

    for (const [source, sourceRules] of bySource) {
      const sourceLabel = document.createElement('div')
      sourceLabel.className = 'stylesheet-source-label'
      sourceLabel.textContent = source
      group.appendChild(sourceLabel)

      for (const rule of sourceRules) {
        group.appendChild(this.createRuleBlock(rule))
      }
    }

    this.stylesheetSection.appendChild(group)
  }

  private createRuleBlock(rule: MatchedCSSRule): HTMLElement {
    const block = document.createElement('div')
    block.className = 'stylesheet-rule-block'

    const selectorRow = document.createElement('div')
    selectorRow.className = 'stylesheet-selector'
    const selectorText = document.createElement('span')
    selectorText.textContent = rule.selector
    const specBadge = document.createElement('span')
    specBadge.className = `stylesheet-spec-badge spec-${rule.specificity}`
    specBadge.textContent = rule.specificity
    selectorRow.appendChild(selectorText)
    selectorRow.appendChild(specBadge)
    block.appendChild(selectorRow)

    const textarea = document.createElement('textarea')
    textarea.className = 'stylesheet-rule-editor'
    textarea.spellcheck = false
    const formatted = rule.properties
      .split(';')
      .map(s => s.trim())
      .filter(s => s)
      .join(';\n')
    textarea.value = formatted ? formatted + ';' : ''
    textarea.rows = Math.max(2, formatted.split('\n').length + 1)
    textarea.placeholder = 'e.g. color: red;\nfont-size: 16px;'

    const originalRule = { ...rule }
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let lastCommittedValue = textarea.value
    let dirty = false

    const commitChange = (): void => {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
      if (!dirty || !this.onStylesheetRuleChange) return
      dirty = false
      lastCommittedValue = textarea.value
      const newProps = textarea.value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s)
        .join(' ')
      this.onStylesheetRuleChange(originalRule, newProps)
    }

    this.pendingStylesheetCommits.push(commitChange)

    textarea.addEventListener('input', () => {
      dirty = textarea.value !== lastCommittedValue
      if (debounceTimer) clearTimeout(debounceTimer)
      if (dirty) debounceTimer = setTimeout(commitChange, 600)
    })
    textarea.addEventListener('blur', commitChange)

    block.appendChild(textarea)
    return block
  }

  private appendRuleBlock(rule: MatchedCSSRule): void {
    const block = this.createRuleBlock(rule)
    this.stylesheetSection.appendChild(block)
    // Focus the textarea so the user can start typing immediately
    const textarea = block.querySelector('textarea')
    if (textarea) textarea.focus()
  }

  private renderAttributes(tagName: string, attributes: Record<string, string>): void {
    this.attrSection.innerHTML = ''

    const commonAttrs = HTML_ATTRIBUTES_BY_TAG['*'] || []
    const tagAttrs = HTML_ATTRIBUTES_BY_TAG[tagName] || []
    const allAttrs = [...new Set([...commonAttrs, ...tagAttrs])]

    for (const key of Object.keys(attributes)) {
      if (!allAttrs.includes(key)) allAttrs.push(key)
    }

    // Image alt text warning and decorative checkbox
    if (tagName === 'img') {
      const altValue = attributes['alt']
      const isDecorative = altValue === '' && attributes['role'] === 'presentation'
      const hasAlt = altValue !== undefined && altValue !== null

      if (!hasAlt) {
        const warning = document.createElement('div')
        warning.className = 'alt-warning'
        warning.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Missing alt text — add alt text or mark as decorative'
        this.attrSection.appendChild(warning)
      }

      const decorativeRow = document.createElement('div')
      decorativeRow.className = 'prop-row decorative-row'
      const checkId = `prop-decorative-${++propInputIdCounter}`
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = checkId
      checkbox.checked = isDecorative
      const checkLabel = document.createElement('label')
      checkLabel.htmlFor = checkId
      checkLabel.textContent = 'Mark as decorative'
      checkLabel.title = 'Sets alt="" and role="presentation" — use for images that are purely visual and convey no information'
      decorativeRow.appendChild(checkbox)
      decorativeRow.appendChild(checkLabel)

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (this.onAttrChange) {
            this.onAttrChange('alt', '')
            this.onAttrChange('role', 'presentation')
          }
          // Update local state and re-render
          if (this.currentSelection) {
            this.currentSelection.attributes['alt'] = ''
            this.currentSelection.attributes['role'] = 'presentation'
            this.renderAttributes(tagName, this.currentSelection.attributes)
          }
        } else {
          if (this.onAttrChange) {
            this.onAttrChange('role', '')
          }
          if (this.currentSelection) {
            delete this.currentSelection.attributes['role']
            this.renderAttributes(tagName, this.currentSelection.attributes)
          }
        }
      })

      this.attrSection.appendChild(decorativeRow)

      // Prominent alt text field
      const altField = document.createElement('div')
      altField.className = 'alt-field'
      const altLabelId = `prop-alt-prominent-${++propInputIdCounter}`
      const altLabel = document.createElement('label')
      altLabel.htmlFor = altLabelId
      altLabel.textContent = 'Alt Text'
      altField.appendChild(altLabel)
      const altTextarea = document.createElement('textarea')
      altTextarea.id = altLabelId
      altTextarea.className = 'alt-textarea'
      altTextarea.value = attributes['alt'] || ''
      altTextarea.placeholder = 'Describe this image for screen readers…'
      altTextarea.disabled = isDecorative
      altTextarea.addEventListener('change', () => {
        if (this.onAttrChange) this.onAttrChange('alt', altTextarea.value)
        if (this.currentSelection) {
          this.currentSelection.attributes['alt'] = altTextarea.value
          this.renderAttributes(tagName, this.currentSelection.attributes)
        }
      })
      altField.appendChild(altTextarea)
      this.attrSection.appendChild(altField)
    }

    const group = document.createElement('div')
    group.className = 'prop-group'

    const title = document.createElement('div')
    title.className = 'prop-group-title'
    title.textContent = `${tagName} attributes`
    group.appendChild(title)

    for (const attr of allAttrs) {
      // Skip alt for images — handled by prominent field above
      if (tagName === 'img' && attr === 'alt') continue

      const row = document.createElement('div')
      row.className = 'prop-row'

      const inputId = `prop-attr-${++propInputIdCounter}`
      const label = document.createElement('label')
      label.textContent = attr
      label.title = attr
      label.htmlFor = inputId
      row.appendChild(label)

      const input = document.createElement('input')
      input.type = 'text'
      input.id = inputId
      input.value = attributes[attr] || ''
      input.placeholder = `(${attr})`
      input.addEventListener('change', () => {
        if (this.onAttrChange) this.onAttrChange(attr, input.value)
      })
      row.appendChild(input)

      group.appendChild(row)
    }

    // Add custom attribute row
    const addRow = document.createElement('div')
    addRow.className = 'prop-row'
    addRow.style.marginTop = '8px'
    const addBtn = document.createElement('button')
    addBtn.textContent = '+ Add attribute'
    addBtn.style.cssText = 'width:100%;padding:4px;border:1px dashed var(--input-border);background:transparent;color:var(--text-secondary);cursor:pointer;border-radius:3px;font-size:0.6875rem;'
    addBtn.addEventListener('click', () => {
      const name = prompt('Attribute name:')
      if (name) {
        const value = prompt('Attribute value:') || ''
        if (this.onAttrChange) this.onAttrChange(name, value)
        if (this.currentSelection) {
          this.currentSelection.attributes[name] = value
          this.renderAttributes(tagName, this.currentSelection.attributes)
        }
      }
    })
    addRow.appendChild(addBtn)
    group.appendChild(addRow)

    this.attrSection.appendChild(group)
  }
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
