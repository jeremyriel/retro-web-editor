import { CodeEditor } from './editor/code-editor'
import { EditorTabs } from './editor/editor-tabs'
import { PreviewFrame } from './preview/preview-frame'
import { GridOverlay } from './preview/grid-overlay'
import { DragDropManager } from './preview/drag-drop'
import { Toolbar } from './toolbar/toolbar'
import { PropertyPanel } from './properties/property-panel'
import { SplitView } from './layout/split-view'
import { SyncEngine } from './sync/sync-engine'
import { findNodeBySelector } from './sync/html-parser'
import { FileTab, FileType, PreviewSelectMessage } from '../shared/types'
import { AUTOSAVE_INTERVAL_MS } from '../shared/constants'
import axe from 'axe-core'

declare global {
  interface Window {
    api: {
      openFile: () => Promise<{ filePath: string; content: string; fileType: FileType } | null>
      readFile: (path: string) => Promise<{ filePath: string; content: string; fileType: FileType }>
      saveFile: (path: string, content: string) => Promise<boolean>
      saveFileAs: (content: string, fileType: string) => Promise<{ filePath: string; success: boolean } | null>
      getRecentFiles: () => Promise<string[]>
      removeRecentFile: (path: string) => Promise<string[]>
      clearRecentFiles: () => Promise<string[]>
      extractLinkedFiles: (html: string, path: string) => Promise<{ type: FileType; href: string; fullPath: string }[]>
      autosave: (path: string, content: string) => Promise<void>
      getTheme: () => Promise<string>
      setTheme: (theme: string) => Promise<void>
      setWindowTitle: (title: string) => Promise<void>
      confirmSave: (fileName: string) => Promise<'save' | 'discard' | 'cancel'>
      readLicenseFile: () => Promise<string>
      fetchGoogleFonts: () => Promise<{ family: string; category: string }[]>
      saveReport: (content: string, defaultName: string) => Promise<boolean>
      checkAutosave: (filePath: string) => Promise<{ autosavePath: string; content: string } | null>
      discardAutosave: (filePath: string) => Promise<void>
      onMenuAction: (callback: (action: string) => void) => () => void
    }
  }
}

// Aria-live announcer
const announcer = document.getElementById('a11y-announcer')!
function announce(message: string): void {
  announcer.textContent = ''
  requestAnimationFrame(() => { announcer.textContent = message })
}

// Components
const codeEditor = new CodeEditor(document.getElementById('code-editor')!)
const tabs = new EditorTabs(document.getElementById('tab-bar')!)
const previewFrame = new PreviewFrame(document.getElementById('preview-frame') as HTMLIFrameElement)
const gridOverlay = new GridOverlay(document.getElementById('grid-overlay')!)
const dragDrop = new DragDropManager(previewFrame)
const toolbar = new Toolbar(document.getElementById('toolbar-buttons')!)
const propertyPanel = new PropertyPanel()
const splitView = new SplitView()
const syncEngine = new SyncEngine()

// Modal focus management
function openModal(overlay: HTMLElement): void {
  savedFocus = document.activeElement as HTMLElement | null
  overlay.classList.remove('hidden')
  document.getElementById('app')!.setAttribute('aria-hidden', 'true')
  const firstFocusable = overlay.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  firstFocusable?.focus()
}

function closeModal(overlay: HTMLElement): void {
  overlay.classList.add('hidden')
  document.getElementById('app')!.removeAttribute('aria-hidden')
  savedFocus?.focus()
  savedFocus = null
}

