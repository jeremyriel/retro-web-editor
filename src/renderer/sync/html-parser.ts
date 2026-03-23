import { SourceNode } from '../../shared/types'

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

interface ParseContext {
  html: string
  pos: number
}

export function parseHTML(html: string): SourceNode[] {
  const ctx: ParseContext = { html, pos: 0 }
  return parseChildren(ctx, null)
}

function parseChildren(ctx: ParseContext, parentTag: string | null): SourceNode[] {
  const children: SourceNode[] = []
  const siblingCounts: Record<string, number> = {}

  while (ctx.pos < ctx.html.length) {
    skipWhitespaceAndText(ctx)
    if (ctx.pos >= ctx.html.length) break

    // Check for closing tag
    if (ctx.html[ctx.pos] === '<' && ctx.html[ctx.pos + 1] === '/') {
      break
    }

    // Check for comment
    if (ctx.html.startsWith('<!--', ctx.pos)) {
      const endComment = ctx.html.indexOf('-->', ctx.pos)
      if (endComment !== -1) {
        ctx.pos = endComment + 3
        continue
      }
    }

    // Check for doctype
    if (ctx.html.startsWith('<!', ctx.pos)) {
      const endDoctype = ctx.html.indexOf('>', ctx.pos)
      if (endDoctype !== -1) {
        ctx.pos = endDoctype + 1
        continue
      }
    }

    if (ctx.html[ctx.pos] !== '<') {
      // Text node — skip
      const nextTag = ctx.html.indexOf('<', ctx.pos)
      ctx.pos = nextTag === -1 ? ctx.html.length : nextTag
      continue
    }

    const node = parseElement(ctx, parentTag, siblingCounts)
    if (node) {
      children.push(node)
    }
  }

  return children
}

function parseElement(ctx: ParseContext, parentTag: string | null, siblingCounts: Record<string, number>): SourceNode | null {
  const startOffset = ctx.pos

  // Parse opening tag
  if (ctx.html[ctx.pos] !== '<') return null
  ctx.pos++

  // Get tag name
  const tagStart = ctx.pos
  while (ctx.pos < ctx.html.length && /[a-zA-Z0-9\-]/.test(ctx.html[ctx.pos])) {
    ctx.pos++
  }
  const tagName = ctx.html.substring(tagStart, ctx.pos).toLowerCase()
  if (!tagName) return null

  // Parse attributes
  const attributes: Record<string, string> = {}
  while (ctx.pos < ctx.html.length && ctx.html[ctx.pos] !== '>' && ctx.html[ctx.pos] !== '/') {
    skipSpaces(ctx)
    if (ctx.html[ctx.pos] === '>' || ctx.html[ctx.pos] === '/') break

    const attrName = readAttrName(ctx)
    if (!attrName) { ctx.pos++; continue }

    skipSpaces(ctx)
    if (ctx.html[ctx.pos] === '=') {
      ctx.pos++
      skipSpaces(ctx)
      attributes[attrName] = readAttrValue(ctx)
    } else {
      attributes[attrName] = ''
    }
  }

  // Self-closing or end of opening tag
  const selfClosing = ctx.html[ctx.pos] === '/'
  if (selfClosing) ctx.pos++
  if (ctx.html[ctx.pos] === '>') ctx.pos++

  const openTagEnd = ctx.pos

  // Build selector path
  siblingCounts[tagName] = (siblingCounts[tagName] || 0) + 1
  const nthChild = siblingCounts[tagName]
  let selectorPart = tagName
  if (attributes.id) {
    selectorPart = `${tagName}#${attributes.id}`
  } else if (attributes.class) {
    selectorPart = `${tagName}.${attributes.class.split(/\s+/).join('.')}`
  }
  if (nthChild > 1 || !attributes.id) {
    selectorPart += `:nth-of-type(${nthChild})`
  }

  const parentPath = parentTag || ''
  const selectorPath = parentPath ? `${parentPath} > ${selectorPart}` : selectorPart

  // Void/self-closing elements
  if (selfClosing || VOID_ELEMENTS.has(tagName)) {
    return {
      tagName,
      selectorPath,
      startOffset,
      endOffset: ctx.pos,
      openTagEnd,
      children: [],
      attributes,
    }
  }

  // Skip script/style content
  if (tagName === 'script' || tagName === 'style') {
    const closeTag = `</${tagName}>`
    const closeIdx = ctx.html.indexOf(closeTag, ctx.pos)
    if (closeIdx !== -1) {
      ctx.pos = closeIdx + closeTag.length
    }
    return {
      tagName,
      selectorPath,
      startOffset,
      endOffset: ctx.pos,
      openTagEnd,
      children: [],
      attributes,
    }
  }

  // Parse children
  const children = parseChildren(ctx, selectorPath)

  // Parse closing tag
  if (ctx.html.startsWith(`</${tagName}`, ctx.pos)) {
    const closeEnd = ctx.html.indexOf('>', ctx.pos)
    if (closeEnd !== -1) ctx.pos = closeEnd + 1
  }

  return {
    tagName,
    selectorPath,
    startOffset,
    endOffset: ctx.pos,
    openTagEnd,
    children,
    attributes,
  }
}

function skipSpaces(ctx: ParseContext): void {
  while (ctx.pos < ctx.html.length && /\s/.test(ctx.html[ctx.pos])) {
    ctx.pos++
  }
}

function skipWhitespaceAndText(ctx: ParseContext): void {
  // Don't skip — we want to preserve position for text
}

function readAttrName(ctx: ParseContext): string {
  const start = ctx.pos
  while (ctx.pos < ctx.html.length && /[a-zA-Z0-9\-_:@.]/.test(ctx.html[ctx.pos])) {
    ctx.pos++
  }
  return ctx.html.substring(start, ctx.pos)
}

function readAttrValue(ctx: ParseContext): string {
  if (ctx.html[ctx.pos] === '"' || ctx.html[ctx.pos] === "'") {
    const quote = ctx.html[ctx.pos]
    ctx.pos++
    const start = ctx.pos
    while (ctx.pos < ctx.html.length && ctx.html[ctx.pos] !== quote) {
      ctx.pos++
    }
    const value = ctx.html.substring(start, ctx.pos)
    ctx.pos++ // skip closing quote
    return value
  }
  // Unquoted
  const start = ctx.pos
  while (ctx.pos < ctx.html.length && /[^\s>]/.test(ctx.html[ctx.pos])) {
    ctx.pos++
  }
  return ctx.html.substring(start, ctx.pos)
}

export function findNodeBySelector(nodes: SourceNode[], selectorPath: string): SourceNode | null {
  for (const node of nodes) {
    if (node.selectorPath === selectorPath) return node
    const found = findNodeBySelector(node.children, selectorPath)
    if (found) return found
  }
  return null
}

export function flattenNodes(nodes: SourceNode[]): SourceNode[] {
  const result: SourceNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenNodes(node.children))
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
