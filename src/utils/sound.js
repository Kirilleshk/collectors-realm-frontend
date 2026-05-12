import { Audio } from 'expo-av'
import { Platform } from 'react-native'

let _sound = null

export async function playBeep() {
  try {
    if (Platform.OS === 'ios') {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
    }
    if (_sound) {
      await _sound.unloadAsync()
      _sound = null
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/beep.wav'),
      { shouldPlay: true, volume: 0.6 }
    )
    _sound = sound
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) {
        sound.unloadAsync()
        _sound = null
      }
    })
  } catch (_) {}
}