function trapFocus(e: KeyboardEvent, overlay: HTMLElement): void {
  if (e.key === 'Escape') {
    closeModal(overlay)
    return
  }
  if (e.key !== 'Tab') return
  const focusable = overlay.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

let savedFocus: HTMLElement | null = null

// About modal
const aboutOverlay = document.getElementById('about-overlay')!
document.getElementById('about-close')!.addEventListener('click', () => closeModal(aboutOverlay))
aboutOverlay.addEventListener('click', (e) => {
  if (e.target === aboutOverlay) closeModal(aboutOverlay)
})
aboutOverlay.addEventListener('keydown', (e) => trapFocus(e, aboutOverlay))

// License modal
const licenseOverlay = document.getElementById('license-overlay')!
document.getElementById('license-close')!.addEventListener('click', () => closeModal(licenseOverlay))
licenseOverlay.addEventListener('click', (e) => {
  if (e.target === licenseOverlay) closeModal(licenseOverlay)
})
licenseOverlay.addEventListener('keydown', (e) => trapFocus(e, licenseOverlay))

document.getElementById('license-link')!.addEventListener('click', async (e) => {
  e.preventDefault()
  openModal(licenseOverlay)
  const licenseText = document.getElementById('license-text')!
  try {
    const text = await window.api.readLicenseFile()
    licenseText.textContent = text
  } catch {
    licenseText.textContent = 'Unable to load license file.'
  }
})

// Link editor modal
const linkOverlay = document.getElementById('link-overlay')!
const linkTypeSelect = document.getElementById('link-type') as HTMLSelectElement
const linkHrefInput = document.getElementById('link-href') as HTMLInputElement
const linkTextInput = document.getElementById('link-text') as HTMLInputElement
const linkTitleInput = document.getElementById('link-title-input') as HTMLInputElement
const linkTargetSelect = document.getElementById('link-target') as HTMLSelectElement
const linkRelField = document.getElementById('link-rel-field')!
const linkRelNoopener = document.getElementById('link-rel-noopener') as HTMLInputElement
const linkRelNoreferrer = document.getElementById('link-rel-noreferrer') as HTMLInputElement
const linkRelNofollow = document.getElementById('link-rel-nofollow') as HTMLInputElement
const linkRemoveBtn = document.getElementById('link-remove') as HTMLButtonElement
const linkApplyBtn = document.getElementById('link-apply') as HTMLButtonElement

let linkEditContext: { selectedText: string; selectorPath: string | null; isExisting: boolean } | null = null

document.getElementById('link-close')!.addEventListener('click', () => closeModal(linkOverlay))
document.getElementById('link-cancel')!.addEventListener('click', () => closeModal(linkOverlay))
linkOverlay.addEventListener('click', (e) => {
  if (e.target === linkOverlay) closeModal(linkOverlay)
})
linkOverlay.addEventListener('keydown', (e) => trapFocus(e, linkOverlay))

linkTargetSelect.addEventListener('change', () => {
  linkRelField.style.display = linkTargetSelect.value === '_blank' ? '' : 'none'
})

linkTypeSelect.addEventListener('change', () => {
  const type = linkTypeSelect.value
  if (type === 'mailto') {
    linkHrefInput.placeholder = 'user@example.com'
    linkTargetSelect.value = ''
    linkTargetSelect.closest('.link-field')!.style.display = 'none'
    linkRelField.style.display = 'none'
  } else if (type === 'tel') {
    linkHrefInput.placeholder = '+1-555-123-4567'
    linkTargetSelect.value = ''
    linkTargetSelect.closest('.link-field')!.style.display = 'none'
    linkRelField.style.display = 'none'
  } else if (type === 'anchor') {
    linkHrefInput.placeholder = 'section-id'
    linkTargetSelect.value = ''
    linkTargetSelect.closest('.link-field')!.style.display = 'none'
    linkRelField.style.display = 'none'
  } else {
    linkHrefInput.placeholder = 'https://example.com'
    linkTargetSelect.closest('.link-field')!.style.display = ''
    linkRelField.style.display = linkTargetSelect.value === '_blank' ? '' : 'none'
  }
})

function openLinkEditor(selectedText: string, existingHref: string | null, existingTarget: string | null, existingTitle: string | null, selectorPath: string | null): void {
  const isExisting = existingHref !== null
  linkEditContext = { selectedText, selectorPath, isExisting }

  // Detect link type from existing href
  let type = 'url'
  let href = existingHref || ''
  if (href.startsWith('mailto:')) {
    type = 'mailto'
    href = href.replace('mailto:', '')
  } else if (href.startsWith('tel:')) {
    type = 'tel'
    href = href.replace('tel:', '')
  } else if (href.startsWith('#')) {
    type = 'anchor'
    href = href.replace('#', '')
  }

  linkTypeSelect.value = type
  linkTypeSelect.dispatchEvent(new Event('change'))
  linkHrefInput.value = href
  linkTextInput.value = selectedText
  linkTitleInput.value = existingTitle || ''
  linkTargetSelect.value = existingTarget || ''
  linkTargetSelect.dispatchEvent(new Event('change'))
  linkRelNoopener.checked = true
  linkRelNoreferrer.checked = false
  linkRelNofollow.checked = false
  linkRemoveBtn.style.display = isExisting ? '' : 'none'

  openModal(linkOverlay)
  linkHrefInput.focus()
}

linkApplyBtn.addEventListener('click', () => {
  if (!linkEditContext) return

  const type = linkTypeSelect.value
  let href = linkHrefInput.value.trim()
  const text = linkTextInput.value || linkEditContext.selectedText
  const title = linkTitleInput.value.trim()
  const target = linkTargetSelect.value

  // Build full href
  if (type === 'mailto') href = 'mailto:' + href
  else if (type === 'tel') href = 'tel:' + href
  else if (type === 'anchor') href = '#' + href

  // Build attributes
  let attrs = `href="${href}"`
  if (target) attrs += ` target="${target}"`
  if (target === '_blank') {
    const relParts: string[] = []
    if (linkRelNoopener.checked) relParts.push('noopener')
    if (linkRelNoreferrer.checked) relParts.push('noreferrer')
    if (linkRelNofollow.checked) relParts.push('nofollow')
    if (relParts.length) attrs += ` rel="${relParts.join(' ')}"`
  }
  if (title) attrs += ` title="${title}"`

  const linkHTML = `<a ${attrs}>${text}</a>`

  if (linkEditContext.isExisting && linkEditContext.selectorPath) {
    syncEngine.visualEdit(linkEditContext.selectorPath, linkHTML)
  } else {
    // Insert as new link at code editor cursor / selection
    const view = codeEditor.getView()
    if (view) {
      view.dispatch({
        changes: {
          from: view.state.selection.main.from,
          to: view.state.selection.main.to,
          insert: linkHTML,
        },
      })
    }
  }

  closeModal(linkOverlay)
  linkEditContext = null
})

linkRemoveBtn.addEventListener('click', () => {
  if (!linkEditContext || !linkEditContext.selectorPath) return
  // Replace the <a> tag with just its text content
  const text = linkTextInput.value || linkEditContext.selectedText
  syncEngine.visualEdit(linkEditContext.selectorPath, text)
  closeModal(linkOverlay)
  linkEditContext = null
})

// Recent files modal
const recentOverlay = document.getElementById('recent-overlay')!
const recentList = document.getElementById('recent-list')!
document.getElementById('recent-close')!.addEventListener('click', () => closeModal(recentOverlay))
recentOverlay.addEventListener('click', (e) => {
  if (e.target === recentOverlay) closeModal(recentOverlay)
})
recentOverlay.addEventListener('keydown', (e) => trapFocus(e, recentOverlay))
document.getElementById('recent-clear')!.addEventListener('click', async () => {
  await window.api.clearRecentFiles()
  renderRecentFiles([])
})

async function showRecentFiles(): Promise<void> {
  const files = await window.api.getRecentFiles()
  renderRecentFiles(files)
  openModal(recentOverlay)
}

function renderRecentFiles(files: string[]): void {
  recentList.innerHTML = ''
  for (const filePath of files) {
    const fileName = filePath.split(/[\\/]/).pop() || filePath
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const typeLabel = ext === 'htm' || ext === 'html' ? 'HTML' : ext === 'css' ? 'CSS' : ext === 'js' ? 'JS' : ext.toUpperCase()

    const item = document.createElement('div')
    item.className = 'recent-item'
    item.innerHTML = `
      <span class="recent-item-type">${typeLabel}</span>
      <div class="recent-item-info">
        <div class="recent-item-name">${fileName}</div>
        <div class="recent-item-path">${filePath}</div>
      </div>
      <button class="recent-item-remove" title="Remove from list" aria-label="Remove ${fileName} from recent files">&times;</button>
    `

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('recent-item-remove')) return
      closeModal(recentOverlay)
      openFileFromPath(filePath)
    })

    item.querySelector('.recent-item-remove')!.addEventListener('click', async (e) => {
      e.stopPropagation()
      const updated = await window.api.removeRecentFile(filePath)
      renderRecentFiles(updated)
    })

    recentList.appendChild(item)
  }
}

// Google Fonts modal
const gfontsOverlay = document.getElementById('gfonts-overlay')!
const gfontsSearch = document.getElementById('gfonts-search') as HTMLInputElement
const gfontsList = document.getElementById('gfonts-list')!
const gfontsDocList = document.getElementById('gfonts-doc-list')!
const gfontsDocSection = document.getElementById('gfonts-doc-section')!
const gfontsLoading = document.getElementById('gfonts-loading')!
const gfontsEmpty = document.getElementById('gfonts-empty')!
const gfontsLoadMore = document.getElementById('gfonts-load-more')!
const gfontsCatButtons = document.querySelectorAll('.gfonts-cat')

document.getElementById('gfonts-close')!.addEventListener('click', () => closeModal(gfontsOverlay))
gfontsOverlay.addEventListener('click', (e) => {
  if (e.target === gfontsOverlay) closeModal(gfontsOverlay)
})
gfontsOverlay.addEventListener('keydown', (e) => trapFocus(e, gfontsOverlay))

let allGoogleFonts: { family: string; category: string }[] = []
let gfontsFiltered: { family: string; category: string }[] = []
let gfontsDisplayCount = 0
let gfontsCategory = 'all'
let gfontsPreviewLink: HTMLLinkElement | null = null
const GFONTS_BATCH = 30

