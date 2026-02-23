# EstimatePro Mobile - Agent Guide

> This document supplements the main `CLAUDE.md` with mobile-specific conventions.
> All rules from `CLAUDE.md` still apply. This document adds mobile-only rules.

## Mobile Architecture

```
apps/mobile/                          # Expo + React Native
├── src/
│   ├── navigation/                   # React Navigation v7
│   ├── screens/                      # Screen components (1 per route)
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Design system primitives
│   │   ├── layout/                   # Layout wrappers
│   │   ├── project/                  # Domain: project
│   │   ├── task/                     # Domain: task
│   │   ├── session/                  # Domain: session/poker
│   │   ├── kanban/                   # Domain: kanban board
│   │   ├── chart/                    # Domain: analytics charts
│   │   └── effort/                   # Domain: effort/cost
│   ├── stores/                       # Zustand stores (MMKV persisted)
│   ├── services/                     # API client, socket, push, storage
│   ├── hooks/                        # Custom React hooks
│   ├── theme/                        # Design tokens
│   ├── utils/                        # Pure utility functions
│   └── types/                        # Mobile-specific types
├── e2e/                              # Detox E2E tests
└── __tests__/                        # Unit tests (RNTL)
```

## Tech Stack (Mobile)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Expo SDK | 53 |
| Runtime | React Native | 0.76 |
| Navigation | React Navigation | v7 |
| Auth | Clerk Expo SDK | latest |
| API Client | tRPC + React Query | v11 / v5 |
| Real-Time | Socket.io Client | v4 |
| State | Zustand | v5 |
| Storage | MMKV | v3 |
| Animations | Reanimated | v3 |
| Lists | FlashList | v1 |
| Modals | gorhom/bottom-sheet | v5 |
| Charts | react-native-svg | v15 |
| Push | expo-notifications | latest |
| E2E Test | Detox | v20 |
| Unit Test | Jest + RNTL | latest |
| Build | EAS Build | latest |
| Icons | lucide-react-native | latest |

## Coding Conventions (Mobile-Specific)

### File Naming
```
# Screens: kebab-case + -screen suffix
screens/home/home-screen.tsx
screens/projects/project-detail-screen.tsx

# Components: kebab-case (same as web)
components/ui/button.tsx
components/task/task-card.tsx

# Stores: kebab-case + -store suffix
stores/auth-store.ts
stores/project-store.ts

# Hooks: use- prefix, kebab-case
hooks/use-auth.ts
hooks/use-socket.ts

# Services: kebab-case
services/trpc-client.ts
services/socket-client.ts

# Tests: co-located or __tests__/
__tests__/components/button.test.tsx
screens/home/__tests__/home-screen.test.tsx
```

### Screen Component Pattern
```typescript
// REQUIRED pattern for all screens
import { ScreenWrapper } from '@/components/layout/screen-wrapper';

export function ProjectsScreen(): React.ReactElement {
  // 1. Navigation hooks
  const navigation = useNavigation<ProjectsScreenNavigationProp>();
  const route = useRoute<ProjectsScreenRouteProp>();

  // 2. Auth/store hooks
  const { userId, orgId } = useAuth();

  // 3. API queries
  const projectsQuery = trpc.project.list.useQuery({ organizationId: orgId });

  // 4. Local state
  const [searchText, setSearchText] = useState('');

  // 5. Derived data
  const filteredProjects = useMemo(() => ..., [projectsQuery.data, searchText]);

  // 6. Event handlers
  const handleCreateProject = useCallback(() => ..., []);

  // 7. Render
  return (
    <ScreenWrapper>
      {/* Screen content */}
    </ScreenWrapper>
  );
}
```

