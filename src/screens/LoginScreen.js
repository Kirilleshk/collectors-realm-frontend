import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated, Image, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import SmartInput from '../utils/SmartInput'
import { track } from '../utils/analytics'
import ScreenBackground from '../components/ScreenBackground'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'
const API = 'https://collectors-realm-backend.onrender.com/api'
// Марк, 26.08.2026 (срочно): было 5, поднято до 10 — бэкенд не ограничивает
// число фото в портфолио вообще (только фронтенд), см. также ProfileScreen.js
const MAX_PORTFOLIO_PHOTOS = 10

const ALL_ROLES = [
  { key: 'COLLECTOR', label: 'Коллекционер', icon: '🗿', color: '#4A90D9' },
  { key: 'MASTER_REPAIR', label: 'Мастер по ремонту', icon: '🔧', color: '#E04E28' },
  { key: 'CUSTOMIZER', label: 'Кастомизатор', icon: '🎨', color: '#AF52DE' },
  { key: 'DIORAMA', label: 'Мастер диорам', icon: '🏔', color: '#34C759' },
]

// Обязательная анкета при регистрации (Марк, 09.08) — что коллекционирует,
// мультивыбор, минимум один вариант.
const ALL_COLLECTOR_TYPES = [
  { key: 'FIGURES', label: 'Фигурки', icon: '🗿' },
  { key: 'STATUES', label: 'Статуи', icon: '🏛' },
  { key: 'CONSOLES', label: 'Приставки', icon: '🎮' },
  { key: 'GAMES', label: 'Компьютерные игры', icon: '💾' },
  { key: 'CARDS', label: 'Карточки', icon: '🃏' },
]

const BIO_MIN = 100
const BIO_MAX = 3000

// Простая проверка "не ерунда" без ИИ (по решению 09.08 — экономим квоту
// Groq для библиотеки знаний, здесь хватает эвристики): текст должен
// содержать буквы, а не быть просто повтором одного символа/бессмыслицей
// вроде "аааааа" или "12345".
function isLikelyGarbage(text) {
  const trimmed = text.trim()
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(trimmed)) return true
  const letters = trimmed.replace(/\s+/g, '')
  if (letters.length === 0) return true
  const counts = {}
  for (const ch of letters.toLowerCase()) counts[ch] = (counts[ch] || 0) + 1
  const maxCount = Math.max(...Object.values(counts))
  return maxCount / letters.length > 0.6
}

