# Play Store release checklist

## Before first upload

### EAS project

```bash
cd artifacts/fitweek
npm install -g eas-cli   # or use npx
eas login
eas init                 # links project, adds extra.eas.projectId to app.json
```

### EAS secrets (production builds)

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR-SERVICE.run.app
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-anon-key
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value https://your-domain.com/privacy
eas secret:create --scope project --name EXPO_PUBLIC_TERMS_URL --value https://your-domain.com/terms
```

### Build

```bash
# Internal APK for quick device testing
pnpm run build:android:preview

# Play Store AAB
pnpm run build:android
```

### Submit

```bash
pnpm run submit:android
```

Default submit track is **internal** (see `eas.json`). Promote to production in Play Console after testing.

## Play Console setup

- [ ] Create app with package `com.fitweek.app`
- [ ] **Privacy policy URL** (required) — host publicly, set `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- [ ] **Terms of service URL** — set `EXPO_PUBLIC_TERMS_URL`
- [ ] Store listing: title, short/full description, screenshots, feature graphic
- [ ] **Data safety** form: location, photos, account info, notifications
- [ ] **Content rating** (IARC questionnaire)
- [ ] Target API level: verify against Expo SDK 54 defaults at build time

## Version bumps

Each Play Store upload requires a higher `android.versionCode` in `app.json`. Increment `version` (user-facing) and `versionCode` (integer) together.

## Internal testing flow

1. Deploy API to Cloud Run and confirm `GET /api/healthz` and `GET /api/readyz`
2. Build AAB with production profile
3. Upload to **Internal testing** track
4. Add testers in Play Console
5. Verify on device:
   - Google sign-in
   - Garment photo upload + classification
   - Weather forecast
   - Outfit planner + notifications permission
   - VTO (long-running; needs stable network)

## Common issues

| Symptom | Fix |
|---------|-----|
| API calls fail on device | `EXPO_PUBLIC_API_BASE_URL` not set in EAS secrets |
| Google sign-in fails on release build | Add Android OAuth client with release SHA-1 |
| Supabase auth redirect error | Add `fitweek://auth/callback` in Supabase redirect URLs |
| Play rejects missing privacy policy | Set URL in Console and in app env vars |