### Navigation Type Safety
```typescript
// REQUIRED: All navigation params must be typed
// src/navigation/types.ts

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Projects: undefined;
  Sessions: undefined;
  More: undefined;
};

export type ProjectStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string };
  Kanban: { projectId: string };
};

export type SessionStackParamList = {
  SessionsList: undefined;
  SessionDetail: { sessionId: string };
  PlanningPoker: { sessionId: string };
};

// Usage:
type ProjectDetailScreenNavigationProp = NativeStackNavigationProp<
  ProjectStackParamList,
  'ProjectDetail'
>;
```

### API Client Pattern
```typescript
// REQUIRED: Use tRPC hooks in screens, not raw fetch
// services/trpc-client.ts provides typed client

// Queries (auto-cache, auto-refetch)
const { data, isLoading, error, refetch } = trpc.project.list.useQuery(
  { organizationId: orgId },
  { enabled: !!orgId }
);

// Mutations (with optimistic update)
const createMutation = trpc.task.create.useMutation({
  onSuccess: () => {
    utils.task.list.invalidate();
  },
});

// FORBIDDEN: Direct fetch() calls to API
// FORBIDDEN: axios or other HTTP clients
```

### State Management Rules
```typescript
// Zustand stores: only for cross-screen state
// React Query: for all server state (API data)
// useState: for component-local state
// MMKV: for persisted settings/preferences

// FORBIDDEN: Redux
// FORBIDDEN: Context API for global state
// FORBIDDEN: AsyncStorage (use MMKV instead)
```

### Bottom Sheet Pattern
```typescript
// REQUIRED: Use gorhom/bottom-sheet for all modal-like UIs
// FORBIDDEN: React Native Modal component (poor UX)
// FORBIDDEN: Alert.alert for complex inputs

import BottomSheet from '@gorhom/bottom-sheet';

const bottomSheetRef = useRef<BottomSheet>(null);
const snapPoints = useMemo(() => ['50%', '90%'], []);

<BottomSheet
  ref={bottomSheetRef}
  index={-1}
  snapPoints={snapPoints}
  enablePanDownToClose
>
  {/* Sheet content */}
</BottomSheet>
```

### Socket.io Event Pattern
```typescript
// REQUIRED: Use hooks for socket events in screens
// hooks/use-socket.ts provides typed socket client

function useSessionSocket(sessionId: string) {
  const socket = useSocket();

  useEffect(() => {
    socket.emit('join-session', { sessionId, userId });

    socket.on('vote-submitted', handleVote);
    socket.on('votes-revealed', handleReveal);
    socket.on('new-round-started', handleNewRound);
    socket.on('participant-joined', handleJoin);
    socket.on('participant-left', handleLeave);

    return () => {
      socket.emit('leave-session', { sessionId, userId });
      socket.off('vote-submitted');
      socket.off('votes-revealed');
      socket.off('new-round-started');
      socket.off('participant-joined');
      socket.off('participant-left');
    };
  }, [sessionId]);

  return { socket };
}
```

### Animation Rules
```typescript
// REQUIRED: Use Reanimated for all animations
// REQUIRED: Run animations on UI thread (worklets)
// FORBIDDEN: Animated API from react-native (JS thread)
// FORBIDDEN: LayoutAnimation (unpredictable)

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const scale = useSharedValue(1);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }],
}));
```

### List Performance Rules
```typescript
// REQUIRED: Use FlashList for lists with 20+ items
// REQUIRED: Set estimatedItemSize for FlashList
// FORBIDDEN: ScrollView for dynamic lists
// FORBIDDEN: FlatList for 50+ items (use FlashList)

import { FlashList } from '@shopify/flash-list';

<FlashList
  data={tasks}
  renderItem={renderTask}
  estimatedItemSize={80}
  keyExtractor={(item) => item.id}
/>
```

### Offline-First Rules
```typescript
// 1. React Query persists cache to MMKV
// 2. Queries always show cached data first (staleTime: 5min)
// 3. Mutations queue when offline
// 4. Sync indicator shows pending mutations count
// 5. Server-wins conflict resolution (user sees diff)

// FORBIDDEN: Blocking UI while waiting for network
// REQUIRED: Always show cached data if available
```

