# EstimatePro Mobile - Architecture Document

> Version: 1.0
> Date: 2026-02-21
> Status: Planning

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                      │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Screens  │  │Components│  │  Stores  │  │  Hooks  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│  ┌────┴──────────────┴──────────────┴──────────────┴───┐ │
│  │              Service Layer                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │tRPC Client│  │Socket.io │  │  MMKV    │         │ │
│  │  │+ RQ Cache │  │  Client  │  │ Storage  │         │ │
│  │  └────┬─────┘  └────┬─────┘  └──────────┘         │ │
│  └───────┼──────────────┼─────────────────────────────┘ │
│          │              │                                 │
└──────────┼──────────────┼─────────────────────────────────┘
           │              │
    HTTPS  │       WSS    │
           │              │
┌──────────┼──────────────┼─────────────────────────────────┐
│          ▼              ▼           Backend (Existing)     │
│  ┌──────────────────────────────┐                         │
│  │     Fastify + tRPC Server    │                         │
│  │     (12 routers, 75+ procs) │                         │
│  └──────┬───────────┬──────────┘                         │
│         │           │                                     │
│  ┌──────▼──┐  ┌─────▼─────┐  ┌───────────┐             │
│  │PostgreSQL│  │   Redis   │  │  OpenAI   │             │
│  │+ pgvector│  │  (cache)  │  │  (AI)     │             │
│  └─────────┘  └───────────┘  └───────────┘             │
└───────────────────────────────────────────────────────────┘
```

## 2. Navigation Architecture

```
RootNavigator (Stack)
├── AuthNavigator (Stack) [when signed out]
│   ├── SignInScreen
│   └── SignUpScreen
│
└── MainNavigator (Bottom Tabs) [when signed in]
    ├── HomeTab
    │   └── HomeScreen
    │
    ├── ProjectsTab (Stack)
    │   ├── ProjectsScreen (list)
    │   ├── ProjectDetailScreen (tabs: Kanban/List/Info)
    │   └── KanbanScreen (full-screen board)
    │
    ├── SessionsTab (Stack)
    │   ├── SessionsScreen (list)
    │   ├── SessionDetailScreen
    │   └── PlanningPokerScreen (full-screen poker)
    │
    └── MoreTab (Stack)
        ├── MoreMenuScreen
        ├── SprintsScreen
        ├── EffortScreen → RoadmapScreen → CostAnalysisScreen
        ├── AnalyticsScreen
        ├── IntegrationsScreen
        ├── AnalyzerScreen
        ├── CompareScreen
        └── SettingsScreen
```

### Deep Link Mapping

| URL Pattern | Screen | Params |
|---|---|---|
| `estimatepro://` | HomeScreen | - |
| `estimatepro://projects` | ProjectsScreen | - |
| `estimatepro://projects/:id` | ProjectDetailScreen | projectId |
| `estimatepro://sessions` | SessionsScreen | - |
| `estimatepro://sessions/:id` | SessionDetailScreen | sessionId |
| `estimatepro://sessions/:id/join` | SessionDetailScreen | sessionId (auto-join) |
| `estimatepro://settings` | SettingsScreen | - |

## 3. State Management Architecture

```
┌────────────────────────────────────────────────────────┐
│                   State Layers                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Server State (React Query + tRPC)                  │ │
│  │  - All API data (projects, tasks, sessions, etc.)   │ │
│  │  - Auto-refetch, stale-while-revalidate             │ │
│  │  - Persisted to MMKV for offline access             │ │
│  │  - Managed via tRPC hooks in screens                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Client State (Zustand Stores)                      │ │
│  │  - auth-store: user, token, org context             │ │
│  │  - settings-store: theme, locale, notifications     │ │
│  │  - session-store: active session socket state       │ │
│  │  - notification-store: unread count, feed           │ │
│  │  - Persisted to MMKV (except auth tokens)           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Secure State (expo-secure-store)                   │ │
│  │  - Clerk session token                              │ │
│  │  - API keys (encrypted at rest)                     │ │
│  │  - Biometric enrollment flag                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Component State (useState/useReducer)              │ │
│  │  - Form inputs, modal open/close                    │ │
│  │  - Search text, filter selections                   │ │
│  │  - Animation values (Reanimated shared values)      │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Offline-First Data Flow

```
User Action
    │
    ▼
