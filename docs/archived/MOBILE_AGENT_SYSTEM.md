# EstimatePro Mobile - Agent System

Bu dokuman, mobil uygulama gelistirme surecinin ajanlar ile kesintisiz yonetimi icin operasyon modelidir.
Web projesindeki `AGENT_SYSTEM.md` ile paralel calisir.

## 1) Amac

- Tum mobil uygulama gorevlerini ajana atanabilir gorevler halinde yonetmek
- Web projesiyle %100 senkronize kalmak
- Her ajana otomatik "siradaki gorev" vermek
- Gorev tamamlandikca bir sonraki gorevi otomatik aktive etmek
- Mobil tracker bitene kadar operasyonu durdurmadan ilerletmek

## 2) Sistem Bilesenleri

- Backlog kaynagi: `agent-ops/mobile-agent-backlog.json`
- Orkestrator CLI: `scripts/mobile-agent-orchestrator.mjs`
- Canli gorev raporu: `agent-ops/mobile-agent-next-tasks.md`
- Ana mobil takibi: `MOBILE_APP_TRACKER.md`
- Mobil mimari: `MOBILE_ARCHITECTURE.md`
- Mobil kurallar: `MOBILE_CLAUDE.md`

## 3) Roller

### Mobil Takimi
| Agent | Expertise | Owned Directories |
|-------|-----------|-------------------|
| Agent-M1 | Mobile Core, Navigation, State, Offline, API Client | `apps/mobile/src/navigation/`, `apps/mobile/src/stores/`, `apps/mobile/src/services/`, `apps/mobile/src/hooks/` |
| Agent-M2 | Mobile UI, Components, Screens, Animations, Design System | `apps/mobile/src/components/`, `apps/mobile/src/screens/`, `apps/mobile/src/theme/` |
| Agent-M3 | Mobile Native, Push, Biometric, E2E, Build/Release, Platform Features | `apps/mobile/src/native/`, `apps/mobile/src/push/`, `apps/mobile/e2e/`, `apps/mobile/eas.json` |

### Paylasimli Roller (Web Takimi ile Ortak)
| Agent | Expertise | Mobile Interaction |
|-------|-----------|-------------------|
| Agent-A | Backend API | Yeni mobil-spesifik endpoint'ler (push token, device, notification) |
| Agent-B | Database, Schema | Yeni mobil tablolar (device_tokens, notifications, notification_preferences) |
| Manager | Koordinasyon | Mobil + web senkronizasyon kararlari |

## 4) Durum Modeli

- `todo`: Hazir, baslanmamis
- `in_progress`: Aktif calisiliyor
- `blocked`: Engelli, neden kayitli
- `done`: Tamamlandi

Kurallar:
- Ayni ajan icin ayni anda maksimum 1 `in_progress` gorev.
- Bagimliliklar tamamlanmadan (`dependsOn`) gorev baslatilamaz.
- Her `done` durumundan sonra `mobile:agent:advance` calistirilir.

## 5) Gecis Akisi (Surekli Dongu)

1. Durumu gor:
   - `pnpm mobile:agent:status`
2. Siradaki gorevleri gor:
   - `pnpm mobile:agent:next`
3. Otomatik gorev baslat:
   - `pnpm mobile:agent:advance`
4. Icra edilen gorevi tamamla:
   - `node scripts/mobile-agent-orchestrator.mjs done <TASK_ID>`
5. Raporu yenile:
   - `pnpm mobile:agent:report`
6. 1. adima geri don.

Bu dongu, backlogdaki tum gorevler `done` olana kadar devam eder.

## 6) Web-Mobil Senkronizasyon Protokolu

### API Degisiklikleri
1. Web tarafinda yeni bir tRPC procedure eklendiginde:
   - `MOBILE_APP_TRACKER.md` Sync Parity Matrix guncellenir
   - Mobil agent-backlog'a yeni gorev eklenir
   - Agent-M1 tRPC client'i gunceller

### Schema Degisiklikleri
1. `packages/db/` schema degistiginde:
   - `packages/types/` export'lari kontrol edilir
   - Mobil tRPC client type'lari otomatik guncellenir (shared types)

### UI Degisiklikleri
1. Web'de yeni sayfa/ozellik eklendiginde:
   - Mobil ekran eklenir (parity matrix guncellenir)
   - Agent-M2 ilgili screen + components olusturur

### WebSocket Degisiklikleri
1. Yeni socket event eklendiginde:
   - Agent-M1 socket-client.ts gunceller
   - Ilgili hook'a yeni event handler eklenir

## 7) Skill Tanimlari (Mobil)

### Skill: mobile-dev
```
Trigger: /mobile:dev
Action: Start Expo dev server for mobile
Command: cd apps/mobile && npx expo start
```

### Skill: mobile-build
```
Trigger: /mobile:build
Action: Build mobile app with EAS
Command: cd apps/mobile && eas build --profile {profile}
Options: --profile development|preview|production
```

### Skill: mobile-test
```
Trigger: /mobile:test
Action: Run mobile unit tests
Command: pnpm --filter @estimate-pro/mobile test
```

### Skill: mobile-e2e
```
Trigger: /mobile:e2e
Action: Run Detox E2E tests
Command: pnpm --filter @estimate-pro/mobile e2e:{platform}
Options: ios|android
```

### Skill: mobile-lint
```
Trigger: /mobile:lint
Action: Lint mobile code
Command: pnpm --filter @estimate-pro/mobile lint
```

### Skill: mobile-typecheck
```
Trigger: /mobile:typecheck
Action: TypeScript check mobile
Command: pnpm --filter @estimate-pro/mobile typecheck
```

