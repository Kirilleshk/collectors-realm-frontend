import React, { useEffect, useRef, useState } from 'react'
import { View, Image, ActivityIndicator, Platform, AppState } from 'react-native'
import { ShoppingBag, Map as MapIcon, Gamepad2, Settings, User, MessageCircle } from './src/icons'
import { NavigationContainer } from '@react-navigation/native'
import * as NavigationBar from 'expo-navigation-bar'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { AuthProvider, useAuth } from './src/AuthContext'
import { colors, getTabBarStyle } from './src/theme'
import * as Notifications from 'expo-notifications'
import OnboardingTour from './src/utils/OnboardingTour'
import LocationRequiredModal from './src/utils/LocationRequiredModal'
import { track } from './src/utils/analytics'
import { NoticeHost } from './src/utils/notice'
import { useUnreadCount } from './src/utils/unread'

import LoginScreen from './src/screens/LoginScreen'
import ShopScreen from './src/screens/ShopScreen'
import ProductDetailScreen from './src/screens/ProductDetailScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import ChatScreen from './src/screens/ChatScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import AdminScreen from './src/screens/AdminScreen'
import MapScreen from './src/screens/MapScreen'
import UserProfileScreen from './src/screens/UserProfileScreen'
import MyItemsScreen from './src/screens/MyItemsScreen'
import ReleasesScreen from './src/screens/ReleasesScreen'
import SellProductScreen from './src/screens/SellProductScreen'
import MessagesScreen from './src/screens/MessagesScreen'
import ConversationScreen from './src/screens/ConversationScreen'
import NotReadyScreen from './src/screens/NotReadyScreen'

// Флаг видимости карточной игры — поставить false, чтобы мгновенно скрыть вкладку.
// 20.10.2026: скрыта (раздел закрыт 13.10) — нижнее меню как на Авито.
// 23.10.2026: «Продать» из меню снова кнопкой «+» в магазине (просьба Марка
// 21.10) — Магазин · Карта · Сообщения · Моё · Профиль
const SHOW_GAME = false

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// «Моё» раньше показывал плейсхолдер-эмодзи 🗿 — теперь настоящий логотип
// (assets/logo-mark.png), рендерится отдельно от остальных вкладок в tabBarIcon ниже.
// 13.10.2026: эмодзи вкладок → линейные иконки Lucide — на разных устройствах
// эмодзи рисовались по-разному и не красились в цвета темы. Копия интерфейса
// до замены — git-тег ui-emoji-backup-2026-10-13.
const tabIcons = { Магазин: ShoppingBag, Карта: MapIcon, Сообщения: MessageCircle, Игра: Gamepad2, Админ: Settings, Профиль: User }

function ShopStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="ShopList" component={ShopScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Товар' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат с магазином' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen name="Releases" component={ReleasesScreen} options={{ title: 'Новости' }} />
      <Stack.Screen name="SellProduct" component={SellProductScreen} options={{ title: 'Новое объявление' }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Сообщения' }} />
      {/* Библиотека знаний приостановлена (решение Марка 20.09.2026) — вместо
          реального LibraryScreen зарегистрирована заглушка "в разработке"
          прямо на уровне роута (не перехват клика), см. NotReadyScreen.js */}
      <Stack.Screen
        name="Library"
        component={NotReadyScreen}
        options={{ title: 'Библиотека знаний' }}
        initialParams={{
          title: 'Библиотека знаний в разработке',
          text: 'Этот раздел пока не доделан — мы приостановили работу над ним, чтобы сосредоточиться на основном маркетплейсе. Скоро вернёмся к нему!',
        }}
      />
    </Stack.Navigator>
  )
}

// «Моё» — свой стек (20.10.2026): из «Мои объявления» карточка товара и форма
// правки открываются здесь же, и «назад» возвращает в список, а не в магазин.
// Имена роутов совпадают с ShopStack — ProductDetail/SellProduct навигируют
// по ним и находят ближайший стек.
function MyStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="MyItemsMain" component={MyItemsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Товар' }} />
      <Stack.Screen name="SellProduct" component={SellProductScreen} options={{ title: 'Новое объявление' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат с магазином' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Сообщения' }} />
    </Stack.Navigator>
  )
}