function getDocumentGoogleFonts(): string[] {
  const content = codeEditor.getContent()
  const fonts: string[] = []
  const regex = /href=["']https?:\/\/fonts\.googleapis\.com\/css2?\?([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const params = match[1]
    const familyMatches = params.matchAll(/family=([^&:+"']+)/g)
    for (const fm of familyMatches) {
      fonts.push(decodeURIComponent(fm[1].replace(/\+/g, ' ')))
    }
  }
  return [...new Set(fonts)]
}

function loadGfontsPreview(fonts: string[]): void {
  if (fonts.length === 0) return
  if (gfontsPreviewLink) gfontsPreviewLink.remove()
  const families = fonts.map(f => 'family=' + encodeURIComponent(f).replace(/%20/g, '+')).join('&')
  gfontsPreviewLink = document.createElement('link')
  gfontsPreviewLink.rel = 'stylesheet'
  gfontsPreviewLink.href = `https://fonts.googleapis.com/css2?${families}&display=swap&text=${encodeURIComponent('AaBbCcDdEeFf 0123456789')}`
  document.head.appendChild(gfontsPreviewLink)
}

function renderGfontsList(): void {
  gfontsList.innerHTML = ''
  const docFonts = new Set(getDocumentGoogleFonts())
  const slice = gfontsFiltered.slice(0, gfontsDisplayCount)

  loadGfontsPreview(slice.map(f => f.family))

  for (const font of slice) {
    const isAdded = docFonts.has(font.family)
    const item = document.createElement('div')
    item.className = 'gfonts-item'
    item.innerHTML = `
      <div class="gfonts-item-info">
        <div class="gfonts-item-name" style="font-family: '${font.family.replace(/'/g, "\\'")}', ${font.category}">${font.family}</div>
        <div class="gfonts-item-category">${font.category}</div>
      </div>
      <button class="gfonts-item-btn${isAdded ? ' added' : ''}">${isAdded ? 'Added' : 'Add & Use'}</button>
    `
    const btn = item.querySelector('.gfonts-item-btn')!
    if (!isAdded) {
      btn.addEventListener('click', () => {
        addGoogleFontToDocument(font.family)
        btn.textContent = 'Added'
        btn.classList.add('added')
      })
    }
    // Click font name to use it (if already added)
    item.querySelector('.gfonts-item-name')!.addEventListener('click', () => {
      if (docFonts.has(font.family) || btn.classList.contains('added')) {
        if (selectedSelectorPath) {
          propertyPanel.setFontFamily(`'${font.family}', ${font.category}`)
          syncEngine.propertyChanged(selectedSelectorPath, 'font-family', `'${font.family}', ${font.category}`)
        }
        closeModal(gfontsOverlay)
        announce(`Applied font ${font.family}`)
      }
    })
    gfontsList.appendChild(item)
  }

  gfontsEmpty.classList.toggle('hidden', gfontsFiltered.length > 0 || allGoogleFonts.length === 0)
  gfontsLoadMore.classList.toggle('hidden', gfontsDisplayCount >= gfontsFiltered.length)
}

function renderDocFonts(): void {
  const docFonts = getDocumentGoogleFonts()
  if (docFonts.length === 0) {
    gfontsDocSection.classList.add('hidden')
    return
  }
  gfontsDocSection.classList.remove('hidden')
  gfontsDocList.innerHTML = ''
  for (const family of docFonts) {
    const item = document.createElement('div')
    item.className = 'gfonts-item'
    item.style.cursor = 'pointer'
    item.innerHTML = `
      <div class="gfonts-item-info">
        <div class="gfonts-item-name" style="font-family: '${family.replace(/'/g, "\\'")}', sans-serif">${family}</div>
      </div>
      <button class="gfonts-item-btn">Use</button>
    `
    item.addEventListener('click', () => {
      if (selectedSelectorPath) {
        const cat = allGoogleFonts.find(f => f.family === family)?.category || 'sans-serif'
        propertyPanel.setFontFamily(`'${family}', ${cat}`)
        syncEngine.propertyChanged(selectedSelectorPath, 'font-family', `'${family}', ${cat}`)
      }
      closeModal(gfontsOverlay)
      announce(`Applied font ${family}`)
    })
    gfontsDocList.appendChild(item)
  }
  // Load preview CSS for document fonts
  loadGfontsPreview(docFonts)
}

function filterGfonts(): void {
  const query = gfontsSearch.value.toLowerCase().trim()
  gfontsFiltered = allGoogleFonts.filter(f => {
    if (gfontsCategory !== 'all' && f.category !== gfontsCategory) return false
    if (query && !f.family.toLowerCase().includes(query)) return false
    return true
  })
  gfontsDisplayCount = GFONTS_BATCH
  renderGfontsList()
}

gfontsSearch.addEventListener('input', filterGfonts)

gfontsCatButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    gfontsCatButtons.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    gfontsCategory = (btn as HTMLElement).dataset.cat || 'all'
    filterGfonts()
  })
})

gfontsLoadMore.addEventListener('click', () => {
  gfontsDisplayCount += GFONTS_BATCH
  renderGfontsList()
})

function addGoogleFontToDocument(family: string): void {
  const linkTag = `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap" rel="stylesheet">`
  const content = codeEditor.getContent()

  // Check if already present
  if (content.includes(family.replace(/ /g, '+')) && content.includes('fonts.googleapis.com')) {
    // Already linked — just set font-family
    if (selectedSelectorPath) {
      const cat = allGoogleFonts.find(f => f.family === family)?.category || 'sans-serif'
      syncEngine.propertyChanged(selectedSelectorPath, 'font-family', `'${family}', ${cat}`)
    }
    return
  }

  // Find </head> and insert before it
  const headCloseIdx = content.indexOf('</head>')
  if (headCloseIdx === -1) return

  const indent = '  '
  const insertion = `${indent}${linkTag}\n`
  const view = codeEditor.getView()
  if (view) {
    view.dispatch({
      changes: { from: headCloseIdx, to: headCloseIdx, insert: insertion },
    })
  }

  // Set font-family on selected element
  if (selectedSelectorPath) {
    const cat = allGoogleFonts.find(f => f.family === family)?.category || 'sans-serif'
    syncEngine.propertyChanged(selectedSelectorPath, 'font-family', `'${family}', ${cat}`)
  }

  announce(`Added ${family} to document`)
}

async function openGoogleFontsModal(): Promise<void> {
  openModal(gfontsOverlay)
  gfontsSearch.value = ''
  gfontsCategory = 'all'
  gfontsCatButtons.forEach(b => {
    b.classList.toggle('active', (b as HTMLElement).dataset.cat === 'all')
  })

  renderDocFonts()

  if (allGoogleFonts.length === 0) {
    gfontsLoading.classList.remove('hidden')
    gfontsList.innerHTML = ''
    try {
      allGoogleFonts = await window.api.fetchGoogleFonts()
      gfontsLoading.classList.add('hidden')
      filterGfonts()
    } catch {
      gfontsLoading.textContent = 'Failed to load fonts. Check your internet connection.'
    }
  } else {
    gfontsLoading.classList.add('hidden')
    filterGfonts()
  }
  gfontsSearch.focus()
}

// WCAG Validator modal
const wcagOverlay = document.getElementById('wcag-overlay')!
const wcagSummary = document.getElementById('wcag-summary')!
const wcagResults = document.getElementById('wcag-results')!
const wcagLoading = document.getElementById('wcag-loading')!
const wcagDownloadBtn = document.getElementById('wcag-download') as HTMLButtonElement
const wcagRerunBtn = document.getElementById('wcag-rerun') as HTMLButtonElement

