import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Linking, Modal, TextInput, Alert } from 'react-native'
import { colors } from '../theme'
import { reviews as reviewsApi } from '../api'
import { useAuth } from '../AuthContext'
import ScreenBackground from '../components/ScreenBackground'

const API = 'https://collectors-realm-backend.onrender.com/api'

const roleMap = {
  COLLECTOR:    { label: 'Коллекционер',      color: colors.blue,   icon: '🗿' },
  MASTER_REPAIR:{ label: 'Мастер по ремонту', color: colors.accent, icon: '🔧' },
  CUSTOMIZER:   { label: 'Кастомизатор',      color: colors.purple, icon: '🎨' },
  DIORAMA:      { label: 'Мастер диорам',     color: colors.green,  icon: '🏔' },
}

const BADGE_CONFIG = {
  SHOP:    { icon: '🏪', label: 'Магазин', bg: '#FF970015', border: '#FF970060', text: '#FF9700' },
  BLOGGER: { icon: '✅', label: 'Блогер',  bg: '#007AFF15', border: '#007AFF60', text: '#007AFF' },
}

function Stars({ rating, size = 16, onPress }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity key={i} onPress={() => onPress?.(i)} disabled={!onPress}>
          <Text style={{ fontSize: size, color: i <= Math.round(rating) ? '#FFB800' : colors.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params
  const { user: me, token } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewData, setReviewData] = useState({ reviews: [], avgRating: null, count: 0 })
  const [reviewModal, setReviewModal] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  const isMe = me?.id === userId

  useEffect(() => { load() }, [userId])

  async function load() {
    try {
      const [userRes, revRes] = await Promise.all([
        fetch(`${API}/users/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.json()),
        reviewsApi.getForUser(userId),
      ])
      setUser(userRes)
      setReviewData(revRes.data)
      const myRev = revRes.data.reviews?.find(r => r.fromUserId === me?.id)
      if (myRev) { setMyRating(myRev.rating); setMyComment(myRev.comment || '') }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSaveReview() {
    if (!myRating) { Alert.alert('Выберите оценку'); return }
    setSavingReview(true)
    try {
      await reviewsApi.create(userId, { rating: myRating, comment: myComment.trim() || undefined })
      setReviewModal(false)
      await load()
    } catch (e) { Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось сохранить') }
    setSavingReview(false)
  }

  async function handleDeleteReview() {
    Alert.alert('Удалить отзыв?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await reviewsApi.remove(userId).catch(() => {})
        setMyRating(0); setMyComment('')
        await load()
      }},
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  if (!user) return <View style={s.center}><Text style={{ color: colors.text2 }}>Пользователь не найден</Text></View>

  const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const badgeCfg = BADGE_CONFIG[user.badge]
  const alreadyReviewed = reviewData.reviews?.some(r => r.fromUserId === me?.id)

  return (
    <ScreenBackground>
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      {/* Шапка */}
      <View style={s.header}>
        {user.avatarUrl
          ? <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
          : <View style={s.avatarPlaceholder}><Text style={s.avatarText}>{initials}</Text></View>
        }

        <Text style={s.name}>{user.name}</Text>

        {badgeCfg && (
          <View style={[s.badgePill, { backgroundColor: badgeCfg.bg, borderColor: badgeCfg.border }]}>
            <Text style={[s.badgePillText, { color: badgeCfg.text }]}>{badgeCfg.icon} {badgeCfg.label}</Text>
          </View>
        )}

        {/* Рейтинг */}
        {reviewData.count > 0 ? (
          <View style={s.ratingRow}>
            <Stars rating={reviewData.avgRating} size={18} />
            <Text style={s.ratingText}>{reviewData.avgRating?.toFixed(1)} · {reviewData.count} {reviewData.count === 1 ? 'отзыв' : reviewData.count < 5 ? 'отзыва' : 'отзывов'}</Text>
          </View>
        ) : (
          <Text style={s.noRating}>Нет отзывов</Text>
        )}

        {user.city ? <Text style={s.city}>📍 {user.city}</Text> : null}

        <View style={s.roles}>
          {(user.roles || []).map(r => {
            const role = roleMap[r]
            return role ? (
              <View key={r} style={[s.roleBadge, { backgroundColor: `${role.color}25`, borderColor: `${role.color}50` }]}>
                <Text style={s.roleIcon}>{role.icon}</Text>
                <Text style={[s.roleText, { color: role.color }]}>{role.label}</Text>
              </View>
            ) : null
          })}
        </View>
      </View>

      {/* О себе */}
      {user.bio ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>О себе</Text>
          <Text style={s.bio}>{user.bio}</Text>
        </View>
      ) : null}

      {/* Портфолио */}
      {user.portfolioPhotos?.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Портфолио ({user.portfolioPhotos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {user.portfolioPhotos.map((photo, i) => (
                <Image key={i} source={{ uri: photo.url }} style={s.portfolioImg} resizeMode="cover" />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Отзывы */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Отзывы ({reviewData.count})</Text>
          {!isMe && (
            <TouchableOpacity onPress={() => setReviewModal(true)} style={s.leaveReviewBtn}>
              <Text style={s.leaveReviewText}>{alreadyReviewed ? '✏️ Изменить' : '+ Оставить'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {reviewData.reviews?.length === 0 ? (
          <Text style={s.noReviewsText}>Пока нет отзывов</Text>
        ) : reviewData.reviews.map(r => (
          <View key={r.id} style={s.reviewCard}>
            <View style={s.reviewHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {r.fromUser?.avatarUrl
                  ? <Image source={{ uri: r.fromUser.avatarUrl }} style={s.reviewAvatar} />
                  : <View style={s.reviewAvatarPlaceholder}><Text style={{ fontSize: 12, color: colors.blue, fontWeight: '700' }}>{(r.fromUser?.name || '?')[0]}</Text></View>
                }
                <View>
                  <Text style={s.reviewName}>{r.fromUser?.name || 'Пользователь'}</Text>
                  <Text style={s.reviewDate}>{new Date(r.createdAt).toLocaleDateString('ru')}</Text>
                </View>
              </View>
              <Stars rating={r.rating} size={14} />
            </View>
            {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
            {r.fromUserId === me?.id && (
              <TouchableOpacity onPress={handleDeleteReview} style={s.deleteReviewBtn}>
                <Text style={s.deleteReviewText}>Удалить мой отзыв</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Связаться — будет внутренний чат (задача в бэклоге) */}

      <View style={{ height: 32 }} />

      {/* Модал оценки */}
      <Modal visible={reviewModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{alreadyReviewed ? 'Изменить отзыв' : 'Оставить отзыв'}</Text>
            <Text style={s.modalSub}>{user.name}</Text>

            <View style={s.starsRow}>
              <Stars rating={myRating} size={36} onPress={setMyRating} />
            </View>
            <Text style={s.starsHint}>
              {myRating === 1 ? 'Очень плохо' : myRating === 2 ? 'Плохо' : myRating === 3 ? 'Нормально' : myRating === 4 ? 'Хорошо' : myRating === 5 ? 'Отлично!' : 'Нажмите на звезду'}
            </Text>

            <TextInput
              style={s.commentInput}
              value={myComment}
              onChangeText={setMyComment}
              placeholder="Комментарий (необязательно)"
              placeholderTextColor={colors.text2}
              multiline
              maxLength={500}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setReviewModal(false)}>
                <Text style={s.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveReview} disabled={savingReview}>
                {savingReview ? <ActivityIndicator color="white" size="small" /> : <Text style={s.saveText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 90, height: 90, borderRadius: 24, marginBottom: 16 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 24, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: `${colors.blue}60`, marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.blue },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 8 },
  badgePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  badgePillText: { fontSize: 12, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ratingText: { fontSize: 14, color: colors.text2, fontWeight: '600' },
  noRating: { fontSize: 13, color: colors.text2, marginBottom: 8 },
  city: { fontSize: 13, color: colors.text2, marginBottom: 12 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  roleIcon: { fontSize: 14 },
  roleText: { fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5 },
  leaveReviewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.accent },
  leaveReviewText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  bio: { fontSize: 15, color: colors.text, lineHeight: 22 },
  portfolioImg: { width: 120, height: 120, borderRadius: 12 },
  noReviewsText: { fontSize: 14, color: colors.text2, fontStyle: 'italic' },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 8 },
  reviewAvatarPlaceholder: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${colors.blue}25`, justifyContent: 'center', alignItems: 'center' },
  reviewName: { fontSize: 13, fontWeight: '600', color: colors.text },
  reviewDate: { fontSize: 11, color: colors.text2 },
  reviewComment: { fontSize: 13, color: colors.text, lineHeight: 19 },
  deleteReviewBtn: { marginTop: 8 },
  deleteReviewText: { fontSize: 11, color: '#FF3B30' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#229ED9', borderRadius: 14, padding: 16 },
  contactBtnIcon: { fontSize: 20 },
  contactBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderTopWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: colors.text2, marginBottom: 20 },
  starsRow: { alignItems: 'center', marginBottom: 8 },
  starsHint: { textAlign: 'center', fontSize: 13, color: colors.text2, marginBottom: 16, minHeight: 18 },
  commentInput: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, height: 90, textAlignVertical: 'top', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
  saveText: { color: 'white', fontSize: 15, fontWeight: '600' },
})
