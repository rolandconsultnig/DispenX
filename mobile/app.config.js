// Merges with app.json. Patches android root build.gradle so prefab/CMake see a library minSdk
// >= ReactAndroid prefab (23): root ext + force all com.android.library defaultConfig.
const { withDangerousMod } = require('expo/config-plugins');

const MARKER_EXT = '// [expo] rootProject ext sync for prefab/CMake';
const MARKER_SUB = '// [expo] force library minSdk for prefab/CMake';

const SUBPROJECTS_BLOCK = `

${MARKER_SUB}
subprojects { sub ->
    sub.plugins.withId("com.android.library") {
        sub.android.defaultConfig.minSdkVersion rootProject.ext.minSdkVersion
    }
}
`;

function patchRootBuildGradle(contents) {
  let s = contents;
  const needle = 'apply plugin: "com.facebook.react.rootproject"';
  if (!s.includes(needle)) {
    return s;
  }

  if (!s.includes(MARKER_EXT)) {
    const extBlock = `${needle}

${MARKER_EXT}
ext {
    minSdkVersion = Integer.parseInt(findProperty("android.minSdkVersion") ?: "24")
    compileSdkVersion = Integer.parseInt(findProperty("android.compileSdkVersion") ?: "34")
    targetSdkVersion = Integer.parseInt(findProperty("android.targetSdkVersion") ?: "34")
}
`;
    s = s.replace(needle, extBlock);
  }

  if (!s.includes(MARKER_SUB)) {
    s = s.trimEnd() + SUBPROJECTS_BLOCK;
  }

  return s;
}

function withRootProjectExtSync(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const fs = require('fs');
      const path = require('path');
      const fp = path.join(cfg.modRequest.platformProjectRoot, 'build.gradle');
      const before = await fs.promises.readFile(fp, 'utf8');
      const after = patchRootBuildGradle(before);
      if (after !== before) {
        await fs.promises.writeFile(fp, after);
      }
      return cfg;
    },
  ]);
}

module.exports = ({ config }) => withRootProjectExtSync(config);
