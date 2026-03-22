export function createColorInput(currentValue: string, propertyName: string, onChange: (value: string) => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.display = 'flex'
  wrapper.style.gap = '4px'
  wrapper.style.flex = '1'
  wrapper.style.minWidth = '0'
  wrapper.setAttribute('role', 'group')
  wrapper.setAttribute('aria-label', propertyName)

  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.value = toHex(currentValue)
  colorInput.setAttribute('aria-label', `${propertyName} color picker`)
  colorInput.addEventListener('input', () => {
    textInput.value = colorInput.value
    onChange(colorInput.value)
  })

  const textInput = document.createElement('input')
  textInput.type = 'text'
  textInput.value = currentValue
  textInput.style.flex = '1'
  textInput.style.minWidth = '0'
  textInput.setAttribute('aria-label', `${propertyName} color value`)
  textInput.addEventListener('change', () => {
    colorInput.value = toHex(textInput.value)
    onChange(textInput.value)
  })

  wrapper.appendChild(colorInput)
  wrapper.appendChild(textInput)
  return wrapper
}

function toHex(color: string): string {
  if (color.startsWith('#') && (color.length === 4 || color.length === 7)) {
    return color.length === 4
      ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#000000'
}

// This file is part of Web Interface Retro Editor for Desktop (WIRED).
//
// Web Interface Retro Editor for Desktop is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
//
// Web Interface Retro Editor for Desktop is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License 3.0 along with Web Interface Retro Editor for Desktop in the /copying folder or on the About page in the Help menu. If not, see <https://www.gnu.org/licenses/>.