┌─────────────────┐
│  React Query     │
│  useMutation()   │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Online? │
    └────┬────┘
    YES  │  NO
    ┌────▼────┐  ┌─────────────┐
    │  Send   │  │  Queue to   │
    │  to API │  │  MMKV store │
    └────┬────┘  └──────┬──────┘
         │              │
    ┌────▼────┐    ┌────▼──────┐
    │ Success │    │  Show      │
    │ Update  │    │  Optimistic│
    │ Cache   │    │  UI + sync │
    └─────────┘    │  indicator │
                   └────┬──────┘
                        │
                   ┌────▼──────┐
                   │ On Reconnect│
                   │ Replay      │
                   │ Queue       │
                   └────┬──────┘
                        │
                   ┌────▼──────┐
                   │ Conflict?  │
                   │ Show diff  │
                   │ User picks │
                   └───────────┘
```

## 4. Real-Time Architecture (Sessions)

```
┌──────────────┐         ┌──────────────┐
│  Device A    │         │  Device B    │
│  (Moderator) │         │  (Voter)     │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │  join-session          │  join-session
       ▼                        ▼
┌──────────────────────────────────────┐
│          Socket.io Server            │
│     Room: session-{sessionId}        │
│                                      │
│  Events:                             │
│  ← participant-joined (broadcast)    │
│  ← participant-left (broadcast)      │
│  → submit-vote (from voter)          │
│  ← vote-submitted (to others)        │
│  → reveal-votes (from moderator)     │
│  ← votes-revealed (broadcast)        │
│  → start-new-round (from moderator)  │
│  ← new-round-started (broadcast)     │
└──────────────────────────────────────┘
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│  Moderator   │         │  Voter sees: │
│  Controls:   │         │  - Card deck │
│  - Reveal    │         │  - Tap vote  │
│  - New round │         │  - See reveal│
│  - Complete  │         │  - Metrics   │
└──────────────┘         └──────────────┘
```

### Mobile Socket Reconnection Strategy

```
Disconnect detected
    │
    ▼
┌─────────────────┐
│ Attempt 1: 1s   │ ← Immediate retry
└────────┬────────┘
    FAIL │
    ┌────▼────────────┐
    │ Attempt 2: 2s   │ ← Exponential backoff
    └────────┬────────┘
    FAIL │
    ┌────▼────────────┐
    │ Attempt 3: 4s   │
    └────────┬────────┘
    FAIL │
    ┌────▼────────────┐
    │ Attempt 4: 8s   │
    └────────┬────────┘
    FAIL │
    ┌────▼────────────┐
    │ Attempt 5: 16s  │ ← Max backoff
    └────────┬────────┘
    FAIL │
    ┌────▼────────────┐
    │ Show "Reconnect │ ← User action required
    │ Manually" button│
    └────────┬────────┘
    SUCCESS  │
    ┌────▼────────────┐
    │ Resync state:   │
    │ - Re-join room  │
    │ - Fetch votes   │
    │ - Update UI     │
    └─────────────────┘
```

## 5. Push Notification Architecture

```
┌─────────────────────────────────────────────┐
│                API Server                    │
│                                              │
│  Event triggers:                             │
│  - session.create → notify invited users     │
│  - session.reveal → notify session members   │
│  - task.update (assignee) → notify assignee  │
│  - sprint.update (active) → notify team      │
│                                              │
│  ┌─────────────────┐                        │
│  │ Push Service     │                        │
│  │ (new module)     │                        │
│  │                  │                        │
│  │ 1. Get tokens    │                        │
│  │    from DB       │                        │
│  │ 2. Build payload │                        │
│  │ 3. Send via      │                        │
│  │    Expo Push API │                        │
│  └────────┬────────┘                        │
└───────────┼──────────────────────────────────┘
            │
     ┌──────▼──────┐
     │ Expo Push    │
     │ Service      │
     └──────┬──────┘
            │
     ┌──────┴──────┐
     │             │
