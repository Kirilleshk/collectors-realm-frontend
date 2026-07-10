import React, { useEffect, useRef } from 'react'
import { View, Text, Image, Animated, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../theme'
import HpBar from './HpBar'

// Крупный портрет босса (не растянутый на всю ширину — арт квадратный,
// растягивание на широкий баннер обрезало бы почти всё изображение) с
// многослойным пульсирующим свечением (внешний ореол + рамка) и лёгким
// "дыханием" — портрет чуть увеличивается в такт пульсу свечения, чтобы
// босс ощущался живым/угрожающим. Свечение становится золотым и постоянным,
// когда доступен удар в лицо.
function cardsWord(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'карта'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'карты'
  return 'карт'
}

export default function BossBanner({ bossName, imageUrl, hp, maxHp, popups, faceAttackable, onPress, height, handCount }) {
  const pulse = useRef(new Animated.Value(0)).current
  const portraitSize = Math.min(height - 24, 156)

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

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] })
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] })
  const breathScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] })

  return (
    <Pressable onPress={onPress} disabled={!faceAttackable} style={[s.wrap, { height }]}>
      <LinearGradient colors={[`${colors.accent}28`, colors.surface, colors.bg]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.row}>
        <View style={[s.portraitWrap, { width: portraitSize, height: portraitSize }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              s.halo,
              {
                width: portraitSize * 1.7,
                height: portraitSize * 1.7,
                borderRadius: portraitSize * 0.85,
                backgroundColor: faceAttackable ? colors.gold : colors.accent,
                opacity: faceAttackable ? 0.35 : haloOpacity,
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: breathScale }] }}>
            <Animated.View
              pointerEvents="none"
              style={[
                s.glowRing,
                { borderRadius: portraitSize * 0.2 + 5 },
                faceAttackable
                  ? { borderColor: colors.gold, borderWidth: 3, opacity: 1 }
                  : { borderColor: colors.accent, borderWidth: 2.5, opacity: glowOpacity },
              ]}
            />
            {imageUrl
              ? <Image source={{ uri: imageUrl }} style={{ width: portraitSize, height: portraitSize, borderRadius: portraitSize * 0.2 }} resizeMode="cover" />
              : <View style={[s.imageFallback, { width: portraitSize, height: portraitSize, borderRadius: portraitSize * 0.2 }]}><Text style={{ fontSize: portraitSize * 0.35 }}>👹</Text></View>}
          </Animated.View>
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {bossName}{faceAttackable ? ' — бить в лицо' : ''}
          </Text>
          <HpBar label="Босс" value={hp} max={maxHp} color={colors.accent} popups={popups} thick />
          {!!handCount && <Text style={s.handCount}>✋ {handCount} {cardsWord(handCount)} в руке</Text>}
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14 },
  portraitWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  glowRing: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5 },
  imageFallback: { backgroundColor: `${colors.accent}22`, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 10, letterSpacing: 0.3 },
  handCount: { fontSize: 11, color: colors.text2, marginTop: 4 },
})
