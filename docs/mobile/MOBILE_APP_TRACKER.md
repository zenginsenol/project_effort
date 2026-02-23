# EstimatePro Mobile App - Project Tracker

> Last Updated: 2026-02-21
> Current Phase: Phase 0 - Planning & Setup
> Overall Progress: `0/186` tasks complete
> Target Platforms: iOS + Android (React Native / Expo)
> Sync Strategy: 100% API parity with web (`apps/web`)

## Status Icons
- ⬜ Pending
- 🔄 In Progress
- ✅ Done
- ⚠️ Partial
- ❌ Blocked / Missing

## Agent Assignments (Mobile)

| Agent | Expertise | Owned Directories |
|-------|-----------|-------------------|
| Agent-M1 | Mobile Core, Navigation, State, Offline | `apps/mobile/src/navigation/`, `apps/mobile/src/stores/`, `apps/mobile/src/services/` |
| Agent-M2 | Mobile UI, Components, Animations | `apps/mobile/src/components/`, `apps/mobile/src/screens/`, `apps/mobile/src/theme/` |
| Agent-M3 | Mobile Integration, Push, Biometric, Native | `apps/mobile/src/native/`, `apps/mobile/src/push/`, `apps/mobile/e2e/` |
| Agent-A | Backend API (shared, existing) | `apps/api/` (mobile-specific endpoints only) |
| Manager | Coordination, review, decisions | All files (read), tracker |

---

## Sync Parity Matrix (Web ↔ Mobile)

> Every web page/feature must have a mobile equivalent. This matrix is the source of truth.

| Web Page/Feature | Mobile Screen | API Endpoint | WebSocket | Priority |
|---|---|---|---|---|
| `/dashboard` | `HomeScreen` | `project.list`, `team.list`, `task.list` | - | P0 |
| `/dashboard/projects` | `ProjectsScreen` | `project.list`, `project.create` | - | P0 |
| `/dashboard/projects/[id]` | `ProjectDetailScreen` + `KanbanScreen` | `task.list`, `task.create`, `task.update`, `task.reorder` | - | P0 |
| `/dashboard/sessions` | `SessionsScreen` | `session.list`, `session.create` | - | P0 |
| `/dashboard/sessions/[id]` | `SessionDetailScreen` (Planning Poker) | `session.*` (9 procedures) | ✅ Full RT | P0 |
| `/dashboard/sprints` | `SprintsScreen` | `sprint.list`, `sprint.create`, `sprint.update` | - | P1 |
| `/dashboard/effort` | `EffortScreen` + `RoadmapScreen` + `CostAnalysisScreen` | `effort.*` (12 procedures) | - | P1 |
| `/dashboard/analytics` | `AnalyticsScreen` | `analytics.*` (8 procedures) | - | P1 |
| `/dashboard/integrations` | `IntegrationsScreen` | `integration.*` (10 procedures) | - | P2 |
| `/dashboard/settings` | `SettingsScreen` | `apiKeys.*`, `organization.update` | - | P1 |
| `/dashboard/analyzer` | `AnalyzerScreen` | `document.analyzeText`, REST `/api/analyze-document` | - | P2 |
| `/dashboard/compare` | `CompareScreen` | `document.compare` | - | P2 |
| Sign-in / Sign-up | `AuthScreen` | Clerk SDK (Expo) | - | P0 |
| Theme (light/dark) | System + Manual toggle | - | - | P0 |

---

## Phase 0: Planning & Architecture ⬜

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-001 | Mobile tech stack finalization (Expo SDK 53 + React Native 0.76) | ⬜ | Manager | - | Decision doc | See Decision Log below |
| M-002 | Mobile architecture document (navigation, state, offline, push) | ⬜ | Manager | M-001 | Architecture doc | `MOBILE_ARCHITECTURE.md` |
| M-003 | Mobile design system spec (typography, colors, spacing, components) | ⬜ | Agent-M2 | M-001 | Design tokens file | Matches web theme |
| M-004 | API gap analysis (mobile-specific endpoints needed) | ⬜ | Agent-A | M-001 | Gap report | Push token, device reg |
| M-005 | Offline-first strategy document | ⬜ | Agent-M1 | M-001 | Strategy doc | WatermelonDB vs MMKV |
| M-006 | CI/CD pipeline design (EAS Build + EAS Submit) | ⬜ | Agent-M3 | M-001 | Pipeline doc | iOS + Android |

---

## Phase 1: Mobile Foundation (Monorepo Integration) ⬜

### 1A. Expo Project Scaffold

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-010 | `apps/mobile/` Expo project init (Expo SDK 53, TypeScript) | ⬜ | Agent-M1 | M-001 | `npx expo start` works | New workspace member |
| M-011 | `pnpm-workspace.yaml` update (add `apps/mobile`) | ⬜ | Agent-M1 | M-010 | Workspace detection | |
| M-012 | `turbo.json` pipeline update (mobile:dev, mobile:build, mobile:test) | ⬜ | Agent-M1 | M-011 | `turbo run mobile:dev` | |
| M-013 | `tsconfig.json` mobile preset (`packages/typescript-config/mobile.json`) | ⬜ | Agent-M1 | M-010 | Type check passes | Strict mode |
| M-014 | ESLint config for React Native (`packages/eslint-config/react-native.js`) | ⬜ | Agent-M1 | M-010 | Lint passes | RN-specific rules |
| M-015 | `app.config.ts` (Expo config with env variables) | ⬜ | Agent-M1 | M-010 | Config loads | EAS profiles |
| M-016 | `.env.mobile.example` with all required mobile variables | ⬜ | Agent-M1 | M-010 | Documented | |
| M-017 | Metro bundler config (monorepo symlinks, package aliases) | ⬜ | Agent-M1 | M-011 | Metro resolves packages | `@estimate-pro/*` |
| M-018 | Shared package imports working (`@estimate-pro/types`, `@estimate-pro/errors`, `@estimate-pro/estimation-core`) | ⬜ | Agent-M1 | M-017 | Import test passes | Critical integration |

