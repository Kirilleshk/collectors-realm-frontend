import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { library } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [article, setArticle] = useState(null)

  async function onSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setArticle(null)
    try {
      const res = await library.getArticle(q)
      setArticle(res.data)
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
          placeholder="Найдите персонажа, о котором хотите прочитать..."
          placeholderTextColor={colors.text2}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.searchBtn} onPress={onSearch} disabled={loading || !query.trim()}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.searchBtnText}>🔍</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
        {!article && !loading && !error && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📚</Text>
            <Text style={s.emptyTitle}>Энциклопедия гик-культуры</Text>
            <Text style={s.emptySub}>Введите имя персонажа из комиксов, фильмов, игр или аниме — статья о нём сгенерируется автоматически</Text>
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
            <Text style={s.articleName}>{article.characterName}</Text>
            {article.universe ? <Text style={s.articleUniverse}>{article.universe}</Text> : null}
            <Text style={s.articleContent}>{article.content}</Text>
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
  searchBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 16 },
  body: { flex: 1 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  article: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 6 },
  articleName: { fontSize: 20, fontWeight: '800', color: colors.text },
  articleUniverse: { fontSize: 13, fontWeight: '600', color: colors.accent, marginBottom: 8 },
  articleContent: { fontSize: 15, color: colors.text, lineHeight: 23 },
})
