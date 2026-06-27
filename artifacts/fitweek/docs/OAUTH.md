# Google OAuth — FitWeek Android

Setup for Google sign-in on standalone Android builds (EAS / Play Store).

## 1. Supabase redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**, add:

| URL | Use |
|-----|-----|
| `fitweek://auth/callback` | Production standalone app |
| `exp://**` | Expo Go development (wildcard) |

## 2. Google Cloud OAuth clients

In **Google Cloud Console → APIs & Services → Credentials**:

### Web client (for Supabase)

Supabase Google provider uses the **Web application** client ID and secret configured in the Supabase dashboard. This is unchanged from development.

### Android client (required for native Google sign-in)

Create an **Android** OAuth 2.0 client:

- **Package name:** `com.fitweek.app`
- **SHA-1 certificate fingerprint:** from your release keystore

Get the SHA-1 from EAS after your first build:

```bash
cd artifacts/fitweek
eas credentials -p android
```

Or from a local keystore:

```bash
keytool -list -v -keystore your-release.keystore -alias your-alias
```

Add the same SHA-1 to Firebase/Google if you use Firebase Auth helpers (optional for Supabase-only flow).

## 3. App code

- Scheme `fitweek` is set in `app.json`
- Native redirect: `fitweek://auth/callback` via `Linking.createURL` in `lib/authAdapters.ts`
- `WebBrowser.maybeCompleteAuthSession()` is called in `app/_layout.tsx` for Android OAuth completion

## 4. Testing checklist

- [ ] Sign in with Google on internal testing build (not Expo Go)
- [ ] Sign out and sign in again
- [ ] Password reset email flow (if using email auth)
- [ ] Session persists across app restarts
