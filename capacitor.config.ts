import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pockettrack.app",
  appName: "PocketTrack",
  webDir: "dist",
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F0F12",
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0F0F12",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