┌────▼────┐  ┌────▼────┐
│  APNs   │  │  FCM    │
│  (iOS)  │  │(Android)│
└────┬────┘  └────┬────┘
     │             │
┌────▼────┐  ┌────▼────┐
│ iPhone  │  │ Android │
│ Device  │  │ Device  │
└─────────┘  └─────────┘
```

### Notification Payload Schema

```typescript
interface PushPayload {
  to: string;           // Expo push token
  title: string;        // Notification title
  body: string;         // Notification body
  data: {
    type: 'session_invite' | 'vote_revealed' | 'task_assigned' | 'sprint_started';
    deepLink: string;   // estimatepro://sessions/{id}
    entityId: string;   // Related entity UUID
  };
  sound: 'default' | null;
  badge?: number;
  categoryId?: string;  // iOS notification category
}
```

## 6. Security Architecture

```
┌─────────────────────────────────────────────┐
│              Security Layers                 │
│                                              │
│  Layer 1: Transport                          │
│  ├── HTTPS/WSS only (no HTTP)               │
│  ├── Certificate pinning (prod)              │
│  └── TLS 1.3 minimum                        │
│                                              │
│  Layer 2: Authentication                     │
│  ├── Clerk Expo SDK (JWT tokens)             │
│  ├── Token stored in Keychain/Keystore       │
│  ├── Auto-refresh on expiry                  │
│  └── Biometric re-auth after background      │
│                                              │
│  Layer 3: Data at Rest                       │
│  ├── Tokens: expo-secure-store (encrypted)   │
│  ├── Cache: MMKV (encrypted mode)            │
│  ├── No PII in React Query cache keys        │
│  └── Clear all on sign-out                   │
│                                              │
│  Layer 4: API Security                       │
│  ├── All requests include Clerk JWT           │
│  ├── Organization isolation enforced server   │
│  ├── Input validation (Zod, server-side)      │
│  └── Rate limiting (server-side)              │
│                                              │
│  Layer 5: App Security                       │
│  ├── ProGuard/R8 obfuscation (Android)       │
│  ├── No sensitive data in logs                │
│  ├── Screenshot prevention (optional)         │
│  └── Jailbreak/root detection (warning)       │
└─────────────────────────────────────────────┘
```

## 7. Build & Release Architecture

```
┌─────────────────────────────────────────────┐
│              EAS Build Profiles              │
│                                              │
│  development:                                │
│  ├── iOS Simulator build                     │
│  ├── Android APK (debug)                     │
│  ├── Development client with Expo Go         │
│  └── Profile: internal                       │
│                                              │
│  preview:                                    │
│  ├── iOS Ad Hoc (TestFlight)                 │
│  ├── Android APK (release)                   │
│  ├── For QA/stakeholder testing              │
│  └── Profile: internal                       │
│                                              │
│  production:                                 │
│  ├── iOS IPA (App Store)                     │
│  ├── Android AAB (Play Store)                │
│  ├── Code signing with prod certs            │
│  └── Profile: store                          │
└─────────────────────────────────────────────┘

CI/CD Pipeline:
┌──────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│ Push │───▶│ Lint +   │───▶│ EAS Build │───▶│ TestFlight│
│ to   │    │ TypeCheck│    │ (preview) │    │ / Internal│
│ main │    │ + Test   │    │           │    │ Track     │
└──────┘    └──────────┘    └───────────┘    └──────────┘
                                                  │
                                          ┌───────▼────────┐
                                          │ Manual approve  │
                                          │ + EAS Submit    │
                                          └───────┬────────┘
                                                  │
                                          ┌───────▼────────┐
                                          │ App Store /     │
                                          │ Play Store      │
                                          └────────────────┘