// «Сообщения» — переписки покупатель ↔ продавец (20.10.2026, этап 3 «как на
// Авито»). Из переписки можно открыть карточку товара — поэтому здесь те же
// роуты, что в ShopStack/MyStack
function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Сообщения' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Товар' }} />
      <Stack.Screen name="SellProduct" component={SellProductScreen} options={{ title: 'Новое объявление' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат с магазином' }} />
    </Stack.Navigator>
  )
}

function MapStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="MapMain" component={MapScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfileMap" component={UserProfileScreen} options={{ title: 'Профиль' }} />
    </Stack.Navigator>
  )
}

// Карточная игра приостановлена (решение Марка 20.09.2026) — вместо реальных
// GameScreen/LevelSelectScreen/BattleScreen зарегистрирована одна заглушка
// "в разработке" прямо на уровне роута, так что попасть внутрь нельзя никаким
// путём (сами экраны остаются в src/screens/, просто временно не подключены).
function GameStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="GameMain"
        component={NotReadyScreen}
        initialParams={{
          standalone: true,
          title: 'Карточная игра в разработке',
          text: 'Этот раздел пока не доделан — мы приостановили работу над ним, чтобы сосредоточиться на основном маркетплейсе. Скоро вернёмся к нему!',
        }}
      />
    </Stack.Navigator>
  )
}

function MainTabs() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('ANALYTICS') || user?.roles?.includes('MODERATOR')
  const unread = useUnreadCount(!!user)
  // Гость (21.10.2026, магазин без регистрации): смотреть магазин и товары
  // можно всем; разделы, где нужен аккаунт, — нажатие ведёт на вход. После
  // входа экран Login исчезает сам (он зарегистрирован только для гостя),
  // и человек остаётся там, где был.
  const authOnly = ({ navigation }) => ({
    tabPress: e => {
      if (user) return
      e.preventDefault()
      navigation.navigate('Login')
    },
  })
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color }) => {
        if (route.name === 'Моё') {
          return <Image source={require('./assets/logo-mark.png')} style={{ width: 22, height: 22, opacity: focused ? 1 : 0.5 }} resizeMode="contain" />
        }
        const Icon = tabIcons[route.name]
        return Icon ? <Icon size={22} color={color} strokeWidth={focused ? 2.2 : 1.8} /> : null
      },
      tabBarStyle: getTabBarStyle(insets),
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.text2,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    })}>
      <Tab.Screen name="Магазин" component={ShopStack} options={{ headerShown: false }} />
      <Tab.Screen name="Карта" component={MapStack} options={{ headerShown: false }} listeners={authOnly} />
      <Tab.Screen
        name="Сообщения"
        component={MessagesStack}
        listeners={authOnly}
        options={{
          headerShown: false,
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#fff', fontSize: 10, fontWeight: '800' },
        }}
      />
      <Tab.Screen name="Моё" component={MyStack} options={{ headerShown: false }} listeners={authOnly} />
      {SHOW_GAME && <Tab.Screen name="Игра" component={GameStack} options={{ headerShown: false }} />}
      {isAdmin && <Tab.Screen name="Админ" component={AdminScreen} options={{ headerShown: false }} />}
      <Tab.Screen name="Профиль" component={ProfileScreen} options={{ headerShown: false }} listeners={authOnly} />
    </Tab.Navigator>
  )
}

const navigationRef = React.createRef()

// Имя роута → ключ раздела в статистике. Ключи вкладок (Shop/Map/MyItems/
// Game/Profile) совпадают с тем, что писалось раньше из tab-listener'ов, —
// история не рвётся. Роуты не из списка пишутся как есть (ProductDetail,
// Chat, Notifications, Releases, Library, Login...).
const SCREEN_KEYS = {
  ShopList: 'Shop', MapMain: 'Map', 'Моё': 'MyItems', MyItemsMain: 'MyItems', MessagesList: 'Messages', GameMain: 'Game',
  'Профиль': 'Profile', 'Админ': 'Admin', UserProfileMap: 'UserProfile',
}