export default function LoginScreen() {
  const { login, register, updateUser } = useAuth()
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('form') // 'form' | 'verify' | 'photos' | 'anketa'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState(['COLLECTOR'])
  const [avatarPhoto, setAvatarPhoto] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [portfolioPhotos, setPortfolioPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  // Анкета коллекционера — обязательный шаг 4 при регистрации (Марк, 09.08)
  const [age, setAge] = useState('')
  const [collectorTypes, setCollectorTypes] = useState([])
  const [collectingSinceYears, setCollectingSinceYears] = useState('')
  const [lessThanYear, setLessThanYear] = useState(false)
  const [favoriteFranchise, setFavoriteFranchise] = useState('')
  const [favoriteCharacter, setFavoriteCharacter] = useState('')
  const [bio, setBio] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [forgotStep, setForgotStep] = useState('request') // 'request' | 'reset'
  const [newPassword, setNewPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
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
    setForgotStep('request')
    setError('')
    setEmailError('')
    setVerificationCode('')
    setResendTimer(0)
    setAvatarPhoto(null)
    setPortfolioPhotos([])
    setNewPassword('')
    setResetSuccess(false)
    setAge('')
    setCollectorTypes([])
    setCollectingSinceYears('')
    setLessThanYear(false)
    setFavoriteFranchise('')
    setFavoriteCharacter('')
    setBio('')
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

  async function sendResetCode() {
    if (!email.trim() || !EMAIL_RE.test(email.trim())) { setError('Введите корректный email'); return }
    setSendingCode(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Не удалось отправить код'); setSendingCode(false); return }
      setForgotStep('reset')
      setResendTimer(60)
      const interval = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(interval); return 0 } return t - 1 })
      }, 1000)
    } catch {
      setError('Ошибка отправки. Проверьте интернет.')
    }
    setSendingCode(false)
  }

  async function submitReset() {
    if (!verificationCode.trim()) { setError('Введите код из письма'); return }
    if (newPassword.length < 6) { setError('Пароль должен быть не менее 6 символов'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: verificationCode.trim(), newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Не удалось сбросить пароль'); setLoading(false); return }
      switchMode('login')
      setPassword('')
      setResetSuccess(true)
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.')
    }
    setLoading(false)
  }

  function toggleRole(key) {
    setSelectedRoles(prev =>
      prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
    )
  }

  function toggleCollectorType(key) {
    setCollectorTypes(prev =>
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
    if (portfolioPhotos.length >= MAX_PORTFOLIO_PHOTOS) return
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

    if (mode === 'forgot') {
      if (forgotStep === 'request') await sendResetCode()
      else await submitReset()
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

    // Регистрация — шаг 3: аватар + минимум 3 фото коллекции → дальше к анкете
    if (step === 'photos') {
      if (!avatarPhoto) { setError('Добавьте фото профиля — это обязательно'); return }
      if (portfolioPhotos.length < 3) { setError('Добавьте минимум 3 фото своей коллекции'); return }
      setStep('anketa')
      return
    }

    // Регистрация — шаг 4: анкета коллекционера → создаём аккаунт
    if (collectorTypes.length === 0) { setError('Выберите, что вы коллекционируете — хотя бы один вариант'); return }
    const ageNum = parseInt(age, 10)
    if (!age || isNaN(ageNum) || ageNum < 5 || ageNum > 100) { setError('Укажите корректный возраст'); return }
    if (!lessThanYear && (!collectingSinceYears || isNaN(parseInt(collectingSinceYears, 10)) || parseInt(collectingSinceYears, 10) < 0)) {
      setError('Укажите, сколько лет вы коллекционируете, или отметьте «меньше года»')
      return
    }
    if (!favoriteFranchise.trim() || isLikelyGarbage(favoriteFranchise)) { setError('Укажите любимую франшизу'); return }
    if (!favoriteCharacter.trim() || isLikelyGarbage(favoriteCharacter)) { setError('Укажите любимого персонажа'); return }
    const bioTrimmed = bio.trim()
    if (bioTrimmed.length < BIO_MIN) { setError(`Расскажите о себе подробнее — минимум ${BIO_MIN} символов`); return }
    if (bioTrimmed.length > BIO_MAX) { setError(`Слишком длинно — максимум ${BIO_MAX} символов`); return }
    if (isLikelyGarbage(bioTrimmed)) { setError('Похоже на бессмысленный текст — расскажите о себе по-настоящему'); return }

    setLoading(true)
    try {
      const { token: regToken } = await register(name.trim(), email.trim(), password, selectedRoles)
      track('register', { roles: selectedRoles })
      await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regToken}` },
        body: JSON.stringify({
          avatarUrl: avatarPhoto,
          portfolioUrls: portfolioPhotos,
          age: ageNum,
          collectorTypes,
          collectingSinceYears: lessThanYear ? 0 : parseInt(collectingSinceYears, 10),
          favoriteFranchise: favoriteFranchise.trim(),
          favoriteCharacter: favoriteCharacter.trim(),
          bio: bioTrimmed,
        }),
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
    <ScreenBackground>
    <SafeAreaView style={s.wrap}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Логотип */}
        <Animated.View style={[s.header, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
          <View style={s.logoWrap}>
            <Text style={s.logoIcon}>🗿</Text>
          </View>
          <Text style={s.logo}>Markeltoys</Text>
          <Text style={s.sub}>Сообщество коллекционеров</Text>
          <View style={s.logoLine} />
        </Animated.View>

        {/* Карточка */}
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Переключатель */}
          {mode !== 'forgot' && (
            <View style={s.modeSwitch}>
              <TouchableOpacity style={[s.modeBtn, mode === 'login' && s.modeBtnActive]} onPress={() => switchMode('login')}>
                <Text style={[s.modeBtnText, mode === 'login' && s.modeBtnTextActive]}>Вход</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modeBtn, mode === 'register' && s.modeBtnActive]} onPress={() => switchMode('register')}>
                <Text style={[s.modeBtnText, mode === 'register' && s.modeBtnTextActive]}>Регистрация</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Индикатор шагов при регистрации */}
          {mode === 'register' && (
            <View style={s.steps}>
              <View style={[s.stepDot, { backgroundColor: colors.accent }]} />
              <View style={[s.stepLine, step !== 'form' && { backgroundColor: colors.accent }]} />
              <View style={[s.stepDot, step !== 'form' && { backgroundColor: colors.accent }]} />
              <View style={[s.stepLine, (step === 'photos' || step === 'anketa') && { backgroundColor: colors.accent }]} />
              <View style={[s.stepDot, (step === 'photos' || step === 'anketa') && { backgroundColor: colors.accent }]} />
              <View style={[s.stepLine, step === 'anketa' && { backgroundColor: colors.accent }]} />
              <View style={[s.stepDot, step === 'anketa' && { backgroundColor: colors.accent }]} />
              <Text style={s.stepText}>
                {step === 'form' ? 'Шаг 1 из 4 — Данные'
                  : step === 'verify' ? 'Шаг 2 из 4 — Подтверждение email'
                  : step === 'photos' ? 'Шаг 3 из 4 — Фото'
                  : 'Шаг 4 из 4 — О себе'}
              </Text>
            </View>
          )}

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.msgIcon}>⚠️</Text>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {resetSuccess && mode === 'login' && !error ? (
            <View style={s.successBox}>
              <Text style={s.msgIcon}>✅</Text>
              <Text style={s.successText}>Пароль изменён. Войдите с новым паролем.</Text>
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
                <SmartInput style={s.input} value={password} onChangeText={v => { setPassword(v); setResetSuccess(false) }} placeholder="••••••••" placeholderTextColor={colors.text2} secureTextEntry />
                {mode === 'login' && (
                  <TouchableOpacity onPress={() => switchMode('forgot')} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>Забыли пароль?</Text>
                  </TouchableOpacity>
                )}
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

          {/* ЗАБЫЛИ ПАРОЛЬ: шаг 1 — email */}
          {mode === 'forgot' && forgotStep === 'request' && (
            <View style={s.field}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🔑</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Восстановление пароля</Text>
                <Text style={{ fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 18 }}>
                  Введите email от аккаунта — если он зарегистрирован, пришлём код для сброса пароля
                </Text>
              </View>
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
              <TouchableOpacity onPress={() => switchMode('login')} style={s.backBtn}>
                <Text style={s.backBtnText}>← Вернуться ко входу</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ЗАБЫЛИ ПАРОЛЬ: шаг 2 — код из письма + новый пароль */}
          {mode === 'forgot' && forgotStep === 'reset' && (
            <View style={s.field}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📧</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Проверьте почту</Text>
                <Text style={{ fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 18 }}>
                  Если email зарегистрирован — мы отправили 6-значный код на{'\n'}
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>{email}</Text>
                </Text>
              </View>

              <Text style={s.label}>КОД ИЗ ПИСЬМА</Text>
              <SmartInput
                style={[s.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                value={verificationCode}
                onChangeText={v => { setVerificationCode(v.replace(/\D/g, '').slice(0, 6)); setError('') }}
                placeholder="000000"
                placeholderTextColor={colors.text2}
                keyboardType="number-pad"
                maxLength={6}
              />

              <View style={[s.field, { marginTop: 16, marginBottom: 0 }]}>
                <Text style={s.label}>Новый пароль</Text>
                <SmartInput style={s.input} value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" placeholderTextColor={colors.text2} secureTextEntry />
              </View>

              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 12 }}
                onPress={sendResetCode}
                disabled={resendTimer > 0 || sendingCode}
              >
                <Text style={{ fontSize: 13, color: resendTimer > 0 ? colors.text2 : colors.accent, fontWeight: '500' }}>
                  {resendTimer > 0 ? `Отправить повторно через ${resendTimer} сек` : 'Отправить код повторно'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setForgotStep('request'); setError(''); setVerificationCode(''); setNewPassword('') }} style={s.backBtn}>
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

              <Text style={s.label}>ФОТО КОЛЛЕКЦИИ * (минимум 3)</Text>
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
                {portfolioPhotos.length < MAX_PORTFOLIO_PHOTOS && (
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
              {portfolioPhotos.length < 3 && (
                <Text style={s.photoRequired}>Ещё {3 - portfolioPhotos.length} фото до минимума — обязательно для регистрации</Text>
              )}
              <TouchableOpacity onPress={() => { setStep('form'); setError('') }} style={s.backBtn}>
                <Text style={s.backBtnText}>← Назад к данным</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ШАГ 4: Анкета коллекционера (обязательно, Марк 09.08) */}
          {mode === 'register' && step === 'anketa' && (
            <View style={s.field}>
              <Text style={s.label}>ВОЗРАСТ *</Text>
              <SmartInput
                style={s.input}
                value={age}
                onChangeText={t => setAge(t.replace(/[^0-9]/g, ''))}
                placeholder="Например, 27"
                placeholderTextColor={colors.text2}
                keyboardType="number-pad"
                maxLength={3}
              />

              <Text style={[s.label, { marginTop: 16 }]}>ЧТО КОЛЛЕКЦИОНИРУЕШЬ? * (можно несколько)</Text>
              <View style={s.rolesGrid}>
                {ALL_COLLECTOR_TYPES.map(t => {
                  const active = collectorTypes.includes(t.key)
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.roleCard, active && { borderColor: colors.accent, backgroundColor: `${colors.accent}15` }]}
                      onPress={() => toggleCollectorType(t.key)}
                    >
                      <Text style={s.roleIcon}>{t.icon}</Text>
                      <Text style={[s.roleLabel, active && { color: colors.accent, fontWeight: '700' }]}>{t.label}</Text>
                      {active && (
                        <View style={[s.roleCheck, { backgroundColor: colors.accent }]}>
                          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={[s.label, { marginTop: 16 }]}>КАК ДОЛГО КОЛЛЕКЦИОНИРУЕШЬ? *</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SmartInput
                  style={[s.input, { flex: 1, opacity: lessThanYear ? 0.4 : 1 }]}
                  value={collectingSinceYears}
                  onChangeText={t => setCollectingSinceYears(t.replace(/[^0-9]/g, ''))}
                  placeholder="Лет"
                  placeholderTextColor={colors.text2}
                  keyboardType="number-pad"
                  editable={!lessThanYear}
                  maxLength={2}
                />
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setLessThanYear(v => !v)}
                >
                  <View style={[s.checkbox, lessThanYear && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                    {lessThanYear && <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.text }}>Меньше года</Text>
                </TouchableOpacity>
              </View>

              <Text style={[s.label, { marginTop: 16 }]}>ЛЮБИМАЯ ФРАНШИЗА *</Text>
              <SmartInput
                style={s.input}
                value={favoriteFranchise}
                onChangeText={setFavoriteFranchise}
                placeholder="Например, Marvel"
                placeholderTextColor={colors.text2}
                maxLength={120}
              />

              <Text style={[s.label, { marginTop: 16 }]}>ЛЮБИМЫЙ ПЕРСОНАЖ *</Text>
              <SmartInput
                style={s.input}
                value={favoriteCharacter}
                onChangeText={setFavoriteCharacter}
                placeholder="Например, Дэдпул"
                placeholderTextColor={colors.text2}
                maxLength={120}
              />

              <Text style={[s.label, { marginTop: 16 }]}>О СЕБЕ * ({BIO_MIN}–{BIO_MAX} символов)</Text>
              <SmartInput
                style={[s.input, s.bioInput]}
                value={bio}
                onChangeText={t => setBio(t.slice(0, BIO_MAX))}
                placeholder="Расскажи, как начал коллекционировать, что для тебя это значит..."
                placeholderTextColor={colors.text2}
                multiline
                numberOfLines={5}
              />
              <Text style={[s.bioCounter, bio.trim().length < BIO_MIN && { color: colors.accent }]}>
                {bio.trim().length} / {BIO_MIN}–{BIO_MAX}
              </Text>

              <TouchableOpacity onPress={() => { setStep('photos'); setError('') }} style={s.backBtn}>
                <Text style={s.backBtnText}>← Назад к фото</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading || uploadingPhoto}>
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={s.btnText}>
                  {mode === 'login' ? '→ Войти'
                    : mode === 'forgot' ? (forgotStep === 'request' ? (sendingCode ? 'Отправляем код...' : '→ Отправить код') : '→ Сбросить пароль')
                    : step === 'form' ? (sendingCode ? 'Отправляем код...' : '→ Далее')
                    : step === 'verify' ? '→ Подтвердить'
                    : step === 'photos' ? '→ Далее'
                    : '→ Создать аккаунт'}
                </Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
          <Text style={s.footerText}>Markeltoys © 2024</Text>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
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
  msgIcon: { fontSize: 16 },
  errorText: { color: colors.accent, fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(42,170,96,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(42,170,96,0.3)',
  },
  successText: { color: colors.green, fontSize: 13, flex: 1 },
  fieldError: { color: '#FF3B30', fontSize: 12, marginTop: 4, marginLeft: 2 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.text, fontSize: 15,
  },
  bioInput: { minHeight: 110, textAlignVertical: 'top' },
  bioCounter: { fontSize: 11, color: colors.text2, textAlign: 'right', marginTop: 6 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
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
