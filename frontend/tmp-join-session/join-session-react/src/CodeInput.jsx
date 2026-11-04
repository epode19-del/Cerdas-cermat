import { useRef } from 'react'

const CODE_LEN = 6

export default function CodeInput({ value, onChange }) {
  const inputRefs = useRef([])

  const setChar = (index, char) => {
    const chars = value.split('')
    while (chars.length < CODE_LEN) chars.push('')
    chars[index] = char
    onChange(chars.join('').slice(0, CODE_LEN))
  }

  const handleInput = (index, e) => {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1)
    setChar(index, clean)
    if (clean && index < CODE_LEN - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (index, e) => {
    e.preventDefault()
    const text = (e.clipboardData.getData('text') || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    const chars = value.padEnd(CODE_LEN, ' ').split('')
    for (let j = 0; j < text.length && index + j < CODE_LEN; j++) {
      chars[index + j] = text[j]
    }
    const merged = chars.join('').replace(/ /g, '').slice(0, CODE_LEN)
    onChange(merged)
    const nextIndex = Math.min(index + text.length, CODE_LEN - 1)
    inputRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="code-row">
      {Array.from({ length: CODE_LEN }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="text"
          maxLength={1}
          className={`code-box${value[i] ? ' filled' : ''}`}
          value={value[i] || ''}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
        />
      ))}
    </div>
  )
}

export { CODE_LEN }
