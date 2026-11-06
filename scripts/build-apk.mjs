import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) {
  console.error('ANDROID_HOME is not set. Install the Android SDK and point ANDROID_HOME at it.');
  process.exit(1);
}

const javaHome = process.env.JAVA_HOME || '/usr/lib/jvm/java-21-openjdk-amd64';
writeFileSync(join(root, 'android', 'local.properties'), `sdk.dir=${sdk.replaceAll('\\', '\\\\')}\n`);

const gradle = spawnSync('./gradlew', ['assembleDebug'], {
  cwd: join(root, 'android'),
  stdio: 'inherit',
  env: { ...process.env, ANDROID_HOME: sdk, JAVA_HOME: javaHome },
});
if (gradle.status !== 0) process.exit(gradle.status ?? 1);

const built = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', 'wolf-and-eggs.apk');
copyFileSync(built, out);
console.log(`apk: ${out}`);
