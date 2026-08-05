import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { library } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

// Бэкенд размечает статью на разделы строкой "## Заголовок" (не настоящий
// markdown, просто простой парсимый маркер, см. library.service.ts) — по
// просьбе Марка каждый раздел должен идти с жирным подзаголовком, чтобы
// статью можно было скроллить и читать только интересующее. Старые статьи
// (сгенерированные до этого формата) не содержат "## " вообще — тогда весь
// текст попадает в один раздел без заголовка, рендерится как раньше.
function parseArticleSections(content) {
  const lines = content.split('\n')
  const sections = []
  let current = { title: null, paragraphs: [] }
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      if (current.title || current.paragraphs.length) sections.push(current)
      current = { title: match[1].trim(), paragraphs: [] }
    } else if (line.trim()) {
      current.paragraphs.push(line.trim())
    }
  }
  if (current.title || current.paragraphs.length) sections.push(current)
  return sections
}

// Ограничиваем итоговое соотношение сторон, чтобы совсем панорамные или
// совсем вытянутые кадры не ломали вёрстку шапки статьи, но внутри этого
// диапазона высота ВСЕГДА подстраивается под реальную картинку — без этого
// фиксированная высота 220px обрезала сверху/снизу почти любое портретное
// фото персонажа (жалоба Марка 03.08, на примере статьи про Аладдина)
const IMAGE_MIN_RATIO = 0.62 // высокий портрет
const IMAGE_MAX_RATIO = 1.9  // широкий кадр

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [article, setArticle] = useState(null)
  const [recent, setRecent] = useState([])
  const [imageRatio, setImageRatio] = useState(null)
  // Автодополнение по мере ввода (Марк, 05.08: "Ба..." → Барт Симпсон,
  // Бакуго...) — только уже существующие в библиотеке персонажи, без
  // обращения к ИИ. Дебаунс, чтобы не слать запрос на каждую букву.
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef(null)

  useEffect(() => { loadRecent() }, [])

  useEffect(() => {
    clearTimeout(suggestTimer.current)
    const q = query.trim()
    if (q.length < 2) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await library.getSuggestions(q)
        setSuggestions(Array.isArray(res.data) ? res.data : [])
        setShowSuggestions(true)
      } catch (e) { /* автодополнение не критично, тихо пропускаем */ }
    }, 250)
    return () => clearTimeout(suggestTimer.current)
  }, [query])

  useEffect(() => {
    if (!article?.imageUrl) { setImageRatio(null); return }
    let cancelled = false
    Image.getSize(
      article.imageUrl,
      (w, h) => { if (!cancelled && h > 0) setImageRatio(w / h) },
      () => { if (!cancelled) setImageRatio(null) }
    )
    return () => { cancelled = true }
  }, [article?.imageUrl])

  async function loadRecent() {
    try {
      const res = await library.getRecent()
      setRecent(Array.isArray(res.data) ? res.data : [])
    } catch (e) { /* лента не критична, тихо пропускаем */ }
  }

  async function onSearch(name) {
    const q = (name ?? query).trim()
    if (!q) return
    setQuery(q)
    setShowSuggestions(false)
    setLoading(true)
    setError(null)
    setArticle(null)
    try {
      const res = await library.getArticle(q)
      setArticle(res.data)
      loadRecent()
    } catch (e) {
      setError(e?.response?.data?.error || 'Не удалось найти статью. Попробуйте ещё раз.')
    }
    setLoading(false)
  }

  return (
    <ScreenBackground style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>📖 Библиотека</Text>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Найдите персонажа, о котором хотите прочитать..."
          placeholderTextColor={colors.text2}
          onSubmitEditing={() => onSearch()}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.searchBtn} onPress={() => onSearch()} disabled={loading || !query.trim()}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.searchBtnText}>🔍</Text>}
        </TouchableOpacity>
      </View>

      {/* Дропдаун автодополнения — обычный поток (не absolute), поэтому
          просто отодвигает контент под собой, без z-index/оверлеев */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={s.suggestDropdown}>
          {suggestions.map((name, i) => (
            <TouchableOpacity
              key={`${name}-${i}`}
              style={[s.suggestItem, i === suggestions.length - 1 && s.suggestItemLast]}
              onPress={() => onSearch(name)}
            >
              <Text style={s.suggestItemText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView style={s.body} contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
        {!article && !loading && !error && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📚</Text>
            <Text style={s.emptyTitle}>Энциклопедия гик-культуры</Text>
            <Text style={s.emptySub}>Введите имя персонажа из комиксов, фильмов, игр или аниме — статья о нём сгенерируется автоматически</Text>

            {recent.length > 0 && (
              <View style={s.recentWrap}>
                <Text style={s.recentTitle}>Недавно искали</Text>
                <View style={s.recentChips}>
                  {recent.map((name, i) => (
                    <TouchableOpacity key={`${name}-${i}`} style={s.recentChip} onPress={() => onSearch(name)}>
                      <Text style={s.recentChipText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {loading && (
          <View style={s.empty}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={s.emptySub}>Пишем статью, это может занять несколько секунд...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>⚠️</Text>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        )}

        {article && !loading && (
          <View style={s.article}>
            {/* Картинка персонажа — реальный кадр/постер из Wikipedia
                (best-effort, найден по подписи через generateCharacterArticle
                → findCharacterImageUrl, см. library.service.ts на бэкенде).
                Не всегда находится (старые статьи без картинки, редкие
                персонажи) — тогда просто не показываем блок вообще. */}
            {article.imageUrl ? (
              <Image
                source={{ uri: article.imageUrl }}
                style={[
                  s.articleImage,
                  imageRatio ? { height: undefined, aspectRatio: Math.min(Math.max(imageRatio, IMAGE_MIN_RATIO), IMAGE_MAX_RATIO) } : null,
                ]}
                resizeMode="cover"
              />
            ) : null}
            <Text style={s.articleName}>{article.characterName}</Text>
            {article.universe ? <Text style={s.articleUniverse}>{article.universe}</Text> : null}
            {parseArticleSections(article.content).map((section, i) => (
              <View key={i} style={s.section}>
                {section.title ? <Text style={s.sectionTitle}>{section.title}</Text> : null}
                {section.paragraphs.map((p, j) => (
                  <Text key={j} style={s.articleContent}>{p}</Text>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  backText: { color: colors.text, fontSize: 22 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 10 : 4,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 },
  suggestDropdown: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 16, marginTop: -4, marginBottom: 8,
    overflow: 'hidden',
  },
  suggestItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestItemLast: { borderBottomWidth: 0 },
  suggestItemText: { fontSize: 14, color: colors.text },
  searchBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 16 },
  body: { flex: 1 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  recentWrap: { width: '100%', marginTop: 16, gap: 10 },
  recentTitle: { fontSize: 12, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  recentChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  recentChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  article: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 6 },
  articleImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 10, backgroundColor: colors.surface2 },
  articleName: { fontSize: 20, fontWeight: '800', color: colors.text },
  articleUniverse: { fontSize: 13, fontWeight: '600', color: colors.accent, marginBottom: 8 },
  section: { marginTop: 14, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.accent, marginBottom: 2 },
  articleContent: { fontSize: 15, color: colors.text, lineHeight: 23 },
})
