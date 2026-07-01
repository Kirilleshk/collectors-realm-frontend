import React, { useEffect, useRef } from 'react'
import { View, Text, Image, Animated, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../theme'
import HpBar from './HpBar'

// Крупный портрет босса (не растянутый на всю ширину — арт квадратный,
// растягивание на широкий баннер обрезало бы почти всё изображение) с
// пульсирующим свечением вокруг и атмосферным градиентом-подложкой на весь
// блок. Свечение становится золотым и постоянным, когда доступен удар в лицо.
export default function BossBanner({ bossName, imageUrl, hp, maxHp, popups, faceAttackable, onPress, height }) {
  const pulse = useRef(new Animated.Value(0)).current
  const portraitSize = Math.min(height - 20, 120)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] })

  return (
    <Pressable onPress={onPress} disabled={!faceAttackable} style={[s.wrap, { height }]}>
      <LinearGradient colors={[`${colors.accent}20`, colors.surface, colors.bg]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.row}>
        <View style={[s.portraitWrap, { width: portraitSize, height: portraitSize, borderRadius: portraitSize * 0.2 }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              s.glowRing,
              { borderRadius: portraitSize * 0.2 + 4 },
              faceAttackable
                ? { borderColor: colors.gold, borderWidth: 3, opacity: 1 }
                : { borderColor: colors.accent, borderWidth: 2, opacity: glowOpacity },
            ]}
          />
          {imageUrl
            ? <Image source={{ uri: imageUrl }} style={{ width: portraitSize, height: portraitSize, borderRadius: portraitSize * 0.2 }} resizeMode="cover" />
            : <View style={[s.imageFallback, { width: portraitSize, height: portraitSize, borderRadius: portraitSize * 0.2 }]}><Text style={s.fallbackIcon}>👹</Text></View>}
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {bossName}{faceAttackable ? ' — бить в лицо' : ''}
          </Text>
          <HpBar label="Босс" value={hp} max={maxHp} color={colors.accent} popups={popups} thick />
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14 },
  portraitWrap: { overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  glowRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4 },
  imageFallback: { backgroundColor: `${colors.accent}22`, alignItems: 'center', justifyContent: 'center' },
  fallbackIcon: { fontSize: 40 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10, letterSpacing: 0.3 },
})