### 1B. Navigation & Auth

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-020 | React Navigation v7 setup (native stack + bottom tabs) | ⬜ | Agent-M1 | M-010 | Navigation renders | @react-navigation/native |
| M-021 | Navigation type definitions (RootStackParamList, TabParamList) | ⬜ | Agent-M1 | M-020 | Types compile | Typed routes |
| M-022 | Auth flow with Clerk Expo SDK (`@clerk/clerk-expo`) | ⬜ | Agent-M1 | M-020 | Sign-in works | Token storage |
| M-023 | Secure token storage (expo-secure-store) | ⬜ | Agent-M1 | M-022 | Token persists | Encrypted at rest |
| M-024 | Auth guard navigator (signed-in vs signed-out stacks) | ⬜ | Agent-M1 | M-022 | Route protection | Auto-redirect |
| M-025 | Deep linking configuration (estimatepro://) | ⬜ | Agent-M1 | M-020 | Deep links resolve | Session join links |
| M-026 | Biometric unlock (expo-local-authentication) | ⬜ | Agent-M3 | M-023 | FaceID/TouchID works | Optional feature |

### 1C. API Client & State Management

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-030 | tRPC client for React Native (vanilla client + React Query) | ⬜ | Agent-M1 | M-022 | API calls succeed | `@trpc/client` + `@tanstack/react-query` |
| M-031 | API base URL config (dev/staging/prod profiles) | ⬜ | Agent-M1 | M-030 | Environment switching | EAS env profiles |
| M-032 | Zustand stores (auth, projects, tasks, sessions, settings) | ⬜ | Agent-M1 | M-030 | State persists | zustand/persist + MMKV |
| M-033 | MMKV storage adapter (react-native-mmkv) | ⬜ | Agent-M1 | M-010 | Read/write works | Fast KV store |
| M-034 | React Query persistence (offline cache) | ⬜ | Agent-M1 | M-033 | Cache survives restart | @tanstack/query-persist |
| M-035 | Network status detection (NetInfo) | ⬜ | Agent-M1 | M-010 | Online/offline events | @react-native-community/netinfo |
| M-036 | Optimistic mutation queue (offline writes) | ⬜ | Agent-M1 | M-035 | Mutations replay online | Custom middleware |

### 1D. Socket.io Mobile Client

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-040 | Socket.io client for React Native | ⬜ | Agent-M1 | M-030 | Connection established | socket.io-client |
| M-041 | Auth handshake (Clerk JWT in socket auth) | ⬜ | Agent-M1 | M-022, M-040 | Authenticated connection | |
| M-042 | Room management (join/leave session) | ⬜ | Agent-M1 | M-041 | Room events fire | |
| M-043 | Reconnection strategy (exponential backoff + state sync) | ⬜ | Agent-M1 | M-042 | Auto-reconnect works | |
| M-044 | Background socket keepalive | ⬜ | Agent-M3 | M-043 | Survives app background | Platform-specific |

**Phase 1 Exit Criteria:**
- [ ] `apps/mobile/` builds and runs on iOS simulator + Android emulator
- [ ] Shared packages (`types`, `errors`, `estimation-core`) import correctly
- [ ] Clerk auth flow works (sign-in, sign-up, sign-out)
- [ ] tRPC calls to API succeed
- [ ] Socket.io connects and authenticates
- [ ] Offline detection works

---

## Phase 2: Core Screens (Feature Parity - P0) ⬜

### 2A. Design System & Components

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-050 | Theme provider (light/dark, system preference) | ⬜ | Agent-M2 | M-010 | Toggle works | Matches web colors |
| M-051 | Typography system (Inter font, scale tokens) | ⬜ | Agent-M2 | M-050 | All sizes render | expo-font |
| M-052 | Color palette tokens (semantic colors, status colors) | ⬜ | Agent-M2 | M-050 | Dark mode works | CSS vars → RN |
| M-053 | Spacing & layout primitives (Box, Stack, Row, Column) | ⬜ | Agent-M2 | M-050 | Layout correct | Consistent spacing |
| M-054 | Button component (primary, secondary, outline, ghost, destructive) | ⬜ | Agent-M2 | M-053 | All variants render | Haptic feedback |
| M-055 | Input component (text, textarea, number, search) | ⬜ | Agent-M2 | M-053 | Keyboard handling | Auto-dismiss |
| M-056 | Card component (elevated, outlined, filled) | ⬜ | Agent-M2 | M-053 | All variants render | Shadow + border |
| M-057 | Badge/Pill component (status, priority, type) | ⬜ | Agent-M2 | M-052 | Color-coded | Matches web pills |
| M-058 | Modal/BottomSheet component (react-native-bottom-sheet) | ⬜ | Agent-M2 | M-053 | Gesture-based | gorhom/bottom-sheet |
| M-059 | Toast/Snackbar notifications | ⬜ | Agent-M2 | M-053 | Auto-dismiss | react-native-toast |
| M-060 | Empty state component (illustration + CTA) | ⬜ | Agent-M2 | M-053 | Renders correctly | Reusable |
| M-061 | Loading/Skeleton component | ⬜ | Agent-M2 | M-053 | Shimmer animation | Content placeholders |
| M-062 | Select/Picker component (project, sprint, method) | ⬜ | Agent-M2 | M-058 | Selection works | BottomSheet-based |
| M-063 | Avatar component (user initials + image) | ⬜ | Agent-M2 | M-053 | Renders correctly | Clerk user image |
| M-064 | Icon system (lucide-react-native) | ⬜ | Agent-M2 | M-010 | All icons render | Matches web icons |

### 2B. Home / Dashboard Screen

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-070 | HomeScreen layout (scroll, pull-to-refresh) | ⬜ | Agent-M2 | M-053 | Renders correctly | |
| M-071 | Stats cards row (projects, tasks, team, estimated) | ⬜ | Agent-M2 | M-056, M-030 | Data from API | Horizontal scroll |
| M-072 | Recent activity feed | ⬜ | Agent-M2 | M-030 | Shows latest tasks | FlatList |
| M-073 | Task status breakdown (backlog/todo/progress/review/done) | ⬜ | Agent-M2 | M-057 | Correct counts | Mini chart |
| M-074 | Quick action FAB (new project, new session, new task) | ⬜ | Agent-M2 | M-054 | Actions navigate | Floating button |

### 2C. Projects Screen

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-080 | ProjectsScreen list (FlatList with pull-to-refresh) | ⬜ | Agent-M2 | M-056, M-030 | List renders | project.list |
| M-081 | ProjectCard component (name, key, status, progress, task count) | ⬜ | Agent-M2 | M-056 | Matches web card | Animated progress |
| M-082 | Create project bottom sheet (name, key, description) | ⬜ | Agent-M2 | M-058 | Creates project | project.create |
| M-083 | Project search/filter | ⬜ | Agent-M2 | M-055 | Search works | Local filter |
| M-084 | Swipe actions (archive, delete) | ⬜ | Agent-M2 | M-080 | Gesture works | react-native-gesture |

### 2D. Project Detail & Kanban

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-090 | ProjectDetailScreen (tab layout: Kanban / List / Info) | ⬜ | Agent-M2 | M-020 | Tabs switch | Material top tabs |
| M-091 | Kanban board (horizontal scroll, 6 columns) | ⬜ | Agent-M2 | M-030 | Columns render | ScrollView + FlatList |
| M-092 | Kanban drag-and-drop (react-native-draggable-flatlist) | ⬜ | Agent-M2 | M-091 | D&D updates status | Haptic feedback |
| M-093 | Task card component (title, type badge, priority, points, assignee) | ⬜ | Agent-M2 | M-057 | All fields render | Compact mobile card |
| M-094 | Create task bottom sheet (title, type, priority, description, points, hours) | ⬜ | Agent-M2 | M-058 | Creates task | task.create |
| M-095 | Task detail bottom sheet (full CRUD, subtasks, estimation presets) | ⬜ | Agent-M2 | M-058 | Edit/delete works | task.update |
| M-096 | List view (sortable, filterable) | ⬜ | Agent-M2 | M-030 | Filter/sort works | URL state → params |
| M-097 | GitHub integration panel (link repo, sync status) | ⬜ | Agent-M2 | M-095 | Link/sync works | integration.* |
| M-098 | Estimation preset buttons (XS-XL quick select) | ⬜ | Agent-M2 | M-095 | Updates task | Inline presets |

### 2E. Estimation Sessions (Real-Time)

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-100 | SessionsScreen list (active, completed sessions) | ⬜ | Agent-M2 | M-030 | List renders | session.list |
| M-101 | Create session bottom sheet (project, name, method, task) | ⬜ | Agent-M2 | M-058 | Creates session | session.create |
| M-102 | Planning Poker card deck UI (Fibonacci: 0,1,2,3,5,8,13,21) | ⬜ | Agent-M2 | M-040 | Cards animate | Card flip animation |
| M-103 | T-Shirt sizing UI (XS, S, M, L, XL, XXL) | ⬜ | Agent-M2 | M-040 | Size selection | Badge-based |
| M-104 | PERT three-input form (Optimistic, Most Likely, Pessimistic) | ⬜ | Agent-M2 | M-055 | Calculation correct | estimation-core |
| M-105 | Wideband Delphi multi-round UI | ⬜ | Agent-M2 | M-040 | Multi-round flow | Round progression |
| M-106 | Participant list with voting status | ⬜ | Agent-M2 | M-063 | Real-time updates | Online/voted/idle |
| M-107 | Vote reveal animation (card flip + confetti) | ⬜ | Agent-M2 | M-102 | Animation plays | Lottie/Reanimated |
| M-108 | Vote metrics display (avg, median, consensus, agreement %) | ⬜ | Agent-M2 | M-102 | Correct calculations | estimation-core |
| M-109 | Moderator controls (start, reveal, new round, complete) | ⬜ | Agent-M2 | M-040 | All controls work | Role-based UI |
| M-110 | Session join via deep link / QR code | ⬜ | Agent-M3 | M-025 | Join works | estimatepro://session/{id} |
| M-111 | QR code generator for session sharing | ⬜ | Agent-M3 | M-110 | QR displays | react-native-qrcode-svg |
| M-112 | Real-time socket event handling (vote, reveal, round, join, leave) | ⬜ | Agent-M1 | M-042 | All events handled | Socket.io client |
| M-113 | Haptic feedback on vote/reveal | ⬜ | Agent-M3 | M-102 | Vibration fires | expo-haptics |

**Phase 2 Exit Criteria:**
- [ ] All P0 screens render with real API data
- [ ] Kanban board drag-and-drop works on both platforms
- [ ] Planning Poker session works end-to-end (create → join → vote → reveal → complete)
- [ ] Real-time voting with 2+ concurrent users
- [ ] Pull-to-refresh on all list screens
- [ ] Light/dark mode toggle works

---

## Phase 3: Extended Screens (Feature Parity - P1) ⬜

### 3A. Sprint Management

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-120 | SprintsScreen list with status filters | ⬜ | Agent-M2 | M-030 | List renders | sprint.list |
| M-121 | Create sprint bottom sheet (name, goal, dates) | ⬜ | Agent-M2 | M-058 | Creates sprint | Date picker |
| M-122 | Sprint detail (task board, burndown mini-chart) | ⬜ | Agent-M2 | M-091 | Board renders | sprint.getById |
| M-123 | Sprint status transitions (planning → active → completed) | ⬜ | Agent-M2 | M-120 | Status updates | sprint.update |

### 3B. Effort & Cost Analysis

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-130 | EffortScreen (project selector, hourly rate, contingency) | ⬜ | Agent-M2 | M-062 | Calculates effort | effort.calculate |
| M-131 | Roadmap timeline view (phases, weeks, tasks) | ⬜ | Agent-M2 | M-130 | Timeline renders | effort.roadmap |
| M-132 | Cost breakdown cards (by type, priority, status) | ⬜ | Agent-M2 | M-056 | Correct numbers | Collapsible sections |
| M-133 | Save analysis bottom sheet (name, assumptions, params) | ⬜ | Agent-M2 | M-058 | Saves analysis | effort.saveCurrentAnalysis |
| M-134 | Saved analyses list (edit, compare, delete) | ⬜ | Agent-M2 | M-130 | CRUD works | effort.listAnalyses |
| M-135 | AI analysis creation (provider, model, reasoning, text) | ⬜ | Agent-M2 | M-130 | AI generates | effort.createAiAnalysis |
| M-136 | Compare analyses screen (delta table) | ⬜ | Agent-M2 | M-134 | Comparison renders | effort.compareAnalyses |
| M-137 | Export analysis (JSON, CSV, Markdown share sheet) | ⬜ | Agent-M3 | M-134 | Share sheet opens | expo-sharing |
| M-138 | GitHub sync for analysis | ⬜ | Agent-M2 | M-134 | Syncs to issue | effort.syncAnalysisToGithub |
| M-139 | Kanban auto-apply roadmap | ⬜ | Agent-M2 | M-131 | Tasks updated | effort.applyRoadmap |

### 3C. Analytics & Charts

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-140 | AnalyticsScreen (project selector, overview metrics) | ⬜ | Agent-M2 | M-030 | Data loads | analytics.overview |
| M-141 | Task distribution pie chart | ⬜ | Agent-M2 | M-140 | Chart renders | react-native-svg |
| M-142 | Sprint velocity bar chart | ⬜ | Agent-M2 | M-140 | Chart renders | analytics.velocity |
| M-143 | Burndown/burnup line chart (30 days) | ⬜ | Agent-M2 | M-140 | Chart renders | analytics.burndown |
| M-144 | Estimation accuracy metrics | ⬜ | Agent-M2 | M-140 | Correct variance | analytics.accuracy |
| M-145 | Team bias analysis | ⬜ | Agent-M2 | M-140 | Bias displayed | analytics.teamBias |
| M-146 | Export analytics (share sheet: CSV, XLSX, PDF) | ⬜ | Agent-M3 | M-140 | Share opens | expo-sharing |

### 3D. Settings

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-150 | SettingsScreen layout (sections: auth, API keys, org, app) | ⬜ | Agent-M2 | M-020 | Renders correctly | ScrollView |
| M-151 | OpenAI OAuth flow (in-app browser) | ⬜ | Agent-M1 | M-022 | OAuth completes | expo-auth-session |
| M-152 | Anthropic OAuth flow | ⬜ | Agent-M1 | M-022 | OAuth completes | expo-auth-session |
| M-153 | API key manual entry (OpenAI, Anthropic, OpenRouter) | ⬜ | Agent-M2 | M-055 | Key saves | apiKeys.add |
| M-154 | Model selection with OpenRouter catalog search | ⬜ | Agent-M2 | M-062 | Catalog loads | apiKeys.listOpenRouterModels |
| M-155 | Organization settings | ⬜ | Agent-M2 | M-055 | Updates org | organization.update |
| M-156 | App settings (theme, notifications, biometric, language) | ⬜ | Agent-M2 | M-033 | Settings persist | MMKV store |
| M-157 | Sign out + account switch | ⬜ | Agent-M1 | M-022 | Sign out works | Clear all stores |

**Phase 3 Exit Criteria:**
- [ ] Sprint management CRUD works
- [ ] Effort calculation with roadmap visualization
- [ ] Cost analysis save/compare/export
- [ ] Charts render with real data on both platforms
- [ ] Settings: API keys and OAuth flows complete
- [ ] Export/share works via native share sheet

---

## Phase 4: Advanced Screens (Feature Parity - P2) ⬜

### 4A. Integrations

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-160 | IntegrationsScreen (GitHub, Jira connection cards) | ⬜ | Agent-M2 | M-030 | Cards render | integration.list |
| M-161 | GitHub OAuth in-app flow | ⬜ | Agent-M1 | M-022 | OAuth completes | expo-auth-session |
| M-162 | Jira OAuth in-app flow | ⬜ | Agent-M1 | M-022 | OAuth completes | expo-auth-session |
| M-163 | Multi-connection GitHub management | ⬜ | Agent-M2 | M-161 | List/disconnect | Per-account |
| M-164 | Disconnect integration | ⬜ | Agent-M2 | M-160 | Disconnects | integration.disconnect |

### 4B. Document Analyzer

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-170 | AnalyzerScreen (3 tabs: AI text, file upload, manual entry) | ⬜ | Agent-M2 | M-020 | Tabs render | |
| M-171 | AI text analysis input (large text area + context) | ⬜ | Agent-M2 | M-055 | Text submits | document.analyzeText |
| M-172 | File upload (document-picker → REST endpoint) | ⬜ | Agent-M3 | M-030 | Upload works | expo-document-picker |
| M-173 | Manual task entry (scrollable table) | ⬜ | Agent-M2 | M-055 | Table editable | Horizontal scroll |
| M-174 | Task review & approve screen (select/deselect, edit) | ⬜ | Agent-M2 | M-093 | Selection works | FlatList + checkboxes |
| M-175 | Save to project flow (new or existing project) | ⬜ | Agent-M2 | M-062 | Tasks save | project.create + task.create |

### 4C. Compare AI Providers

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-180 | CompareScreen (provider selection, text input) | ⬜ | Agent-M2 | M-055 | Submits compare | document.compare |
| M-181 | Comparison results (cards per provider) | ⬜ | Agent-M2 | M-056 | Results render | Winner badges |
| M-182 | Expandable task tables per provider | ⬜ | Agent-M2 | M-181 | Tables expand | Accordion |
| M-183 | Summary comparison (hours/cost/task ranges) | ⬜ | Agent-M2 | M-181 | Delta correct | Comparison bar |

**Phase 4 Exit Criteria:**
- [ ] GitHub/Jira OAuth flows work in-app
- [ ] Document analyzer accepts text, file upload, and manual entry
- [ ] AI provider comparison renders results
- [ ] All P2 features work end-to-end

---

## Phase 5: Mobile-Native Enhancements ⬜

### 5A. Push Notifications

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-200 | Push notification setup (expo-notifications) | ⬜ | Agent-M3 | M-010 | Notification received | FCM + APNs |
| M-201 | Device token registration API endpoint | ⬜ | Agent-A | M-200 | Token stored | New API endpoint |
| M-202 | Push: session invite notification | ⬜ | Agent-M3 | M-201 | Opens session | Deep link target |
| M-203 | Push: vote revealed notification | ⬜ | Agent-M3 | M-201 | Opens session | Socket fallback |
| M-204 | Push: task assigned notification | ⬜ | Agent-M3 | M-201 | Opens task | task.update trigger |
| M-205 | Push: sprint started notification | ⬜ | Agent-M3 | M-201 | Opens sprint | sprint.update trigger |
| M-206 | Notification preferences screen | ⬜ | Agent-M2 | M-156 | Toggle per type | MMKV store |
| M-207 | Badge count management | ⬜ | Agent-M3 | M-200 | Badge updates | expo-notifications |

### 5B. Offline Capabilities

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-210 | Offline task viewing (cached project/task data) | ⬜ | Agent-M1 | M-034 | Data shows offline | React Query cache |
| M-211 | Offline task creation (queued mutations) | ⬜ | Agent-M1 | M-036 | Creates when online | Mutation queue |
| M-212 | Offline estimation (local calculation) | ⬜ | Agent-M1 | M-018 | Calc works offline | estimation-core |
| M-213 | Sync indicator UI (online/offline/syncing) | ⬜ | Agent-M2 | M-035 | Status shows | Header indicator |
| M-214 | Conflict resolution UI (server vs local) | ⬜ | Agent-M2 | M-211 | User chooses | Bottom sheet |

### 5C. Platform-Specific Features

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-220 | iOS: Haptic feedback integration | ⬜ | Agent-M3 | M-010 | Haptics fire | expo-haptics |
| M-221 | iOS: Spotlight search integration | ⬜ | Agent-M3 | M-010 | Projects searchable | expo-spotlight |
| M-222 | iOS: Widget (today summary) | ⬜ | Agent-M3 | M-070 | Widget renders | expo-widget |
| M-223 | Android: Material You dynamic colors | ⬜ | Agent-M3 | M-050 | Theme adapts | Android 12+ |
| M-224 | Android: Shortcuts (new session, new task) | ⬜ | Agent-M3 | M-010 | Shortcuts work | expo-shortcuts |
| M-225 | Universal: Share extension (receive text → analyzer) | ⬜ | Agent-M3 | M-170 | Share works | Share target |
| M-226 | Universal: Camera for QR session join | ⬜ | Agent-M3 | M-110 | QR scans | expo-camera |

### 5D. Performance & UX Polish

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-230 | Reanimated animations (page transitions, card flips, reveals) | ⬜ | Agent-M2 | M-010 | 60fps animations | react-native-reanimated |
| M-231 | FlashList for large lists (tasks, sessions) | ⬜ | Agent-M2 | M-080 | No jank on 500+ items | @shopify/flash-list |
| M-232 | Image caching (expo-image) | ⬜ | Agent-M2 | M-063 | Fast image loads | |
| M-233 | App startup optimization (splash → ready < 2s) | ⬜ | Agent-M1 | All | Startup < 2s | expo-splash-screen |
| M-234 | Memory leak audit (Detox profiling) | ⬜ | Agent-M1 | All | No leaks | |
| M-235 | Keyboard avoiding views (all form screens) | ⬜ | Agent-M2 | M-055 | No overlap | KeyboardAvoidingView |
| M-236 | Accessibility audit (VoiceOver, TalkBack) | ⬜ | Agent-M2 | All | A11y passes | accessibilityLabel |

**Phase 5 Exit Criteria:**
- [ ] Push notifications work on both platforms
- [ ] Offline task viewing and creation
- [ ] Sync indicator visible in all screens
- [ ] Platform-specific features (haptics, widgets, shortcuts)
- [ ] Smooth 60fps animations
- [ ] Accessibility audit passed

---

## Phase 6: Testing & Quality ⬜

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-240 | Unit test setup (Jest + React Native Testing Library) | ⬜ | Agent-M1 | M-010 | Test runner works | |
| M-241 | Component unit tests (30+ components, 80%+ coverage) | ⬜ | Agent-M2 | M-240 | Coverage report | |
| M-242 | Store unit tests (Zustand stores) | ⬜ | Agent-M1 | M-240 | Store logic tested | |
| M-243 | API integration tests (tRPC client mock) | ⬜ | Agent-M1 | M-240 | API calls tested | MSW |
| M-244 | E2E test setup (Detox) | ⬜ | Agent-M3 | M-010 | Detox runs | iOS + Android |
| M-245 | E2E: Auth flow (sign-in, sign-up, sign-out) | ⬜ | Agent-M3 | M-244 | Flow passes | |
| M-246 | E2E: Project CRUD | ⬜ | Agent-M3 | M-244 | CRUD passes | |
| M-247 | E2E: Task CRUD + Kanban D&D | ⬜ | Agent-M3 | M-244 | D&D passes | |
| M-248 | E2E: Planning Poker session flow | ⬜ | Agent-M3 | M-244 | Full flow passes | |
| M-249 | E2E: Effort calculation + analysis save | ⬜ | Agent-M3 | M-244 | Flow passes | |
| M-250 | Performance benchmark (startup, scroll, render) | ⬜ | Agent-M1 | M-233 | Benchmarks pass | Flashlight |
| M-251 | Security audit (OWASP Mobile Top 10) | ⬜ | Agent-M3 | All | No critical issues | |

---

## Phase 7: Build, Deploy & Release ⬜

| # | Task | Status | Agent | Dependencies | Test | Notes |
|---|------|--------|-------|-------------|------|-------|
| M-260 | EAS Build configuration (development, preview, production) | ⬜ | Agent-M3 | M-015 | Builds succeed | eas.json |
| M-261 | iOS: App Store Connect setup (bundle ID, certificates, profiles) | ⬜ | Agent-M3 | M-260 | Build submittable | |
| M-262 | Android: Play Console setup (package name, signing key, listing) | ⬜ | Agent-M3 | M-260 | Build submittable | |
| M-263 | CI/CD pipeline (GitHub Actions → EAS Build → TestFlight/Internal Track) | ⬜ | Agent-M3 | M-260 | Auto-build on PR | .github/workflows/mobile.yml |
| M-264 | OTA update setup (expo-updates) | ⬜ | Agent-M3 | M-260 | OTA deploys | Critical bug fixes |
| M-265 | App Store screenshots + metadata | ⬜ | Agent-M2 | All | Screenshots ready | Both platforms |
| M-266 | TestFlight / Internal testing release | ⬜ | Agent-M3 | M-261, M-262 | Testers receive | Beta release |
| M-267 | Production release (App Store + Play Store) | ⬜ | Agent-M3 | M-266 | Apps published | v1.0.0 |
| M-268 | Crash reporting (Sentry React Native) | ⬜ | Agent-M3 | M-010 | Errors captured | @sentry/react-native |
| M-269 | Analytics SDK (PostHog / Mixpanel) | ⬜ | Agent-M3 | M-010 | Events tracked | Privacy-first |

---

## Decision Log (Mobile)

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| M-D1 | Expo SDK 53 + React Native 0.76 | Managed workflow, OTA updates, EAS Build, monorepo support | 2026-02-21 |
| M-D2 | React Navigation v7 (native stack + bottom tabs) | Best RN navigation, deep link support, type-safe | 2026-02-21 |
| M-D3 | Clerk Expo SDK for auth | Same auth provider as web, SSO parity, token sharing | 2026-02-21 |
| M-D4 | MMKV for local storage | 10x faster than AsyncStorage, encrypted, Zustand compatible | 2026-02-21 |
| M-D5 | Zustand + React Query + MMKV persist | Same state pattern as web, offline-first capable | 2026-02-21 |
| M-D6 | Socket.io client (not native WS) | Same protocol as web, auto-reconnect, room support | 2026-02-21 |
| M-D7 | react-native-reanimated for animations | 60fps native thread animations, gesture handler compat | 2026-02-21 |
| M-D8 | gorhom/bottom-sheet for modals | Gesture-driven, keyboard-aware, customizable | 2026-02-21 |
| M-D9 | Detox for E2E testing | Gray-box testing, CI-compatible, both platforms | 2026-02-21 |
| M-D10 | EAS Build + EAS Submit for CI/CD | Expo's managed build service, no local Xcode/Gradle needed | 2026-02-21 |
| M-D11 | @shopify/flash-list for large lists | Recycles views, handles 1000+ items, drop-in FlatList replacement | 2026-02-21 |
| M-D12 | expo-notifications for push | FCM + APNs unified, background handling, deep link integration | 2026-02-21 |

---

## Effort & Cost Estimation (Mobile App)

### Development Effort

| Phase | Effort (h) | Description |
|---|---:|---|
| Phase 0: Planning & Architecture | 40 | Tech decisions, architecture docs, design spec |
| Phase 1: Foundation | 160 | Expo scaffold, navigation, auth, tRPC, socket, offline infra |
| Phase 2: Core Screens (P0) | 320 | Design system + Home + Projects + Kanban + Sessions (RT) |
| Phase 3: Extended Screens (P1) | 240 | Sprints + Effort/Cost + Analytics + Settings |
| Phase 4: Advanced Screens (P2) | 160 | Integrations + Analyzer + Compare |
| Phase 5: Mobile-Native | 200 | Push, offline, platform features, performance, a11y |
| Phase 6: Testing & Quality | 120 | Unit + E2E + performance + security audit |
| Phase 7: Build & Release | 80 | EAS, App Store, Play Store, CI/CD, OTA, crash reporting |
| **Subtotal** | **1,320** | |
| **+20% Contingency** | **264** | |
| **Total** | **1,584 h** | |

### Cost Projection

| Rate | Total Cost |
|---|---|
| 900 TRY/h | 1,425,600 TRY |
| **1,200 TRY/h** | **1,900,800 TRY** |
| 1,500 TRY/h | 2,376,000 TRY |

### Timeline (Parallel Team)

| Phase | Duration | Parallel Notes |
|---|---|---|
| Phase 0 | Week 1 | Can start immediately |
| Phase 1 | Week 1-3 | Blocks all other phases |
| Phase 2 | Week 3-7 | Agent-M1 + Agent-M2 parallel |
| Phase 3 | Week 7-10 | Agent-M2 primary |
| Phase 4 | Week 10-12 | Agent-M2 + Agent-M3 parallel |
| Phase 5 | Week 12-15 | Agent-M3 primary, Agent-M2 polish |
| Phase 6 | Week 15-17 | All agents |
| Phase 7 | Week 17-19 | Agent-M3 primary |
| **Total** | **~19 weeks** | 3-agent mobile team |

---

## API Endpoints Required for Mobile

### Existing (Reusable from Web)

All 12 tRPC routers are fully reusable:
- `organization.*` (4 procedures)
- `project.*` (5 procedures)
- `task.*` (6 procedures)
- `team.*` (4 procedures)
- `session.*` (9 procedures)
- `sprint.*` (5 procedures)
- `ai.*` (3 procedures)
- `analytics.*` (8 procedures)
- `effort.*` (12 procedures)
- `integration.*` (10 procedures)
- `apiKeys.*` (6+ procedures)
- `document.*` (3+ procedures)

### New Endpoints Needed (Mobile-Specific)

| Endpoint | Purpose | Router |
|---|---|---|
| `device.registerPushToken` | Store FCM/APNs token per user/device | New `device` router |
| `device.unregisterPushToken` | Remove token on sign-out | New `device` router |
| `device.updatePreferences` | Push notification preferences | New `device` router |
| `notification.list` | In-app notification feed | New `notification` router |
| `notification.markRead` | Mark notification as read | New `notification` router |
| `notification.markAllRead` | Bulk mark read | New `notification` router |

### New DB Schema Needed

| Table | Fields | Purpose |
|---|---|---|
| `device_tokens` | id, user_id, platform (ios/android), token, device_name, created_at, updated_at | Push notification targets |
| `notifications` | id, user_id, organization_id, type, title, body, data (jsonb), read_at, created_at | In-app notification log |
| `notification_preferences` | id, user_id, session_invite, vote_revealed, task_assigned, sprint_started, created_at, updated_at | Per-user notification settings |

---

## File Structure (Mobile App)

```
apps/mobile/
├── app.config.ts                    # Expo config
├── eas.json                         # EAS Build profiles
├── index.ts                         # Entry point
├── metro.config.js                  # Metro bundler config
├── package.json
├── tsconfig.json
├── babel.config.js
├── .env.example
├── assets/
│   ├── icon.png                     # App icon (1024x1024)
│   ├── splash.png                   # Splash screen
│   ├── adaptive-icon.png            # Android adaptive icon
│   └── fonts/
│       └── Inter-*.ttf              # Self-hosted fonts
├── src/
│   ├── app.tsx                      # Root component (providers)
│   ├── navigation/
│   │   ├── root-navigator.tsx       # Auth guard (signed-in vs signed-out)
│   │   ├── auth-navigator.tsx       # Sign-in / Sign-up stack
│   │   ├── main-navigator.tsx       # Bottom tabs (Home, Projects, Sessions, More)
│   │   ├── project-navigator.tsx    # Project stack (list → detail → kanban)
│   │   ├── session-navigator.tsx    # Session stack (list → detail/poker)
│   │   ├── settings-navigator.tsx   # Settings stack
│   │   └── types.ts                 # Navigation type definitions
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── sign-in-screen.tsx
│   │   │   └── sign-up-screen.tsx
│   │   ├── home/
│   │   │   └── home-screen.tsx
│   │   ├── projects/
│   │   │   ├── projects-screen.tsx
│   │   │   ├── project-detail-screen.tsx
│   │   │   └── kanban-screen.tsx
│   │   ├── sessions/
│   │   │   ├── sessions-screen.tsx
│   │   │   ├── session-detail-screen.tsx
│   │   │   └── planning-poker-screen.tsx
│   │   ├── sprints/
│   │   │   └── sprints-screen.tsx
│   │   ├── effort/
│   │   │   ├── effort-screen.tsx
│   │   │   ├── roadmap-screen.tsx
│   │   │   └── cost-analysis-screen.tsx
│   │   ├── analytics/
│   │   │   └── analytics-screen.tsx
│   │   ├── integrations/
│   │   │   └── integrations-screen.tsx
│   │   ├── analyzer/
│   │   │   └── analyzer-screen.tsx
│   │   ├── compare/
│   │   │   └── compare-screen.tsx
│   │   └── settings/
│   │       └── settings-screen.tsx
│   ├── components/
│   │   ├── ui/                      # Base design system
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── bottom-sheet.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── icon.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── empty-state.tsx
│   │   │   ├── select.tsx
│   │   │   └── index.ts
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── screen-wrapper.tsx
│   │   │   └── sync-indicator.tsx
│   │   ├── project/
│   │   │   ├── project-card.tsx
│   │   │   └── create-project-sheet.tsx
│   │   ├── task/
│   │   │   ├── task-card.tsx
│   │   │   ├── task-detail-sheet.tsx
│   │   │   ├── create-task-sheet.tsx
│   │   │   └── estimation-presets.tsx
│   │   ├── session/
│   │   │   ├── poker-card.tsx
│   │   │   ├── poker-deck.tsx
│   │   │   ├── participant-card.tsx
│   │   │   ├── vote-metrics.tsx
│   │   │   ├── moderator-controls.tsx
│   │   │   └── qr-code.tsx
│   │   ├── kanban/
│   │   │   ├── kanban-board.tsx
│   │   │   ├── kanban-column.tsx
│   │   │   └── draggable-task.tsx
│   │   ├── chart/
│   │   │   ├── pie-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── line-chart.tsx
│   │   │   └── burndown-chart.tsx
│   │   └── effort/
│   │       ├── roadmap-timeline.tsx
│   │       ├── cost-breakdown.tsx
│   │       └── analysis-card.tsx
│   ├── stores/
│   │   ├── auth-store.ts
│   │   ├── project-store.ts
│   │   ├── session-store.ts
│   │   ├── settings-store.ts
│   │   └── notification-store.ts
│   ├── services/
│   │   ├── trpc-client.ts           # tRPC + React Query setup
│   │   ├── socket-client.ts         # Socket.io client
│   │   ├── storage.ts               # MMKV adapter
│   │   ├── push-notifications.ts    # Expo push setup
│   │   └── deep-linking.ts          # URL scheme handler
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-network.ts
│   │   ├── use-socket.ts
│   │   ├── use-push.ts
│   │   ├── use-theme.ts
│   │   ├── use-haptics.ts
│   │   └── use-offline-queue.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── shadows.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── format.ts
│   │   ├── date.ts
│   │   └── platform.ts
│   └── types/
│       └── navigation.ts
├── e2e/
│   ├── auth.e2e.ts
│   ├── projects.e2e.ts
│   ├── kanban.e2e.ts
│   ├── sessions.e2e.ts
│   └── effort.e2e.ts
└── __tests__/
    ├── components/
    ├── stores/
    └── services/
```

---

## Blockers & Risks

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Expo SDK 53 not yet released | Build pipeline blocked | Use SDK 52 LTS, upgrade when available | ⬜ Monitor |
| Socket.io reconnection on mobile | Session state loss | Exponential backoff + state resync on reconnect | ⬜ Phase 1 |
| Kanban D&D performance | Jank on large boards | FlashList + Reanimated, limit visible cards | ⬜ Phase 2 |
| iOS App Store review time | Release delay | Submit early, use TestFlight for beta | ⬜ Phase 7 |
| Offline mutation conflicts | Data inconsistency | Server-wins with user-visible conflict UI | ⬜ Phase 5 |
| Push notification deliverability | Missed notifications | FCM + APNs + in-app fallback | ⬜ Phase 5 |
| Metro bundler monorepo compat | Build failures | Custom metro config, watchFolders | ⬜ Phase 1 |
| Large chart rendering on mobile | Memory pressure | SVG-based charts, limit data points | ⬜ Phase 3 |

---

## Dependencies (Key Libraries)

| Library | Version | Purpose |
|---------|---------|---------|
| expo | ~53.0.0 | Managed workflow, native modules |
| react-native | 0.76.x | Core mobile framework |
| @clerk/clerk-expo | ^2.x | Authentication (same as web) |
| @trpc/client | ^11.x | Type-safe API client |
| @tanstack/react-query | ^5.x | Data fetching + cache |
| socket.io-client | ^4.x | Real-time sessions |
| zustand | ^5.x | State management |
| react-native-mmkv | ^3.x | Fast local storage |
| @react-navigation/native | ^7.x | Navigation framework |
| @react-navigation/native-stack | ^7.x | Stack navigator |
| @react-navigation/bottom-tabs | ^7.x | Tab navigator |
| react-native-reanimated | ^3.x | Animations (60fps) |
| react-native-gesture-handler | ^2.x | Gestures (swipe, pan) |
| @gorhom/bottom-sheet | ^5.x | Bottom sheet modals |
| @shopify/flash-list | ^1.x | Performant lists |
| expo-notifications | ~0.x | Push notifications |
| expo-secure-store | ~14.x | Encrypted key storage |
| expo-haptics | ~14.x | Haptic feedback |
| expo-document-picker | ~13.x | File upload |
| expo-sharing | ~13.x | Share sheet |
| expo-camera | ~16.x | QR code scanner |
| expo-local-authentication | ~15.x | Biometric unlock |
| react-native-svg | ^15.x | Chart rendering |
| react-native-qrcode-svg | ^6.x | QR generation |
| lucide-react-native | ^0.x | Icon system |
| @sentry/react-native | ^6.x | Crash reporting |
| detox | ^20.x | E2E testing |
| @testing-library/react-native | ^12.x | Component testing |

---

## Update Log

| Date | Update | By |
|------|--------|-----|
| 2026-02-21 | Mobile app tracker created with 186 tasks across 7 phases | Manager |
