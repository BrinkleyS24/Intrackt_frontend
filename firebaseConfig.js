const REQUIRED_FIREBASE_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

const RAW_FIREBASE_ENV = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

function readEnvValue(key) {
  const value = RAW_FIREBASE_ENV[key];
  return typeof value === 'string' ? value.trim() : value;
}

export const firebaseConfig = {
  apiKey: readEnvValue('apiKey'),
  authDomain: readEnvValue('authDomain'),
  projectId: readEnvValue('projectId'),
  storageBucket: readEnvValue('storageBucket'),
  messagingSenderId: readEnvValue('messagingSenderId'),
  appId: readEnvValue('appId'),
  measurementId: readEnvValue('measurementId'),
};

export const missingFirebaseConfigKeys = REQUIRED_FIREBASE_CONFIG_KEYS.filter((key) => !firebaseConfig[key]);
export const firebaseConfigIsComplete = missingFirebaseConfigKeys.length === 0;

if (!firebaseConfigIsComplete) {
  const message = `[extension][config] Missing Firebase config keys: ${missingFirebaseConfigKeys.join(', ')}`;
  if (process.env?.EXTENSION_BUILD_TARGET === 'production') {
    throw new Error(message);
  }
  console.warn(message);
}
