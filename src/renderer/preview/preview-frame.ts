import { PreviewMessage } from '../../shared/types'

export class PreviewFrame {
  private iframe: HTMLIFrameElement
  private onMessage: ((msg: PreviewMessage) => void) | null = null
  private showOutlines = false
  private dragDropEnabled = false
  private baseDir: string | null = null
  private zoomLevel = 100

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
    window.addEventListener('message', (e) => {
      if (e.source === this.iframe.contentWindow && e.data?.type && this.onMessage) {
        this.onMessage(e.data as PreviewMessage)
      }
    })
  }

  setBaseDir(filePath: string | null): void {
    if (filePath) {
      // Extract directory from file path, convert to file:// URL
      const dir = filePath.replace(/[\\/][^\\/]*$/, '')
      // Normalize to forward slashes for file:// URL
      const normalized = dir.replace(/\\/g, '/')
      // Ensure trailing slash
      this.baseDir = `file:///${normalized.replace(/^\/+/, '')}/`
    } else {
      this.baseDir = null
    }
  }

  updateContent(html: string, cssOverrides?: string): void {
    const injectedScript = this.getInjectedScript()
    const injectedCSS = this.getInjectedCSS()

    // If CSS-only update — try hot-swap
    if (cssOverrides !== undefined && this.iframe.contentDocument) {
      const existingStyle = this.iframe.contentDocument.getElementById('rwe-css-override')
      if (existingStyle) {
        existingStyle.textContent = cssOverrides
        return
      }
    }

    // Inject <base> tag so relative paths (css, js, images) resolve correctly
    let contentWithBase = html
    if (this.baseDir) {
      const baseTag = `<base href="${this.baseDir}">`
      if (/<head[^>]*>/i.test(contentWithBase)) {
        // Insert right after <head>
        contentWithBase = contentWithBase.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`)
      } else if (/<html[^>]*>/i.test(contentWithBase)) {
        // No <head>, insert after <html>
        contentWithBase = contentWithBase.replace(/(<html[^>]*>)/i, `$1\n<head>${baseTag}</head>`)
      } else {
        // No <html> or <head>, prepend
        contentWithBase = `<head>${baseTag}</head>\n${contentWithBase}`
      }
    }

    // Full content update
    const doc = `${contentWithBase}
<style id="rwe-injected-styles">${injectedCSS}</style>
<script id="rwe-injected-script">${injectedScript}<\/script>`

    this.iframe.srcdoc = doc
  }

  updateCSS(cssContent: string): void {
    if (!this.iframe.contentDocument) return
    let styleEl = this.iframe.contentDocument.getElementById('rwe-css-override') as HTMLStyleElement
    if (!styleEl) {
      styleEl = this.iframe.contentDocument.createElement('style')
      styleEl.id = 'rwe-css-override'
      this.iframe.contentDocument.head.appendChild(styleEl)
    }
    styleEl.textContent = cssContent
  }

  setOutlines(enabled: boolean): void {
    this.showOutlines = enabled
    if (this.iframe.contentDocument) {
      const styleEl = this.iframe.contentDocument.getElementById('rwe-outline-styles')
      if (styleEl) {
        styleEl.textContent = enabled ? this.getOutlineCSS() : ''
      }
    }
  }

  setDragDrop(enabled: boolean): void {
    this.dragDropEnabled = enabled
    this.iframe.contentWindow?.postMessage({ type: 'rwe-set-dragdrop', enabled }, '*')
  }

  onPreviewMessage(callback: (msg: PreviewMessage) => void): void {
    this.onMessage = callback
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(200, this.zoomLevel + 10)
    this.applyZoom()
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(30, this.zoomLevel - 10)
    this.applyZoom()
  }

  resetZoom(): void {
    this.zoomLevel = 100
    this.applyZoom()
  }

  getZoomLevel(): number {
    return this.zoomLevel
  }

  private applyZoom(): void {
    this.iframe.style.transform = `scale(${this.zoomLevel / 100})`
    this.iframe.style.transformOrigin = 'top left'
    this.iframe.style.width = `${10000 / this.zoomLevel}%`
    this.iframe.style.height = `${10000 / this.zoomLevel}%`
  }

  private getInjectedCSS(): string {
    return `
      img:not([alt]) {
        outline: 2px dashed #dc3545 !important;
        outline-offset: 2px;
      }
      img:not([alt])::after {
        content: '⚠ Missing alt text';
        position: absolute;
        top: 0;
        left: 0;
        background: #dc3545;
        color: white;
        font-size: 10px;
        padding: 1px 4px;
        pointer-events: none;
      }
      ${this.showOutlines ? this.getOutlineCSS() : ''}
    `
  }

  private getOutlineCSS(): string {
    return `
      div, section, article, aside, nav, header, footer, main, p, h1, h2, h3, h4, h5, h6, ul, ol, li, table, form, fieldset, blockquote {
        outline: 1px dashed rgba(100, 149, 237, 0.4) !important;
      }
      *:hover {
        outline: 2px solid rgba(100, 149, 237, 0.8) !important;
        outline-offset: -1px;
      }
    `
  }

  private getInjectedScript(): string {
    return `
    (function() {
      let selectedEl = null;
      let dragDropEnabled = false;
      let dragSource = null;
      let dragMarker = null;

      function getSelectorPath(el) {
        if (!el) return '';
        var parts = [];
        var current = el;
        while (current && current.nodeType === 1) {
          var part = current.tagName.toLowerCase();
          if (current.id && !current.id.startsWith('rwe-')) {
            part += '#' + current.id;
          } else if (current.className && typeof current.className === 'string') {
            part += '.' + current.className.trim().split(/\\s+/).join('.');
          }
          // nth-of-type
          var parent = current.parentElement;
          if (parent) {
            var siblings = Array.from(parent.children).filter(function(c) {
              return c.tagName === current.tagName && !(c.id && c.id.startsWith('rwe-'));
            });
            if (siblings.length > 1 || !(current.id && !current.id.startsWith('rwe-'))) {
              var idx = siblings.indexOf(current) + 1;
              part += ':nth-of-type(' + idx + ')';
            }
          } else {
            // Top-level element (html) — match parser behavior
            if (!current.id) {
              part += ':nth-of-type(1)';
            }
          }
          parts.unshift(part);
          current = current.parentElement;
        }
        return parts.join(' > ');
      }

      function getComputedProps(el) {
        const cs = window.getComputedStyle(el);
        const props = {};
        const keys = [
          'margin', 'padding', 'border', 'border-radius',
          'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
          'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
          'text-align', 'text-decoration', 'color',
          'display', 'position', 'flex-direction', 'justify-content', 'align-items', 'gap',
          'background-color', 'background-image', 'opacity',
          'top', 'right', 'bottom', 'left', 'z-index', 'overflow', 'visibility'
        ];
        keys.forEach(k => { props[k] = cs.getPropertyValue(k); });
        return props;
      }

      function getAttributes(el) {
        const attrs = {};
        for (const attr of el.attributes) {
          if (!attr.name.startsWith('data-rwe')) {
            attrs[attr.name] = attr.value;
          }
        }
        return attrs;
      }

      document.addEventListener('click', function(e) {
        // Ignore clicks on injected elements
        if (e.target.id && e.target.id.startsWith('rwe-')) return;

        e.preventDefault();
        e.stopPropagation();

        const el = e.target;
        if (selectedEl) selectedEl.style.outline = '';
        selectedEl = el;
        el.style.outline = '2px solid #0066cc';

        const rect = el.getBoundingClientRect();
        window.parent.postMessage({
          type: 'element-selected',
          selectorPath: getSelectorPath(el),
          tagName: el.tagName.toLowerCase(),
          computedStyles: getComputedProps(el),
          attributes: getAttributes(el),
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        }, '*');
      }, true);

      document.addEventListener('mouseover', function(e) {
        const el = e.target;
        if (el === selectedEl) return;
        window.parent.postMessage({
          type: 'element-hovered',
          selectorPath: getSelectorPath(el)
        }, '*');
      });

      document.addEventListener('mouseout', function(e) {
        window.parent.postMessage({ type: 'element-hovered', selectorPath: null }, '*');
      });

      // Ctrl+K link editor
      document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          var sel = window.getSelection();
          var selectedText = sel ? sel.toString() : '';
          if (!selectedText) return;

          var existingHref = null;
          var existingTarget = null;
          var existingTitle = null;
          var selectorPath = null;

          // Check if selection is inside an existing <a> tag
          var anchor = null;
          if (sel && sel.anchorNode) {
            var node = sel.anchorNode;
            while (node && node !== document.body) {
              if (node.nodeType === 1 && node.tagName === 'A') {
                anchor = node;
                break;
              }
              node = node.parentNode;
            }
          }

          if (anchor) {
            existingHref = anchor.getAttribute('href') || '';
            existingTarget = anchor.getAttribute('target') || '';
            existingTitle = anchor.getAttribute('title') || '';
            selectorPath = getSelectorPath(anchor);
          }

          window.parent.postMessage({
            type: 'link-edit-request',
            selectedText: selectedText,
            existingHref: existingHref,
            existingTarget: existingTarget,
            existingTitle: existingTitle,
            selectorPath: selectorPath
          }, '*');
        }
      }, true);

      // Drag and drop
      window.addEventListener('message', function(e) {
        if (e.data?.type === 'rwe-set-dragdrop') {
          dragDropEnabled = e.data.enabled;
          document.querySelectorAll('[draggable]').forEach(el => el.removeAttribute('draggable'));
          if (dragDropEnabled) {
            document.querySelectorAll('body *:not(script):not(style):not(link)').forEach(el => {
              el.setAttribute('draggable', 'true');
            });
          }
        }
      });

      document.addEventListener('dragstart', function(e) {
        if (!dragDropEnabled) return;
        dragSource = e.target;
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.4';
      });

      document.addEventListener('dragend', function(e) {
        if (!dragDropEnabled) return;
        e.target.style.opacity = '';
        if (dragMarker) { dragMarker.remove(); dragMarker = null; }
      });

      document.addEventListener('dragover', function(e) {
        if (!dragDropEnabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = e.target;
        if (target === dragSource || target.contains(dragSource)) return;

        // Show insertion marker
        if (!dragMarker) {
          dragMarker = document.createElement('div');
          dragMarker.id = 'rwe-drag-marker';
          dragMarker.style.cssText = 'height:3px;background:#0066cc;position:absolute;left:0;right:0;pointer-events:none;z-index:99999;border-radius:2px;';
        }

        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? 'before' : 'after';
        dragMarker.style.top = (position === 'before' ? rect.top : rect.bottom) + 'px';
        dragMarker.dataset.position = position;
        document.body.appendChild(dragMarker);
      });

      document.addEventListener('drop', function(e) {
        if (!dragDropEnabled || !dragSource) return;
        e.preventDefault();
        const target = e.target;
        if (target === dragSource || target.contains(dragSource)) return;

        const position = dragMarker?.dataset.position || 'after';
        if (dragMarker) { dragMarker.remove(); dragMarker = null; }

        window.parent.postMessage({
          type: 'element-dragged',
          sourcePath: getSelectorPath(dragSource),
          targetPath: getSelectorPath(target),
          position: position
        }, '*');

        dragSource = null;
      });
    })();
    `
  }
}

// This file is part of Retro Web Editor.
//
// Retro Web Editor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Retro Web Editor is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Retro Web Editor in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
