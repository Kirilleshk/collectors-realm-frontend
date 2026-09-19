import { StyleSheet } from 'react-native'
import { colors } from '../../theme'

// Общие стили карты — были продублированы 1:1 в MapScreen.js и
// MapScreen.web.js (см. mapShared.js про причину выноса, 19.09.2026)
export const mapStyles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, gap: 12 },
  filtersWrap: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  filters: { paddingVertical: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: `${colors.accent}20`, borderColor: colors.accent },
  filterText: { fontSize: 13, color: colors.text2, fontWeight: '500' },
  filterTextActive: { color: colors.accent },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  nearbyLabel: { fontSize: 12, color: colors.text2, fontWeight: '600' },
  radiusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  radiusBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}20` },
  radiusText: { fontSize: 12, color: colors.text2, fontWeight: '600' },
  radiusTextActive: { color: colors.accent },
  radiusClear: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  radiusClearText: { fontSize: 11, color: colors.text2 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12, maxHeight: '80%' },
  cardScroll: { flexGrow: 0 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatar: { width: 60, height: 60, borderRadius: 16 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 16, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.blue },
  cardName: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardCity: { fontSize: 13, color: colors.text2, marginTop: 2 },
  cardDist: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  cardBio: { fontSize: 14, color: colors.text2, lineHeight: 20 },
  profileBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  profileBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  closeBtn: { backgroundColor: colors.surface2, borderRadius: 12, padding: 14, alignItems: 'center' },
  closeBtnText: { color: colors.text2, fontWeight: '600', fontSize: 15 },
})
