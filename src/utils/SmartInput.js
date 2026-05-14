import React from 'react'
import { TextInput, Platform } from 'react-native'

export default function SmartInput({ onFocus, style, ...props }) {
  function handleFocus(e) {
    if (Platform.OS === 'web' && e?.target?.scrollIntoView) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
    onFocus?.(e)
  }
  return <TextInput style={style} onFocus={handleFocus} {...props} />
}