document.getElementById('wcag-close')!.addEventListener('click', () => closeModal(wcagOverlay))
wcagOverlay.addEventListener('click', (e) => {
  if (e.target === wcagOverlay) closeModal(wcagOverlay)
})
wcagOverlay.addEventListener('keydown', (e) => trapFocus(e, wcagOverlay))

let lastWcagReport = ''

wcagRerunBtn.addEventListener('click', () => runWcagValidation())

wcagDownloadBtn.addEventListener('click', async () => {
  if (!lastWcagReport) return
  try {
    const tab = tabs.getActiveTab()
    const baseName = tab?.fileName?.replace(/\.[^.]+$/, '') || 'document'
    const defaultName = `${baseName}-wcag-report.txt`
    await window.api.saveReport(lastWcagReport, defaultName, tab?.filePath || undefined)
  } catch (err) {
    console.error('Failed to save WCAG report:', err)
  }
})

interface AxeResult {
  violations: AxeRuleResult[]
  passes: AxeRuleResult[]
  incomplete: AxeRuleResult[]
  inapplicable: AxeRuleResult[]
}

interface AxeRuleResult {
  id: string
  impact?: string
  description: string
  help: string
  helpUrl: string
  tags: string[]
  nodes: { target: string[]; html: string; failureSummary?: string }[]
}

