import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iliasnizamutdinov.wolfandeggs',
  appName: 'Wolf and Eggs',
  webDir: 'dist-phone',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