### Platform Checks
```typescript
// Use Platform.select for platform differences
import { Platform } from 'react-native';

const shadowStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 4 },
});

// FORBIDDEN: Separate .ios.tsx/.android.tsx files (use Platform.select)
// EXCEPTION: Native module bridges that require platform files
```

## Testing Requirements (Mobile)

### Unit Tests (Jest + RNTL)
- Minimum **80%** code coverage
- Co-located: `__tests__/` next to source
- Mock native modules in `jest.setup.ts`
- Test component rendering, user interactions, store logic

### E2E Tests (Detox)
- Located in `apps/mobile/e2e/`
- Test critical flows:
  - Auth (sign-in, sign-out)
  - Project CRUD
  - Kanban drag-and-drop
  - Planning Poker session
  - Effort calculation

### Running Tests
```bash
pnpm mobile:test              # Unit tests
pnpm mobile:test:coverage     # With coverage
pnpm mobile:e2e:ios           # Detox iOS
pnpm mobile:e2e:android       # Detox Android
```

## Mobile Command Reference

```bash
# Development
pnpm mobile:dev               # Start Expo dev server
pnpm mobile:ios               # Run on iOS simulator
pnpm mobile:android           # Run on Android emulator

# Build
pnpm mobile:build:dev         # EAS development build
pnpm mobile:build:preview     # EAS preview build
pnpm mobile:build:prod        # EAS production build

# Testing
pnpm mobile:test              # Jest unit tests
pnpm mobile:test:coverage     # With coverage
pnpm mobile:e2e:ios           # Detox E2E (iOS)
pnpm mobile:e2e:android       # Detox E2E (Android)

# Code Quality
pnpm mobile:lint              # ESLint (RN rules)
pnpm mobile:typecheck         # TypeScript check
pnpm mobile:format            # Prettier

# Release
pnpm mobile:submit:ios        # EAS Submit to App Store
pnpm mobile:submit:android    # EAS Submit to Play Store
pnpm mobile:update            # OTA update (expo-updates)
```

## Security Guidelines (Mobile-Specific)

- Tokens stored in `expo-secure-store` (Keychain/Keystore), never MMKV
- Certificate pinning for API requests (production only)
- Jailbreak/root detection warning (not blocking)
- No sensitive data in React Query cache (use secure store)
- Biometric auth gate for re-authentication after background
- ProGuard/R8 obfuscation enabled for Android release builds
- App Transport Security (ATS) enabled for iOS

## Shared Package Compatibility

| Package | Mobile Compatible | Notes |
|---------|------------------|-------|
| `@estimate-pro/types` | ✅ | Pure Zod schemas, no platform deps |
| `@estimate-pro/errors` | ✅ | Pure TS, no platform deps |
| `@estimate-pro/estimation-core` | ✅ | Pure TS algorithms, no platform deps |
| `@estimate-pro/db` | ❌ | Server-only (PostgreSQL) |
| `@estimate-pro/ui` | ❌ | Web-only (shadcn/ui, DOM) |
| `@estimate-pro/eslint-config` | ⚠️ | Need RN-specific config |
| `@estimate-pro/typescript-config` | ⚠️ | Need RN-specific preset |

## Import Order (Mobile)
```typescript
// 1. React / React Native
import React, { useState, useCallback } from 'react';
import { View, Text, Platform } from 'react-native';

// 2. External packages
import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';

// 3. Internal packages (monorepo)
import type { Project } from '@estimate-pro/types';
import { PlanningPoker } from '@estimate-pro/estimation-core';

// 4. App-level imports
import { trpc } from '@/services/trpc-client';
import { useAuth } from '@/hooks/use-auth';

// 5. Relative imports
import { ProjectCard } from './components/project-card';

// 6. Type-only imports
import type { ProjectsScreenNavigationProp } from '@/navigation/types';
```