async function runWcagValidation(): Promise<void> {
  wcagSummary.innerHTML = ''
  wcagResults.innerHTML = ''
  wcagLoading.classList.remove('hidden')
  wcagDownloadBtn.disabled = true
  lastWcagReport = ''

  const html = codeEditor.getContent()
  if (!html.trim()) {
    wcagLoading.textContent = 'No HTML content to validate.'
    return
  }

  // Create a temporary hidden iframe with the raw user HTML
  const tempFrame = document.createElement('iframe')
  tempFrame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1024px;height:768px;border:none;'
  tempFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  document.body.appendChild(tempFrame)

  try {
    // Write HTML and wait for load
    tempFrame.srcdoc = html
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), 10000)
      tempFrame.addEventListener('load', () => { clearTimeout(timer); resolve() })
    })

    // Inject axe-core source into the iframe
    const axeScript = tempFrame.contentDocument!.createElement('script')
    axeScript.textContent = axe.source
    tempFrame.contentDocument!.head.appendChild(axeScript)

    // Run axe in the iframe context
    const results: AxeResult = await tempFrame.contentWindow!.axe.run({
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })

    wcagLoading.classList.add('hidden')
    renderWcagResults(results)
    lastWcagReport = buildWcagTextReport(results)
    wcagDownloadBtn.disabled = false
  } catch (err) {
    wcagLoading.textContent = `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    document.body.removeChild(tempFrame)
  }
}

function renderWcagResults(results: AxeResult): void {
  // Summary
  wcagSummary.innerHTML = `
    <div class="wcag-stat violations"><span class="wcag-stat-count">${results.violations.length}</span> Violation${results.violations.length !== 1 ? 's' : ''}</div>
    <div class="wcag-stat incomplete"><span class="wcag-stat-count">${results.incomplete.length}</span> Needs Review</div>
    <div class="wcag-stat passes"><span class="wcag-stat-count">${results.passes.length}</span> Passed</div>
    <div class="wcag-stat inapplicable"><span class="wcag-stat-count">${results.inapplicable.length}</span> Not Applicable</div>
  `

  wcagResults.innerHTML = ''

  if (results.violations.length === 0 && results.incomplete.length === 0) {
    wcagResults.innerHTML = '<div class="wcag-no-issues">No accessibility violations found. Your document passes all applicable WCAG 2.1 AA checks.</div>'
  }

  // Violations
  if (results.violations.length > 0) {
    const title = document.createElement('div')
    title.className = 'wcag-section-title violations'
    title.textContent = `Violations (${results.violations.length})`
    wcagResults.appendChild(title)
    for (const rule of results.violations) {
      wcagResults.appendChild(renderWcagIssue(rule, 'violation'))
    }
  }

  // Incomplete
  if (results.incomplete.length > 0) {
    const title = document.createElement('div')
    title.className = 'wcag-section-title incomplete'
    title.textContent = `Needs Review (${results.incomplete.length})`
    wcagResults.appendChild(title)
    for (const rule of results.incomplete) {
      wcagResults.appendChild(renderWcagIssue(rule, 'incomplete'))
    }
  }

  // Passes (collapsed)
  if (results.passes.length > 0) {
    const title = document.createElement('div')
    title.className = 'wcag-section-title passes'
    title.textContent = `Passed (${results.passes.length})`
    title.style.cursor = 'pointer'
    wcagResults.appendChild(title)
    const passContainer = document.createElement('div')
    passContainer.style.display = 'none'
    for (const rule of results.passes) {
      passContainer.appendChild(renderWcagIssue(rule, 'pass'))
    }
    wcagResults.appendChild(passContainer)
    title.addEventListener('click', () => {
      const isHidden = passContainer.style.display === 'none'
      passContainer.style.display = isHidden ? 'flex' : 'none'
      passContainer.style.flexDirection = 'column'
      passContainer.style.gap = '8px'
      title.textContent = `Passed (${results.passes.length}) ${isHidden ? '▼' : '▶'}`
    })
  }
}

function renderWcagIssue(rule: AxeRuleResult, type: 'violation' | 'incomplete' | 'pass'): HTMLElement {
  const el = document.createElement('div')
  el.className = 'wcag-issue'

  const impactClass = type === 'pass' ? 'pass' : (rule.impact || 'minor')
  const impactLabel = type === 'pass' ? 'PASS' : (rule.impact || 'minor').toUpperCase()

  let html = `
    <div class="wcag-issue-header">
      <span class="wcag-impact ${impactClass}">${impactLabel}</span>
      <span class="wcag-issue-desc">${escapeHtml(rule.help)}</span>
    </div>
    <div class="wcag-issue-help">${escapeHtml(rule.description)} <a href="${rule.helpUrl}" target="_blank" rel="noopener">Learn more</a></div>
    <div class="wcag-issue-tags">${rule.tags.filter(t => t.startsWith('wcag')).map(t => `<span class="wcag-tag">${t}</span>`).join('')}</div>
  `

  if (type !== 'pass' && rule.nodes.length > 0) {
    html += '<div class="wcag-issue-nodes">'
    for (const node of rule.nodes.slice(0, 5)) {
      const target = node.target.join(' > ')
      html += `<div class="wcag-node"><span class="wcag-node-target">${escapeHtml(target)}</span></div>`
    }
    if (rule.nodes.length > 5) {
      html += `<div class="wcag-node" style="color:var(--text-secondary);font-style:italic;">...and ${rule.nodes.length - 5} more</div>`
    }
    html += '</div>'
  }

  el.innerHTML = html
  return el
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildWcagTextReport(results: AxeResult): string {
  const lines: string[] = []
  const tab = tabs.getActiveTab()
  const fileName = tab?.fileName || 'Untitled'
  const now = new Date().toLocaleString()

  lines.push('='.repeat(60))
  lines.push('WCAG 2.1 Level AA Accessibility Report')
  lines.push('='.repeat(60))
  lines.push(`File: ${fileName}`)
  lines.push(`Date: ${now}`)
  lines.push(`Engine: axe-core ${axe.version}`)
  lines.push(`Standard: WCAG 2.1 Level A + AA`)
  lines.push('')
  lines.push(`Violations: ${results.violations.length}`)
  lines.push(`Needs Review: ${results.incomplete.length}`)
  lines.push(`Passed: ${results.passes.length}`)
  lines.push(`Not Applicable: ${results.inapplicable.length}`)
  lines.push('')

  if (results.violations.length > 0) {
    lines.push('-'.repeat(60))
    lines.push('VIOLATIONS')
    lines.push('-'.repeat(60))
    for (const rule of results.violations) {
      lines.push('')
      lines.push(`[${(rule.impact || 'minor').toUpperCase()}] ${rule.help}`)
      lines.push(`  Rule: ${rule.id}`)
      lines.push(`  ${rule.description}`)
      lines.push(`  Tags: ${rule.tags.filter(t => t.startsWith('wcag')).join(', ')}`)
      lines.push(`  More info: ${rule.helpUrl}`)
      lines.push(`  Affected elements (${rule.nodes.length}):`)
      for (const node of rule.nodes) {
        lines.push(`    - ${node.target.join(' > ')}`)
        if (node.failureSummary) {
          for (const line of node.failureSummary.split('\n')) {
            lines.push(`      ${line}`)
          }
        }
      }
    }
  }

  if (results.incomplete.length > 0) {
    lines.push('')
    lines.push('-'.repeat(60))
    lines.push('NEEDS REVIEW')
    lines.push('-'.repeat(60))
    for (const rule of results.incomplete) {
      lines.push('')
      lines.push(`[${(rule.impact || 'minor').toUpperCase()}] ${rule.help}`)
      lines.push(`  Rule: ${rule.id}`)
      lines.push(`  ${rule.description}`)
      lines.push(`  Tags: ${rule.tags.filter(t => t.startsWith('wcag')).join(', ')}`)
      lines.push(`  More info: ${rule.helpUrl}`)
      lines.push(`  Elements to review (${rule.nodes.length}):`)
      for (const node of rule.nodes) {
        lines.push(`    - ${node.target.join(' > ')}`)
      }
    }
  }

  if (results.passes.length > 0) {
    lines.push('')
    lines.push('-'.repeat(60))
    lines.push('PASSED')
    lines.push('-'.repeat(60))
    for (const rule of results.passes) {
      lines.push(`  [PASS] ${rule.help} (${rule.id})`)
    }
  }

  lines.push('')
  lines.push('='.repeat(60))
  lines.push('End of report')
  lines.push('Generated by WIRED — Web Interface Retro Editor for Desktop')
  lines.push('='.repeat(60))

  return lines.join('\n')
}

async function openWcagValidator(): Promise<void> {
  openModal(wcagOverlay)
  await runWcagValidation()
}

// Keyboard shortcuts modal
const hotkeysOverlay = document.getElementById('hotkeys-overlay')!
document.getElementById('hotkeys-close')!.addEventListener('click', () => closeModal(hotkeysOverlay))
hotkeysOverlay.addEventListener('click', (e) => {
  if (e.target === hotkeysOverlay) closeModal(hotkeysOverlay)
})
hotkeysOverlay.addEventListener('keydown', (e) => trapFocus(e, hotkeysOverlay))

const HOTKEY_GROUPS: Record<string, [string, string][]> = {
  'hotkeys-file': [
    ['Open File', 'Ctrl+O'],
    ['Open Recent', 'Ctrl+Shift+O'],
    ['Save', 'Ctrl+S'],
    ['Save As', 'Ctrl+Shift+S'],
  ],
  'hotkeys-edit': [
    ['Undo', 'Ctrl+Z'],
    ['Redo', 'Ctrl+Shift+Z'],
    ['Cut', 'Ctrl+X'],
    ['Copy', 'Ctrl+C'],
    ['Paste', 'Ctrl+V'],
    ['Select All', 'Ctrl+A'],
    ['Insert/Edit Link', 'Ctrl+K'],
  ],
  'hotkeys-format': [
    ['Bold', 'Ctrl+B'],
    ['Italic', 'Ctrl+I'],
    ['Underline', 'Ctrl+U'],
  ],
  'hotkeys-view': [
    ['Toggle Code/Preview', 'Ctrl+\\'],
    ['Code Only', 'Ctrl+1'],
    ['Split View', 'Ctrl+2'],
    ['Preview Only', 'Ctrl+3'],
    ['Grid Overlay', 'Ctrl+G'],
    ['DOM Outlines', 'Ctrl+Shift+G'],
    ['Properties Panel', 'Ctrl+P'],
    ['Keyboard Shortcuts', 'Ctrl+/'],
    ['Toggle Fullscreen', 'F11'],
  ],
  'hotkeys-zoom': [
    ['Zoom In Code', 'Ctrl+='],
    ['Zoom Out Code', 'Ctrl+-'],
    ['Reset Code Zoom', 'Ctrl+0'],
    ['Zoom In Preview', 'Ctrl+Shift+='],
    ['Zoom Out Preview', 'Ctrl+Shift+-'],
    ['Reset Preview Zoom', 'Ctrl+Shift+0'],
  ],
  'hotkeys-help': [
    ['Help Hovers', 'F1'],
  ],
}

function populateHotkeys(): void {
  for (const [containerId, shortcuts] of Object.entries(HOTKEY_GROUPS)) {
    const container = document.getElementById(containerId)
    if (!container) continue
    container.innerHTML = ''
    for (const [label, keys] of shortcuts) {
      const row = document.createElement('div')
      row.className = 'hotkey-row'
      const labelSpan = document.createElement('span')
      labelSpan.className = 'hotkey-label'
      labelSpan.textContent = label
      row.appendChild(labelSpan)
      const keysSpan = document.createElement('span')
      keysSpan.className = 'hotkey-keys'
      for (const part of keys.split('+')) {
        const kbd = document.createElement('kbd')
        kbd.textContent = part
        keysSpan.appendChild(kbd)
      }
      row.appendChild(keysSpan)
      container.appendChild(row)
    }
  }
}

populateHotkeys()

function showHotkeys(): void {
  openModal(hotkeysOverlay)
}

// Autosave recovery modal
const recoverOverlay = document.getElementById('recover-overlay')!
const recoverFileName = document.getElementById('recover-file-name')!
const recoverRestoreBtn = document.getElementById('recover-restore')!
const recoverDiscardBtn = document.getElementById('recover-discard')!

function dismissRecovery(): void {
  closeModal(recoverOverlay)
  if (recoverResolve) recoverResolve('discard')
  recoverResolve = null
}

document.getElementById('recover-close')!.addEventListener('click', dismissRecovery)
recoverOverlay.addEventListener('click', (e) => {
  if (e.target === recoverOverlay) dismissRecovery()
})
recoverOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { dismissRecovery(); return }
  trapFocus(e, recoverOverlay)
})

let recoverResolve: ((action: 'restore' | 'discard') => void) | null = null

recoverRestoreBtn.addEventListener('click', () => {
  closeModal(recoverOverlay)
  if (recoverResolve) recoverResolve('restore')
  recoverResolve = null
})

recoverDiscardBtn.addEventListener('click', () => {
  closeModal(recoverOverlay)
  if (recoverResolve) recoverResolve('discard')
  recoverResolve = null
})

function promptAutosaveRecovery(fileName: string): Promise<'restore' | 'discard'> {
  recoverFileName.textContent = fileName
  openModal(recoverOverlay)
  return new Promise((resolve) => {
    recoverResolve = resolve
  })
}

async function checkAndRecoverAutosave(filePath: string, currentContent: string): Promise<string> {
  try {
    const recovery = await window.api.checkAutosave(filePath)
    if (!recovery) return currentContent

    const fileName = filePath.split(/[\\/]/).pop() || filePath
    const action = await promptAutosaveRecovery(fileName)

    if (action === 'restore') {
      announce(`Restored autosave for ${fileName}`)
      return recovery.content
    } else {
      await window.api.discardAutosave(filePath)
      announce(`Discarded autosave for ${fileName}`)
      return currentContent
    }
  } catch {
    // If autosave check fails for any reason, proceed with original content
    return currentContent
  }
}

// Window title updates
function updateWindowTitle(): void {
  const tab = tabs.getActiveTab()
  if (tab) {
    const dirty = tab.isDirty ? ' (unsaved)' : ''
    window.api.setWindowTitle(`${tab.fileName}${dirty} - WIRED`)
  } else {
    window.api.setWindowTitle('WIRED')
  }
}

async function openFileFromPath(filePath: string): Promise<void> {
  try {
    const result = await window.api.readFile(filePath)
    const fileName = result.filePath.split(/[\\/]/).pop() || 'untitled'

    // Check for autosave recovery
    const content = await checkAndRecoverAutosave(result.filePath, result.content)
    const wasRecovered = content !== result.content

    const tab = tabs.addTab(result.filePath, fileName, result.fileType, content)
    if (wasRecovered) tabs.markDirty(tab.id)
    codeEditor.setLanguage(result.fileType)
    codeEditor.setContent(content)

    if (result.fileType === 'html') {
      previewFrame.setBaseDir(result.filePath)
      syncEngine.setContent(content)
      previewFrame.updateContent(content)

      const linked = await window.api.extractLinkedFiles(content, result.filePath)
      for (const file of linked) {
        const linkedResult = await window.api.readFile(file.fullPath)
        const linkedName = file.fullPath.split(/[\\/]/).pop() || file.href
        tabs.addTab(file.fullPath, linkedName, file.type, linkedResult.content)
      }
      tabs.switchTo(tab.id)
    }

    // Create initial autosave
    await window.api.autosave(result.filePath, content)

    updateWindowTitle()
    announce(`Opened ${fileName}`)
  } catch {
    await window.api.removeRecentFile(filePath)
    announce('Failed to open file')
  }
}

// Zoom controls
const codeZoomLevel = document.getElementById('code-zoom-level')!
const previewZoomLevel = document.getElementById('preview-zoom-level')!

function updateCodeZoomLabel(): void {
  const pct = Math.round((codeEditor.getFontSize() / 14) * 100)
  codeZoomLevel.textContent = `${pct}%`
  announce(`Code editor zoom ${pct}%`)
}

function updatePreviewZoomLabel(): void {
  const pct = previewFrame.getZoomLevel()
  previewZoomLevel.textContent = `${pct}%`
  announce(`Preview zoom ${pct}%`)
}

document.getElementById('code-zoom-in')!.addEventListener('click', () => {
  codeEditor.zoomIn(); updateCodeZoomLabel()
})
document.getElementById('code-zoom-out')!.addEventListener('click', () => {
  codeEditor.zoomOut(); updateCodeZoomLabel()
})
document.getElementById('code-zoom-reset')!.addEventListener('click', () => {
  codeEditor.resetZoom(); updateCodeZoomLabel()
})
document.getElementById('preview-zoom-in')!.addEventListener('click', () => {
  previewFrame.zoomIn(); updatePreviewZoomLabel()
})
document.getElementById('preview-zoom-out')!.addEventListener('click', () => {
  previewFrame.zoomOut(); updatePreviewZoomLabel()
})
document.getElementById('preview-zoom-reset')!.addEventListener('click', () => {
  previewFrame.resetZoom(); updatePreviewZoomLabel()
})

// Help hovers
const helpTooltip = document.getElementById('help-tooltip')!
const helpNotification = document.getElementById('help-notification')!
let helpHoversActive = false
let helpHideTimer: ReturnType<typeof setTimeout> | null = null

const HELP_DESCRIPTIONS: Record<string, [string, string]> = {
  'toolbar-buttons': ['Formatting Toolbar', 'Contains buttons for text formatting, inserting elements, and alignment. These actions insert HTML tags at the cursor position in the code editor.'],
  'help-hover-btn': ['Help Hovers', 'Toggles descriptive tooltips on all interface elements. Click again to turn off.'],
  'tab-bar': ['File Tabs', 'Shows all open files. Click a tab to switch to it. The orange dot indicates unsaved changes. Click the X to close a tab.'],
  'editor-pane': ['Code Editor', 'Write and edit HTML, CSS, or JavaScript code here. Changes sync live to the preview. Supports syntax highlighting, auto-complete, and bracket matching.'],
  'code-editor': ['Code Editor', 'Write and edit HTML, CSS, or JavaScript code here. Changes sync live to the preview. Supports syntax highlighting, auto-complete, and bracket matching.'],
  'split-handle': ['Resize Handle', 'Drag left or right to resize the code editor and preview panes.'],
  'preview-pane': ['Live Preview', 'Shows a real-time rendering of your HTML. Click any element to select it and inspect its properties. Drag elements to reorder them in the DOM.'],
  'preview-frame': ['Live Preview', 'Shows a real-time rendering of your HTML. Click any element to select it and inspect its properties.'],
  'grid-overlay': ['Grid Overlay', 'A 20px reference grid overlaid on the preview to help with alignment. Toggle via View > Toggle Grid Overlay (Ctrl+G).'],
  'properties-panel': ['Properties Panel', 'Inspect and edit CSS properties and HTML attributes of the selected element. Changes are written back into the source code in real time.'],
  'properties-header': ['Properties Panel', 'Shows the tag name of the currently selected element.'],
  'css-properties': ['CSS Properties', 'Edit the inline CSS styles of the selected element. Grouped by Box Model, Typography, Layout, Colors, and Position.'],
  'attr-properties': ['HTML Attributes', 'Edit HTML attributes like id, class, href, src, etc. Context-sensitive — shows relevant attributes for the selected element type.'],
  'code-zoom': ['Code Zoom', 'Adjust the code editor font size. Use the buttons or keyboard shortcuts: Ctrl+= (zoom in), Ctrl+- (zoom out), Ctrl+0 (reset).'],
  'preview-zoom': ['Preview Zoom', 'Scale the preview up or down. Use the buttons or keyboard shortcuts: Ctrl+Shift+= (zoom in), Ctrl+Shift+- (zoom out), Ctrl+Shift+0 (reset).'],
  'app-branding': ['WIRED', 'Web Interface Retro Editor for Desktop — a lightweight WYSIWYG HTML editor. Go to Help > About for more info.'],
  'recent-overlay': ['Open Recent', 'Browse and open recently edited files. Click a file to open it, or click the X to remove it from the list.'],
  'gfonts-overlay': ['Google Fonts', 'Search and add Google Fonts to your document. Added fonts are inserted as a <link> tag in the <head> and applied to the selected element.'],
  'hotkeys-overlay': ['Keyboard Shortcuts', 'Reference of all keyboard shortcuts available in WIRED.'],
  'wcag-overlay': ['WCAG Validator', 'Validates your HTML against WCAG 2.1 Level AA accessibility standards using axe-core. Download the report as a text file.'],
}

function toggleHelpHovers(): void {
  helpHoversActive = !helpHoversActive
  const btn = document.getElementById('help-hover-btn')
  if (btn) btn.classList.toggle('active', helpHoversActive)
  document.body.classList.toggle('help-hovers-active', helpHoversActive)

  if (helpHoversActive) {
    for (const id of Object.keys(HELP_DESCRIPTIONS)) {
      const el = document.getElementById(id)
      if (el) el.setAttribute('data-help', id)
    }
    helpNotification.classList.remove('hidden', 'fade-out')
    setTimeout(() => {
      helpNotification.classList.add('fade-out')
      setTimeout(() => helpNotification.classList.add('hidden'), 300)
    }, 2500)
    announce('Help hovers enabled')
  } else {
    document.querySelectorAll('[data-help]').forEach(el => el.removeAttribute('data-help'))
    helpTooltip.classList.add('hidden')
    helpTooltip.classList.remove('visible')
    announce('Help hovers disabled')
  }
}

function handleHelpHover(e: MouseEvent): void {
  if (!helpHoversActive) return

  let target = e.target as HTMLElement | null
  let helpId: string | null = null
  while (target && target !== document.body) {
    if (target.getAttribute('data-help')) {
      helpId = target.getAttribute('data-help')
      break
    }
    target = target.parentElement
  }

  if (helpId && HELP_DESCRIPTIONS[helpId]) {
    const [title, desc] = HELP_DESCRIPTIONS[helpId]
    helpTooltip.innerHTML = `<div class="help-title">${title}</div><div class="help-desc">${desc}</div>`
    helpTooltip.classList.remove('hidden')

    const x = Math.min(e.clientX + 16, window.innerWidth - 300)
    const y = Math.min(e.clientY + 16, window.innerHeight - 100)
    helpTooltip.style.left = x + 'px'
    helpTooltip.style.top = y + 'px'

    if (helpHideTimer) { clearTimeout(helpHideTimer); helpHideTimer = null }
    requestAnimationFrame(() => helpTooltip.classList.add('visible'))
  } else {
    if (!helpHideTimer) {
      helpHideTimer = setTimeout(() => {
        helpTooltip.classList.remove('visible')
        helpHideTimer = null
      }, 150)
    }
  }
}

document.addEventListener('mousemove', handleHelpHover)

let currentTheme: 'light' | 'dark' = 'light'
let selectedSelectorPath: string | null = null
let autosaveTimer: ReturnType<typeof setInterval> | null = null

// ---- Initialize ----
async function init(): Promise<void> {
  const savedTheme = await window.api.getTheme()
  if (savedTheme === 'dark') {
    currentTheme = 'dark'
    document.body.classList.add('dark')
  }

  codeEditor.init('html', currentTheme)
  propertyPanel.clearSelection()

  syncEngine.setCallbacks({
    onPreviewUpdate: (content) => {
      previewFrame.updateContent(content)
    },
    onCodeUpdate: (content) => {
      codeEditor.setContent(content)
      const tab = tabs.getActiveTab()
      if (tab) tabs.updateContent(tab.id, content)
    },
  })

  codeEditor.onContentChange((content) => {
    const tab = tabs.getActiveTab()
    if (tab) {
      tabs.updateContent(tab.id, content)
      updateWindowTitle()
      if (tab.fileType === 'html') {
        syncEngine.codeChanged(content)
      } else if (tab.fileType === 'css') {
        previewFrame.updateCSS(content)
      }
    }
  })

  previewFrame.onPreviewMessage((msg) => {
    if (msg.type === 'element-selected') {
      selectedSelectorPath = msg.selectorPath
      propertyPanel.setSelection(msg as PreviewSelectMessage)
      const node = findNodeBySelector(syncEngine.getSourceNodes(), msg.selectorPath)
      if (node) {
        codeEditor.scrollToOffset(node.startOffset, node.openTagEnd)
      }
    } else if (msg.type === 'element-dragged') {
      syncEngine.moveElement(msg.sourcePath, msg.targetPath, msg.position)
    } else if (msg.type === 'link-edit-request') {
      openLinkEditor(msg.selectedText, msg.existingHref, msg.existingTarget, msg.existingTitle, msg.selectorPath)
    }
  })

  propertyPanel.onCSSPropertyChange((prop, value) => {
    if (selectedSelectorPath) {
      syncEngine.propertyChanged(selectedSelectorPath, prop, value)
    }
  })

  propertyPanel.onAttributeChange((attr, value) => {
    if (selectedSelectorPath) {
      syncEngine.attributeChanged(selectedSelectorPath, attr, value)
    }
  })

  propertyPanel.onGoogleFontsOpen(() => {
    openGoogleFontsModal()
  })

  tabs.onSwitch((tab) => {
    codeEditor.setLanguage(tab.fileType)
    codeEditor.setContent(tab.content)
    updateWindowTitle()
    if (tab.fileType === 'html') {
      previewFrame.setBaseDir(tab.filePath)
      syncEngine.setContent(tab.content)
      previewFrame.updateContent(tab.content)
    }
  })

  tabs.onClose(async (tab) => {
    if (tab.isDirty) {
      const result = await window.api.confirmSave(tab.fileName)
      if (result === 'save') {
        await saveTab(tab)
      } else if (result === 'cancel') {
        return
      }
    }
    tabs.closeTab(tab.id)
    if (!tabs.getActiveTab()) {
      codeEditor.setContent('')
      previewFrame.updateContent('')
      propertyPanel.clearSelection()
    }
    updateWindowTitle()
  })

  toolbar.onToolbarAction((action, value) => {
    handleToolbarAction(action, value)
  })

  window.api.onMenuAction((action) => {
    handleMenuAction(action)
  })

  autosaveTimer = setInterval(autosaveAll, AUTOSAVE_INTERVAL_MS)
}

// ---- File Operations ----
async function openFile(): Promise<void> {
  const result = await window.api.openFile()
  if (!result) return

  try {
    const fileName = result.filePath.split(/[\\/]/).pop() || 'untitled'

    // Check for autosave recovery
    const content = await checkAndRecoverAutosave(result.filePath, result.content)
    const wasRecovered = content !== result.content

    const tab = tabs.addTab(result.filePath, fileName, result.fileType, content)
    if (wasRecovered) tabs.markDirty(tab.id)
    codeEditor.setLanguage(result.fileType)
    codeEditor.setContent(content)

    if (result.fileType === 'html') {
      previewFrame.setBaseDir(result.filePath)
      syncEngine.setContent(content)
      previewFrame.updateContent(content)

      const linked = await window.api.extractLinkedFiles(content, result.filePath)
      for (const file of linked) {
        const linkedResult = await window.api.readFile(file.fullPath)
        const linkedName = file.fullPath.split(/[\\/]/).pop() || file.href
        tabs.addTab(file.fullPath, linkedName, file.type, linkedResult.content)
      }
      tabs.switchTo(tab.id)
    }

    // Create initial autosave
    await window.api.autosave(result.filePath, content)

    updateWindowTitle()
    announce(`Opened ${fileName}`)
  } catch {
    announce('Failed to open file')
  }
}

async function saveTab(tab: FileTab): Promise<void> {
  const content = codeEditor.getContent()
  if (tab.filePath) {
    await window.api.saveFile(tab.filePath, content)
    tabs.markClean(tab.id)
    announce(`Saved ${tab.fileName}`)
  } else {
    const result = await window.api.saveFileAs(content, tab.fileType)
    if (result) {
      const fileName = result.filePath.split(/[\\/]/).pop() || 'untitled'
      tabs.updateFilePath(tab.id, result.filePath, fileName)
      tabs.markClean(tab.id)
      announce(`Saved as ${fileName}`)
    }
  }
  updateWindowTitle()
}

async function saveCurrentTab(): Promise<void> {
  const tab = tabs.getActiveTab()
  if (tab) await saveTab(tab)
}

async function saveCurrentTabAs(): Promise<void> {
  const tab = tabs.getActiveTab()
  if (!tab) return
  const content = codeEditor.getContent()
  const result = await window.api.saveFileAs(content, tab.fileType)
  if (result) {
    const fileName = result.filePath.split(/[\\/]/).pop() || 'untitled'
    tabs.updateFilePath(tab.id, result.filePath, fileName)
    tabs.markClean(tab.id)
    announce(`Saved as ${fileName}`)
  }
  updateWindowTitle()
}

async function autosaveAll(): Promise<void> {
  for (const tab of tabs.getDirtyTabs()) {
    if (tab.filePath) {
      await window.api.autosave(tab.filePath, tab.content)
    }
  }
}

// ---- Toolbar Actions ----
function handleToolbarAction(action: string, value?: string): void {
  if (action === 'toggle-help-hovers') {
    toggleHelpHovers()
    return
  }
  if (action === 'show-hotkeys') {
    showHotkeys()
    return
  }
  if (action === 'wcag-validate') {
    openWcagValidator()
    return
  }

  const tab = tabs.getActiveTab()
  if (!tab) return

  const snippets: Record<string, string | ((v?: string) => string)> = {
    'bold': '<strong>text</strong>',
    'italic': '<em>text</em>',
    'underline': '<u>text</u>',
    'strikethrough': '<s>text</s>',
    'link': '<a href="#">link text</a>',
    'image': '<img src="" alt="description">',
    'table': '<table>\n  <tr>\n    <th>Header</th>\n    <th>Header</th>\n  </tr>\n  <tr>\n    <td>Cell</td>\n    <td>Cell</td>\n  </tr>\n</table>',
    'div': '<div>\n  \n</div>',
    'ul': '<ul>\n  <li>Item</li>\n  <li>Item</li>\n</ul>',
    'ol': '<ol>\n  <li>Item</li>\n  <li>Item</li>\n</ol>',
    'heading': (v?: string) => {
      if (!v || v === 'paragraph') return '<p>text</p>'
      return `<${v}>text</${v}>`
    },
  }

  if (action.startsWith('align-')) {
    const alignment = action.replace('align-', '')
    if (selectedSelectorPath) {
      syncEngine.propertyChanged(selectedSelectorPath, 'text-align', alignment)
    }
    return
  }

  const snippet = snippets[action]
  if (!snippet) return

  const text = typeof snippet === 'function' ? snippet(value) : snippet
  const view = codeEditor.getView()
  if (!view) return

  const cursor = view.state.selection.main.head
  const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)

  let insertText = text
  if (selection) {
    if (['bold', 'italic', 'underline', 'strikethrough'].includes(action)) {
      const tag = text.match(/<(\w+)>/)?.[1] || 'span'
      insertText = `<${tag}>${selection}</${tag}>`
    }
  }

  view.dispatch({
    changes: {
      from: view.state.selection.main.from,
      to: view.state.selection.main.to,
      insert: insertText,
    },
  })
}

// ---- Menu Actions ----
function handleMenuAction(action: string): void {
  switch (action) {
    case 'open': openFile(); break
    case 'open-recent': showRecentFiles(); break
    case 'save': saveCurrentTab(); break
    case 'save-as': saveCurrentTabAs(); break
    case 'toggle-view': splitView.toggleMode(); break
    case 'view-code': splitView.setMode('code-only'); break
    case 'view-split': splitView.setMode('split'); break
    case 'view-preview': splitView.setMode('preview-only'); break
    case 'toggle-grid':
      gridOverlay.toggle()
      announce(gridOverlay.isVisible() ? 'Grid overlay enabled' : 'Grid overlay disabled')
      break
    case 'toggle-outlines': {
      const active = !previewFrame['showOutlines']
      previewFrame.setOutlines(active)
      announce(active ? 'DOM outlines enabled' : 'DOM outlines disabled')
      break
    }
    case 'toggle-properties':
      propertyPanel.toggle()
      announce(propertyPanel.isVisible() ? 'Properties panel shown' : 'Properties panel hidden')
      break
    case 'toggle-help-hovers': toggleHelpHovers(); break
    case 'theme-light':
      currentTheme = 'light'
      document.body.classList.remove('dark')
      codeEditor.setTheme('light')
      window.api.setTheme('light')
      announce('Light theme applied')
      break
    case 'theme-dark':
      currentTheme = 'dark'
      document.body.classList.add('dark')
      codeEditor.setTheme('dark')
      window.api.setTheme('dark')
      announce('Dark theme applied')
      break
    case 'code-zoom-in': codeEditor.zoomIn(); updateCodeZoomLabel(); break
    case 'code-zoom-out': codeEditor.zoomOut(); updateCodeZoomLabel(); break
    case 'code-zoom-reset': codeEditor.resetZoom(); updateCodeZoomLabel(); break
    case 'preview-zoom-in': previewFrame.zoomIn(); updatePreviewZoomLabel(); break
    case 'preview-zoom-out': previewFrame.zoomOut(); updatePreviewZoomLabel(); break
    case 'preview-zoom-reset': previewFrame.resetZoom(); updatePreviewZoomLabel(); break
    case 'show-hotkeys': showHotkeys(); break
    case 'wcag-validate': openWcagValidator(); break
    case 'about':
      openModal(aboutOverlay)
      break
  }
}

// Start the app
init()

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