### Skill: mobile-quality-gate
```
Trigger: /mobile:quality
Action: Full quality gate (build + lint + typecheck + test)
Command: pnpm mobile:quality:gate
```

### Skill: mobile-parity-check
```
Trigger: /mobile:parity
Action: Check web-mobile feature parity
Command: pnpm mobile:parity:check
Output: agent-ops/mobile-parity-check-latest.md
```

### Skill: mobile-agent-status
```
Trigger: /mobile:status
Action: Show mobile agent backlog status
Command: pnpm mobile:agent:status
```

## 8) Operasyon Komutlari

```bash
# Gelistirme
pnpm mobile:dev                    # Expo dev server
pnpm mobile:ios                    # iOS simulator
pnpm mobile:android                # Android emulator

# Build
pnpm mobile:build:dev              # EAS development build
pnpm mobile:build:preview          # EAS preview build
pnpm mobile:build:prod             # EAS production build

# Test
pnpm mobile:test                   # Unit tests
pnpm mobile:test:coverage          # Coverage report
pnpm mobile:e2e:ios                # Detox iOS
pnpm mobile:e2e:android            # Detox Android

# Kalite
pnpm mobile:lint                   # ESLint
pnpm mobile:typecheck              # TypeScript
pnpm mobile:quality:gate           # Full gate

# Ajan Yonetimi
pnpm mobile:agent:status           # Backlog durumu
pnpm mobile:agent:next             # Siradaki gorevler
pnpm mobile:agent:advance          # Otomatik baslat
pnpm mobile:agent:report           # Rapor olustur
pnpm mobile:agent:validate         # Dogrulama

# Senkronizasyon
pnpm mobile:parity:check           # Web-mobil parity kontrolu
pnpm mobile:sync:types             # Shared type senkronizasyonu

# Release
pnpm mobile:submit:ios             # App Store submit
pnpm mobile:submit:android         # Play Store submit
pnpm mobile:update                 # OTA update
```

## 9) Durma Kriteri

Mobil ajan sistemi ancak tum backlog `done` oldugunda "dokuman bitmis" kabul eder.

Kontrol:
- `pnpm mobile:agent:status` cikti ozetinde `todo=0`, `in_progress=0`, `blocked=0`

## 10) Phase-Task Mapping

| Phase | Task Range | Task Count | Primary Agent |
|---|---|---|---|
| Phase 0: Planning | M-001 → M-006 | 6 | Manager |
| Phase 1: Foundation | M-010 → M-044 | 26 | Agent-M1 |
| Phase 2: Core Screens (P0) | M-050 → M-113 | 50 | Agent-M2 |
| Phase 3: Extended (P1) | M-120 → M-157 | 30 | Agent-M2 |
| Phase 4: Advanced (P2) | M-160 → M-183 | 18 | Agent-M2 |
| Phase 5: Native Features | M-200 → M-236 | 27 | Agent-M3 |
| Phase 6: Testing | M-240 → M-251 | 12 | All |
| Phase 7: Release | M-260 → M-269 | 10 | Agent-M3 |
| **Backend Support** | M-B001 → M-B006 | 6 | Agent-A + Agent-B |
| **Total** | | **186** | |

### Backend Support Tasks (Shared Team)

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-B001 | `device_tokens` DB schema | ⬜ | Agent-B | M-200 | Migration applies | New table |
| M-B002 | `notifications` DB schema | ⬜ | Agent-B | M-200 | Migration applies | New table |
| M-B003 | `notification_preferences` DB schema | ⬜ | Agent-B | M-200 | Migration applies | New table |
| M-B004 | `device` tRPC router (register/unregister token, preferences) | ⬜ | Agent-A | M-B001, M-B003 | API tests pass | New router |
| M-B005 | `notification` tRPC router (list, markRead, markAllRead) | ⬜ | Agent-A | M-B002 | API tests pass | New router |
| M-B006 | Push notification dispatch service (Expo Push API) | ⬜ | Agent-A | M-B004 | Push delivered | New service |

## 11) Web-Mobil Cakisma Yonetimi

Eskilerde web projesi icin `CONFLICT_RISK_REPORT.md` kullanildi. Mobil gelistirme icin:

### Yuksek Risk Dosyalari (Ortak Degisim Alanlari)
| File | Risk | Mitigation |
|---|---|---|
| `packages/types/src/*.ts` | Tip degisiklikleri her iki platformu etkiler | Semver versiyonlama |
| `apps/api/src/routers/*/router.ts` | Yeni procedure'lar mobil parity gerektirir | Parity check script |
| `packages/db/src/schema/*.ts` | Schema degisiklikleri migration gerektirir | Forward/rollback pair |
| `turbo.json` | Pipeline degisiklikleri tum workspace'i etkiler | Manager onay gerekir |
| `pnpm-workspace.yaml` | Workspace degisiklikleri build'i bozabilir | Manager onay gerekir |

### Kural
1. `packages/types/` degisikliginde mobil build kontrol edilir.
2. API router degisikliginde `pnpm mobile:parity:check` calistirilir.
3. Schema degisikliginde forward + rollback migration zorunlu.
4. Workspace config degisikliginde tum platform build'leri dogrulanir.

## 12) Degisiklik Yonetimi

- Yeni gorev eklenecekse tek kaynak sadece `agent-ops/mobile-agent-backlog.json`.
- Phase, owner, dependsOn ve acceptance alanlari olmadan gorev acilmaz.
- Her buyuk re-plan sonrasinda `MOBILE_APP_TRACKER.md` guncellenir.
- Web tarafindaki her yeni ozellik icin `pnpm mobile:parity:check` calistirilir.