// Ссылка «Поделиться» на товар — markeltoys.ru/?p=<id> (21.10.2026). Через
// параметр, а не путь /product/<id>: GitHub Pages на неизвестный путь
// отдаёт 404, а на ?p= — обычную страницу. При открытии сайта по такой
// ссылке сразу показываем товар (гостю тоже) и убираем параметр из адреса,
// чтобы обновление страницы потом не открывало товар заново.
function openSharedProduct() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const id = new URLSearchParams(window.location.search).get('p')
  if (!id) return
  window.history.replaceState(null, '', window.location.pathname)
  navigationRef.current?.navigate('Main', {
    screen: 'Магазин',
    params: { screen: 'ProductDetail', params: { id }, initial: false },
  })
}

function RootNav() {
  const { user, loading } = useAuth()
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('ANALYTICS') || user?.roles?.includes('MODERATOR')
  const hasLocation = user?.latitude != null && user?.longitude != null
  const lastScreenRef = useRef(null)
  const openTrackedRef = useRef(false)

  // Раз за запуск, после восстановления сессии (чтобы событие ушло уже с
  // пользователем, если он залогинен) — считает всех, кто открыл сайт,
  // включая тех, кто ушёл с экрана входа, не зарегистрировавшись
  useEffect(() => {
    if (!loading && !openTrackedRef.current) {
      openTrackedRef.current = true
      track('app_open')
    }
  }, [loading])

  // Возврат в уже открытое приложение/вкладку (из фона, на другой день):
  // app_open шлётся раз за запуск, а переходов может и не быть — без этого
  // такой день не попадал ни в «Зашли», ни в «Возвращались». Не чаще раза в
  // 30 минут, чтобы переключения между приложениями не плодили события.
  useEffect(() => {
    let lastResume = Date.now()
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' || Date.now() - lastResume < 30 * 60 * 1000) return
      lastResume = Date.now()
      track('app_resume')
    })
    return () => sub.remove()
  }, [])

  // Просмотр раздела — на любой переход, по самому глубокому активному роуту.
  // Раньше считались только 4 вкладки: карточка товара, чат, чужие профили,
  // уведомления, анонсы и экран входа в статистику не попадали вовсе.
  // Сравниваем по key роута, а не по имени: переход с товара A на товар B —
  // тот же ProductDetail, но другой экран и новый просмотр.
  function trackScreen() {
    const route = navigationRef.current?.getCurrentRoute()
    if (!route || route.key === lastScreenRef.current) return
    lastScreenRef.current = route.key
    track('screen_view', { screen: SCREEN_KEYS[route.name] || route.name })
  }

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden')
      NavigationBar.setBehaviorAsync('overlay-swipe')
    }
  }, [])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.conversationId && navigationRef.current) {
        navigationRef.current.navigate('Сообщения', {
          screen: 'Conversation',
          params: { id: data.conversationId },
          initial: false,
        })
        return
      }
      if (data?.productId && navigationRef.current) {
        navigationRef.current.navigate('Магазин', {
          screen: 'ProductDetail',
          params: { id: data.productId },
        })
      }
    })
    return () => sub.remove()
  }, [])
  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  )
  return (
    <NavigationContainer ref={navigationRef} onReady={() => { trackScreen(); openSharedProduct() }} onStateChange={trackScreen}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Main — всем, Login — только гостю, поверх магазина (21.10.2026):
            раньше без входа сайт не показывал ничего, кроме формы входа */}
        <Stack.Screen name="Main" component={MainTabs} />
        {!user && <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal' }} />}
      </Stack.Navigator>
      {user && <LocationRequiredModal />}
      {user && hasLocation && (
        <OnboardingTour
          navigationRef={navigationRef}
          showGame={SHOW_GAME}
          isAdmin={isAdmin}
        />
      )}
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNav />
        </AuthProvider>
        <NoticeHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}