export const colors = {
  bg: '#0a0b0e',
  surface: '#13141a',
  surface2: '#1a1b22',
  border: '#252730',
  text: '#e8e5dc',
  text2: '#8a8794',
  accent: '#e04e28',
  blue: '#2e7fd6',
  green: '#2aaa60',
  red: '#e5484d',
  purple: '#8b4fd4',
  silver: '#b9bdc6',
  gold: '#e0b144',
}

// Единый источник стиля нижнего таб-бара — используется и в screenOptions
// MainTabs, и для восстановления после того, как BattleScreen его прячет
// (см. useFocusEffect в BattleScreen.js). Возврат просто `undefined` не
// откатывает к стилю из screenOptions (react-navigation мёржит undefined
// как собственное свойство), поэтому нужен явный объект для отката.
export function getTabBarStyle(insets) {
  return {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 60 + insets.bottom,
    paddingBottom: Math.max(insets.bottom, 8),
    paddingTop: 8,
  }
}
