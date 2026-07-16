import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import * as NavigationBar from 'expo-navigation-bar'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { AuthProvider, useAuth } from './src/AuthContext'
import { colors, getTabBarStyle } from './src/theme'
import * as Notifications from 'expo-notifications'
import WhatsNewModal from './src/utils/WhatsNewModal'
import OnboardingTour from './src/utils/OnboardingTour'
import LocationRequiredModal from './src/utils/LocationRequiredModal'
import { setAnalyticsUser, track } from './src/utils/analytics'

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
import GameScreen from './src/screens/GameScreen'
import BattleScreen from './src/screens/BattleScreen'

// Флаг видимости карточной игры — поставить false, чтобы мгновенно скрыть вкладку
const SHOW_GAME = true

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const tabIcons = { Магазин: '🛍', Карта: '🗺', Моё: '🗿', Игра: '🎮', Админ: '⚙️', Профиль: '👤' }

function ShopStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="ShopList" component={ShopScreen} options={{ title: 'Магазин' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Товар' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат с продавцом' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen name="Releases" component={ReleasesScreen} options={{ title: 'Анонсы' }} />
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
      <Stack.Screen name="MapMain" component={MapScreen} options={{ title: 'Карта' }} />
      <Stack.Screen name="UserProfileMap" component={UserProfileScreen} options={{ title: 'Профиль' }} />
    </Stack.Navigator>
  )
}

function GameStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="GameMain" component={GameScreen} options={{ title: 'Игра' }} />
      <Stack.Screen name="Battle" component={BattleScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}

function MainTabs() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('ANALYTICS') || user?.roles?.includes('MODERATOR')
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarIcon: ({ focused }) => (
        <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{tabIcons[route.name]}</Text>
      ),
      tabBarStyle: getTabBarStyle(insets),
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.text2,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    })}>
      <Tab.Screen name="Магазин" component={ShopStack} options={{ headerShown: false }} listeners={{ focus: () => track('screen_view', { screen: 'Shop' }) }} />
      <Tab.Screen name="Карта" component={MapStack} options={{ headerShown: false }} listeners={{ focus: () => track('screen_view', { screen: 'Map' }) }} />
      <Tab.Screen name="Моё" component={MyItemsScreen} options={{ headerShown: false }} listeners={{ focus: () => track('screen_view', { screen: 'MyItems' }) }} />
      {SHOW_GAME && <Tab.Screen name="Игра" component={GameStack} options={{ headerShown: false }} listeners={{ focus: () => track('screen_view', { screen: 'Game' }) }} />}
      {isAdmin && <Tab.Screen name="Админ" component={AdminScreen} />}
      <Tab.Screen name="Профиль" component={ProfileScreen} listeners={{ focus: () => track('screen_view', { screen: 'Profile' }) }} />
    </Tab.Navigator>
  )
}

const navigationRef = React.createRef()

function RootNav() {
  const { user, loading } = useAuth()
  const [tourDone, setTourDone] = useState(false)
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('ANALYTICS') || user?.roles?.includes('MODERATOR')
  const hasLocation = user?.latitude != null && user?.longitude != null

  useEffect(() => {
    if (user?.id) setAnalyticsUser(user.id)
  }, [user?.id])

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden')
      NavigationBar.setBehaviorAsync('overlay-swipe')
    }
  }, [])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
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
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
      {user && <LocationRequiredModal />}
      {user && hasLocation && (
        <OnboardingTour
          navigationRef={navigationRef}
          showGame={SHOW_GAME}
          isAdmin={isAdmin}
          onFinish={() => setTourDone(true)}
        />
      )}
      {user && hasLocation && tourDone && <WhatsNewModal />}
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}