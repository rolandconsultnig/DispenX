/**
 * RN 0.74 / Expo prebuild pins NDK 26.1.x in the root buildscript; with some SDK installs
 * prefab then resolves ReactAndroid/fabricjni as minSdk 22 and CMake fails (CXX1214).
 * Aligns the root project with android.ndkVersion from gradle.properties / expo-build-properties.
 */
const { withProjectBuildGradle } = require("expo/config-plugins");

const MARKER = "// [energydispenx] ndk prefab fix";
const NDK_OVERRIDE =
  'ext.ndkVersion = findProperty("android.ndkVersion") ?: "27.3.13750724"';

function withAndroidNdkPrefabFix(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      return cfg;
    }
    contents = contents.replace(
      /ndkVersion\s*=\s*["']26\.1\.10909125["']/g,
      'ndkVersion = findProperty("android.ndkVersion") ?: "27.3.13750724"'
    );
    const needle = 'apply plugin: "com.facebook.react.rootproject"';
    if (contents.includes(needle) && !contents.includes(NDK_OVERRIDE)) {
      contents = contents.replace(
        needle,
        `${needle}\n\n${MARKER}\n${NDK_OVERRIDE}`
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withAndroidNdkPrefabFix;