OTA Updates (expo-updates):
┌──────────┐    ┌──────────┐    ┌──────────┐
│ JS-only  │───▶│ EAS      │───▶│ Devices  │
│ changes  │    │ Update   │    │ auto-    │
│ (no      │    │ publish  │    │ download │
│ native)  │    │          │    │ on next  │
│          │    │          │    │ launch   │
└──────────┘    └──────────┘    └──────────┘
```

## 8. Monorepo Integration

```
project_effort/
├── apps/
│   ├── api/          # Backend (shared)
│   ├── web/          # Web frontend
│   └── mobile/       # ← NEW: Mobile app
├── packages/
│   ├── types/        # ✅ Shared with mobile
│   ├── errors/       # ✅ Shared with mobile
│   ├── estimation-core/  # ✅ Shared with mobile
│   ├── db/           # ❌ Server-only
│   ├── ui/           # ❌ Web-only (DOM)
│   ├── typescript-config/
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   ├── node.json
│   │   └── mobile.json  # ← NEW: RN preset
│   └── eslint-config/
│       ├── base.js
│       ├── react.js
│       ├── api.js
│       └── react-native.js  # ← NEW: RN config
├── turbo.json        # Updated: mobile:* tasks
└── pnpm-workspace.yaml  # Updated: apps/mobile
```

### Metro Bundler Configuration

```javascript
// apps/mobile/metro.config.js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch monorepo packages
config.watchFolders = [monorepoRoot];

// Resolve packages from monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Ensure shared packages resolve correctly
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

## 9. Shared Code Strategy

### Types (100% Shared)
```
@estimate-pro/types
├── common.ts      → Used in mobile for API types
├── organization.ts → Org types
├── project.ts     → Project types
├── task.ts        → Task types (status, priority, type enums)
├── estimation.ts  → Estimation method types
└── user.ts        → User types
```

### Estimation Core (100% Shared)
```
@estimate-pro/estimation-core
├── planning-poker.ts  → Card values, consensus calc
├── t-shirt-sizing.ts  → Size mapping
├── pert.ts            → PERT formula
├── wideband-delphi.ts → Multi-round logic
└── outlier.ts         → Outlier detection
```

### Errors (100% Shared)
```
@estimate-pro/errors
├── codes.ts       → Error code constants
└── app-error.ts   → AppError class
```

## 10. Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| App startup (cold) | < 2s | Splash → Home interactive |
| App startup (warm) | < 500ms | Background → foreground |
| Screen transition | < 300ms | Navigation push/pop |
| List scroll | 60 fps | No dropped frames on 500+ items |
| API response (cached) | < 50ms | MMKV cache hit |
| API response (network) | < 500ms | P95 latency |
| Socket reconnect | < 5s | Disconnect → reconnected |
| Offline → Online sync | < 3s | Queue replay duration |
| Memory usage | < 200MB | Peak during estimation session |
| Bundle size (JS) | < 5MB | Hermes bytecode |

## 11. API Parity Contract

The mobile app MUST support all tRPC procedures that the web app uses.
When new procedures are added to the API, the mobile parity matrix in
`MOBILE_APP_TRACKER.md` must be updated.

### Procedure Count by Router

| Router | Procedures | Mobile Status |
|---|---|---|
| organization | 4 | ⬜ Planned |
| project | 5 | ⬜ Planned |
| task | 6 | ⬜ Planned |
| team | 4 | ⬜ Planned |
| session | 9 | ⬜ Planned |
| sprint | 5 | ⬜ Planned |
| ai | 3 | ⬜ Planned |
| analytics | 8 | ⬜ Planned |
| effort | 12 | ⬜ Planned |
| integration | 10 | ⬜ Planned |
| apiKeys | 6+ | ⬜ Planned |
| document | 3+ | ⬜ Planned |
| **Total** | **75+** | |

### WebSocket Event Count

| Direction | Events | Mobile Status |
|---|---|---|
| Client → Server | 5 | ⬜ Planned |
| Server → Client | 6 | ⬜ Planned |
| **Total** | **11** | |
