import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated, Image, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import SmartInput from '../utils/SmartInput'
import { track } from '../utils/analytics'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'
const API = 'https://collectors-realm-backend.onrender.com/api'

const ALL_ROLES = [
  { key: 'COLLECTOR', label: 'Коллекционер', icon: '🗿', color: '#4A90D9' },
  { key: 'MASTER_REPAIR', label: 'Мастер по ремонту', icon: '🔧', color: '#E04E28' },
  { key: 'CUSTOMIZER', label: 'Кастомизатор', icon: '🎨', color: '#AF52DE' },
  { key: 'DIORAMA', label: 'Мастер диорам', icon: '🏔', color: '#34C759' },
]

export default function LoginScreen() {
  const { login, register, updateUser } = useAuth()
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('form') // 'form' | 'photos'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState(['COLLECTOR'])
  const [avatarPhoto, setAvatarPhoto] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [portfolioPhotos, setPortfolioPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const logoScale = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start()
  }, [])

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  function validateEmail(val) {
    if (!val) { setEmailError(''); return }
    setEmailError(EMAIL_RE.test(val) ? '' : 'Некорректный email')
  }

  function switchMode(m) {
    setMode(m)
    setStep('form')
    setError('')
    setEmailError('')
    setVerificationCode('')
    setResendTimer(0)
    setAvatarPhoto(null)
    setPortfolioPhotos([])
  }

  async function sendVerificationCode() {
    setSendingCode(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Не удалось отправить код'); setSendingCode(false); return }
      setStep('verify')
      setResendTimer(60)
      const interval = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(interval); return 0 } return t - 1 })
      }, 1000)
    } catch {
      setError('Ошибка отправки. Проверьте интернет.')
    }
    setSendingCode(false)
  }

  function toggleRole(key) {
    setSelectedRoles(prev =>
      prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
    )
  }

  async function pickAvatar() {
    setUploadingAvatar(true)
    setError('')
    const url = await pickAndUploadPhoto()
    if (url) setAvatarPhoto(url)
    else setError('Ошибка загрузки фото')
    setUploadingAvatar(false)
  }

  async function pickPhoto() {
    if (portfolioPhotos.length >= 5) return
    setUploadingPhoto(true)
    setError('')
    const url = await pickAndUploadPhoto()
    if (url) setPortfolioPhotos(p => [...p, url])
    else setError('Ошибка загрузки фото')
    setUploadingPhoto(false)
  }

  async function handleSubmit() {
    setError('')

    if (mode === 'login') {
      setLoading(true)
      try {
        await login(email, password)
        track('login')
      } catch (e) {
        const errData = e.response?.data
        if (errData?.error === 'ACCOUNT_BLOCKED') {
          setBlockedReason(errData?.message || 'Ваш аккаунт заблокирован за нарушение правил сообщества')
          setBlocked(true)
        } else {
          setError(errData?.error || 'Ошибка. Проверьте данные.')
        }
      }
      setLoading(false)
      return
    }

    // Регистрация — шаг 1: валидация формы → отправка кода
    if (step === 'form') {
      if (!name.trim()) { setError('Введите имя'); return }
      if (!email.trim()) { setError('Введите email'); return }
      if (!EMAIL_RE.test(email.trim())) { setError('Введите корректный email'); return }
      if (password.length < 6) { setError('Пароль должен быть не менее 6 символов'); return }
      if (selectedRoles.length === 0) { setError('Выберите хотя бы одну роль'); return }
      await sendVerificationCode()
      return
    }

    // Регистрация — шаг 1.5: проверка кода
    if (step === 'verify') {
      if (!verificationCode.trim()) { setError('Введите код из письма'); return }
      setLoading(true)
      try {
        const res = await fetch(`${API}/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), code: verificationCode.trim() }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Неверный код'); setLoading(false); return }
        setStep('photos')
      } catch {
        setError('Ошибка проверки кода')
      }
      setLoading(false)
      return
    }

    // Регистрация — шаг 2: проверяем аватарку и создаём аккаунт
    if (!avatarPhoto) { setError('Добавьте фото профиля — это обязательно'); return }
    setLoading(true)
    try {
      const { token: regToken } = await register(name.trim(), email.trim(), password, selectedRoles)
      track('register', { roles: selectedRoles })
      await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regToken}` },
        body: JSON.stringify({ avatarUrl: avatarPhoto, portfolioUrls: portfolioPhotos }),
      })
      await updateUser({ avatarUrl: avatarPhoto })
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка. Проверьте данные.')
    }
    setLoading(false)
  }

  if (blocked) return (
    <SafeAreaView style={[s.wrap, { justifyContent: 'center' }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,59,48,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 44 }}>🚫</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12, textAlign: 'center' }}>
          Аккаунт заблокирован
        </Text>
        <Text style={{ fontSize: 15, color: colors.text2, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
          {blockedReason}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: 14, padding: 16, width: '100%', alignItems: 'center', marginBottom: 12 }}
          onPress={() => Linking.openURL('mailto:ksele52@gmail.com?subject=Разблокировка аккаунта')}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>💬 Связь с администрацией</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 12 }} onPress={() => { setBlocked(false); setError('') }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Вернуться к входу</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.wrap}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Логотип */}
        <Animated.View style={[s.header, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
          <View style={s.logoWrap}>
            <Text style={s.logoIcon}>🗿</Text>
          </View>
          <Text style={s.logo}>Collector's Realm</Text>
          <Text style={s.sub}>Сообщество коллекционеров</Text>
          <View style={s.logoLine} />
        </Animated.View>

        {/* Карточка */}
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Переключатель */}
          <View style={s.modeSwitch}>
            <TouchableOpacity style={[s.modeBtn, mode === 'login' && s.modeBtnActive]} onPress={() => switchMode('login')}>
              <Text style={[s.modeBtnText, mode === 'login' && s.modeBtnTextActive]}>Вход</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, mode === 'register' && s.modeBtnActive]} onPress={() => switchMode('register')}>
              <Text style={[s.modeBtnText, mode === 'register' && s.modeBtnTextActive]}>Регистрация</Text>
            </TouchableOpacity>
          </View>

          {/* Индикатор шагов при регистрации */}
          {mode === 'register' && (
            <View style={s.steps}>
              <View style={[s.stepDot, { backgroundColor: colors.accent }]} />
              <View style={[s.stepLine, (step === 'verify' || step === 'photos') && { backgroundColor: colors.accent }]} />
              <View style={[s.stepDot, (step === 'verify' || step === 'photos') && { backgroundColor: colors.accent }]} />
              <View style={[s.stepLine, step === 'photos' && { backgroundColor: colors.accent }]} />
              <View style={[s.stepDot, step === 'photos' && { backgroundColor: colors.accent }]} />
              <Text style={s.stepText}>
                {step === 'form' ? 'Шаг 1 из 3 — Данные' : step === 'verify' ? 'Шаг 2 из 3 — Подтверждение email' : 'Шаг 3 из 3 — Фото профиля'}
              </Text>
            </View>
          )}

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorIcon}>⚠️</Text>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ШАГ 1: Форма */}
          {(mode === 'login' || (mode === 'register' && step === 'form')) && (
            <>
              {mode === 'register' && (
                <View style={s.field}>
                  <Text style={s.label}>Имя</Text>
                  <SmartInput style={s.input} value={name} onChangeText={setName} placeholder="Ваше имя" placeholderTextColor={colors.text2} />
                </View>
              )}
              <View style={s.field}>
                <Text style={s.label}>Email</Text>
                <SmartInput
                  style={[s.input, emailError ? { borderColor: '#FF3B30' } : null]}
                  value={email}
                  onChangeText={v => { setEmail(v); validateEmail(v) }}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.text2}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailError ? <Text style={s.fieldError}>{emailError}</Text> : null}
              </View>
              <View style={s.field}>
                <Text style={s.label}>Пароль</Text>
                <SmartInput style={s.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.text2} secureTextEntry />
              </View>
              {mode === 'register' && (
                <View style={s.field}>
                  <Text style={s.label}>Кто вы? (можно выбрать несколько)</Text>
                  <View style={s.rolesGrid}>
                    {ALL_ROLES.map(role => {
                      const active = selectedRoles.includes(role.key)
                      return (
                        <TouchableOpacity
                          key={role.key}
                          style={[s.roleCard, active && { borderColor: role.color, backgroundColor: `${role.color}15` }]}
                          onPress={() => toggleRole(role.key)}
                        >
                          <Text style={s.roleIcon}>{role.icon}</Text>
                          <Text style={[s.roleLabel, active && { color: role.color, fontWeight: '700' }]}>{role.label}</Text>
                          {active && (
                            <View style={[s.roleCheck, { backgroundColor: role.color }]}>
                              <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* ШАГ 1.5: Подтверждение email */}
          {mode === 'register' && step === 'verify' && (
            <View style={s.field}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📧</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Проверьте почту</Text>
                <Text style={{ fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 18 }}>
                  Мы отправили 6-значный код на{'\n'}
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>{email}</Text>
                </Text>
              </View>

              <Text style={s.label}>КОД ПОДТВЕРЖДЕНИЯ</Text>
              <SmartInput
                style={[s.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                value={verificationCode}
                onChangeText={v => { setVerificationCode(v.replace(/\D/g, '').slice(0, 6)); setError('') }}
                placeholder="000000"
                placeholderTextColor={colors.text2}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 8 }}
                onPress={sendVerificationCode}
                disabled={resendTimer > 0 || sendingCode}
              >
                <Text style={{ fontSize: 13, color: resendTimer > 0 ? colors.text2 : colors.accent, fontWeight: '500' }}>
                  {resendTimer > 0 ? `Отправить повторно через ${resendTimer} сек` : 'Отправить код повторно'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setStep('form'); setError(''); setVerificationCode('') }} style={s.backBtn}>
                <Text style={s.backBtnText}>← Изменить email</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ШАГ 2: Аватар + фото коллекции */}
          {mode === 'register' && step === 'photos' && (
            <View style={s.field}>
              {/* Аватар — обязательно */}
              <Text style={s.label}>ФОТО ПРОФИЛЯ *</Text>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar} style={[s.avatarPickerWrap, avatarPhoto && { borderStyle: 'solid', borderColor: colors.accent }]}>
                  {uploadingAvatar ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : avatarPhoto ? (
                    <>
                      <Image source={{ uri: avatarPhoto }} style={s.avatarPickerImg} />
                      <View style={s.avatarPickerBadge}><Text style={{ color: 'white', fontSize: 10 }}>📷</Text></View>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 36, marginBottom: 4 }}>👤</Text>
                      <Text style={{ fontSize: 11, color: colors.text2 }}>Выбрать фото</Text>
                    </>
                  )}
                </TouchableOpacity>
                {!avatarPhoto && (
                  <Text style={{ fontSize: 11, color: colors.accent, marginTop: 6 }}>Обязательно для регистрации</Text>
                )}
              </View>

              <Text style={s.label}>ФОТО КОЛЛЕКЦИИ</Text>
              <Text style={s.photoHint}>Покажи что ты коллекционируешь — это поможет найти единомышленников</Text>
              <View style={s.photoGrid}>
                {portfolioPhotos.map((url, i) => (
                  <View key={i} style={s.photoWrap}>
                    <Image source={{ uri: url }} style={s.photo} />
                    <TouchableOpacity
                      style={s.photoRemove}
                      onPress={() => setPortfolioPhotos(p => p.filter((_, j) => j !== i))}
                    >
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {portfolioPhotos.length < 5 && (
                  <TouchableOpacity style={s.photoAdd} onPress={pickPhoto} disabled={uploadingPhoto}>
                    {uploadingPhoto
                      ? <ActivityIndicator color={colors.accent} />
                      : <>
                          <Text style={{ fontSize: 28, color: colors.text2 }}>📷</Text>
                          <Text style={{ fontSize: 11, color: colors.text2, marginTop: 4 }}>Добавить</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}
              </View>
              {portfolioPhotos.length === 0 && (
                <Text style={s.photoRequired}>Фото можно добавить позже в профиле</Text>
              )}
              <TouchableOpacity onPress={() => { setStep('form'); setError('') }} style={s.backBtn}>
                <Text style={s.backBtnText}>← Назад к данным</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading || uploadingPhoto}>
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={s.btnText}>
                  {mode === 'login' ? '→ Войти' : step === 'form' ? (sendingCode ? 'Отправляем код...' : '→ Далее') : step === 'verify' ? '→ Подтвердить' : '→ Создать аккаунт'}
                </Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
          <Text style={s.footerText}>Collector's Realm © 2024</Text>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  logoIcon: { fontSize: 40 },
  logo: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: 0.5, marginBottom: 6 },
  sub: { fontSize: 12, color: colors.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 },
  logoLine: { width: 40, height: 2, backgroundColor: colors.accent, borderRadius: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20,
  },
  modeSwitch: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 12, padding: 4, marginBottom: 16 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.accent },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  modeBtnTextActive: { color: 'white' },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, borderRadius: 1 },
  stepText: { fontSize: 11, color: colors.text2, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,78,40,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(224,78,40,0.3)',
  },
  errorIcon: { fontSize: 16 },
  errorText: { color: colors.accent, fontSize: 13, flex: 1 },
  fieldError: { color: '#FF3B30', fontSize: 12, marginTop: 4, marginLeft: 2 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.text, fontSize: 15,
  },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleCard: {
    width: '47%', padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface2, alignItems: 'center', gap: 6, position: 'relative',
  },
  roleIcon: { fontSize: 28 },
  roleLabel: { fontSize: 12, fontWeight: '500', color: colors.text2, textAlign: 'center' },
  roleCheck: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarPickerWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  avatarPickerImg: { width: 100, height: 100, borderRadius: 50 },
  avatarPickerBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  photoHint: { fontSize: 13, color: colors.text2, marginBottom: 14, lineHeight: 18 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 90, height: 90, borderRadius: 12 },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,59,48,0.9)', justifyContent: 'center', alignItems: 'center',
  },
  photoAdd: {
    width: 90, height: 90, borderRadius: 12,
    backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoRequired: { fontSize: 12, color: colors.accent, marginBottom: 12 },
  backBtn: { marginTop: 4 },
  backBtnText: { fontSize: 13, color: colors.text2, fontWeight: '500' },
  btn: {
    backgroundColor: colors.accent, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  footer: { alignItems: 'center', marginTop: 32 },
  footerText: { fontSize: 12, color: colors.text2 },
})
