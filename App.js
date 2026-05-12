import React, { useEffect } from 'react'
import { View, Text, ActivityIndicator, Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import * as NavigationBar from 'expo-navigation-bar'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from './src/AuthContext'
import { colors } from './src/theme'
import * as Notifications from 'expo-notifications'

import LoginScreen from './src/screens/LoginScreen'
import ShopScreen from './src/screens/ShopScreen'
import ProductDetailScreen from './src/screens/ProductDetailScreen'
import WishlistScreen from './src/screens/WishlistScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import ChatScreen from './src/screens/ChatScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import AdminScreen from './src/screens/AdminScreen'
import MapScreen from './src/screens/MapScreen'
import UserProfileScreen from './src/screens/UserProfileScreen'
import CollectionScreen from './src/screens/CollectionScreen'
import ReleasesScreen from './src/screens/ReleasesScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const tabIcons = { Магазин: '🛍', Карта: '🗺', Коллекция: '🗿', Вишлист: '🎯', Админ: '⚙️', Профиль: '👤' }

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

function MainTabs() {
  const insets = useSafeAreaInsets()
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarIcon: ({ focused }) => (
        <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{tabIcons[route.name]}</Text>
      ),
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        height: 60 + insets.bottom,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.text2,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    })}>
      <Tab.Screen name="Магазин" component={ShopStack} options={{ headerShown: false }} />
      <Tab.Screen name="Карта" component={MapStack} options={{ headerShown: false }} />
      <Tab.Screen name="Коллекция" component={CollectionScreen} />
      <Tab.Screen name="Вишлист" component={WishlistScreen} />
      <Tab.Screen name="Админ" component={AdminScreen} />
      <Tab.Screen name="Профиль" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

const navigationRef = React.createRef()

function RootNav() {
  const { user, loading } = useAuth()

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
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNav />
      </AuthProvider>
    </SafeAreaProvider>
  )
}