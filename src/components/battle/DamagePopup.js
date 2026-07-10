import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'
import { colors } from '../../theme'

// positive=true — всплывающий бонус (например, +1 к атаке от ауры союзника
// при выходе баффера на стол), рисуется золотым с плюсом вместо обычного
// урона (минус, цвет текста)
export default function DamagePopup({ amount, positive }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: false }).start()
  }, [])

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -26] })
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] })

  return (
    <Animated.Text style={[s.popup, positive && s.popupPositive, { transform: [{ translateY }], opacity }]}>
      {positive ? '+' : '−'}{amount}
    </Animated.Text>
  )
}

const s = StyleSheet.create({
  popup: { position: 'absolute', right: 4, top: 0, fontSize: 13, fontWeight: '700', color: colors.text },
  popupPositive: { color: colors.gold },
})
