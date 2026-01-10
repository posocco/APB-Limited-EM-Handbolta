// CAPACITOR MOBILE FEATURES
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

// Initialize Capacitor plugins
async function initCapacitor() {
  try {
    // Status bar configuration
    if (window.Capacitor?.getPlatform() !== 'web') {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#667eea' });
    }
    
    // Request notification permissions
    if (window.Capacitor?.getPlatform() !== 'web') {
      await LocalNotifications.requestPermissions();
    }
    
    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && activeLeagueId) {
        loadAllLeagueData();
        checkUpcomingGames();
      }
    });
    
    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
    
    console.log('✅ Capacitor plugins initialized');
  } catch (error) {
    console.error('Capacitor initialization error:', error);
  }
}

// Haptic feedback helper
function vibrate(style = ImpactStyle.Medium) {
  if (window.Capacitor?.getPlatform() !== 'web') {
    Haptics.impact({ style });
  }
}

// Enhanced notification for mobile
async function sendMobileNotification(title, body) {
  if (window.Capacitor?.getPlatform() !== 'web') {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: title,
          body: body,
          id: Math.floor(Math.random() * 100000),
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#667eea'
        }]
      });
    } catch (error) {
      console.error('Mobile notification error:', error);
    }
  } else {
    sendNotification(title, body);
  }
}

// Share functionality
async function shareLeague(leagueCode, leagueName) {
  if (window.Capacitor?.getPlatform() !== 'web') {
    try {
      await Share.share({
        title: 'Ganga í APB Tippspil deild',
        text: `Ganstu í deildina "${leagueName}"! Kóði: ${leagueCode}`,
        dialogTitle: 'Deila deild'
      });
      vibrate(ImpactStyle.Light);
    } catch (error) {
      console.error('Share error:', error);
    }
  } else {
    // Fallback for web
    navigator.clipboard.writeText(leagueCode);
    alert(`Kóði afritaður: ${leagueCode}`);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  if (window.Capacitor) {
    initCapacitor();
  }
});

// REST OF ORIGINAL CODE FROM app.js GOES HERE
// (Þú getur afritað allan app.js kóðann hér fyrir neðan)
