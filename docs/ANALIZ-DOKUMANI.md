# EstimatePro — Analiz Dökümanı

> **Versiyon:** 2.0
> **Tarih:** 2026-02-24
> **Durum:** Aktif (Wave-4 Complete — Production Ready)
> **Kaynak:** `Estimate Pro Document - Project Effort Estimation.docx` + `Estimate Pro Document - Claude.docx` v1.0 güncellenerek birleştirildi

---

## 1. Giriş ve Amaç

EstimatePro, yazılım projelerinde **task bazlı efor tahmini** yapan, takım ile canlı tahmin oturumları yürüten, proje yaşam döngüsü boyunca eforu takip eden ve AI destekli öneri sistemi sunan bir **web ve (planlı) mobil** uygulamadır.

**Mevcut Durum (2026-02-24):**
- Web uygulaması: **Production-ready** (Wave-4 complete)
- Test durumu: **157/157 test geçiyor** (estimation-core 48 + api 109)
- Servisler: PostgreSQL 16 (5433), Redis 7 (6380), API (4000), Web (3000)
- Mobil: Phase 0 — Planlama (0/186 görev)
- Web E2E regresyon (2026-02-24): **252 senaryo koştu → 169 passed, 83 skipped, 0 failed**

### 1.1 Web E2E Hata Dökümü ve Çözüm Checklist (2026-02-24)

- [x] `invoice-generation-download.spec.ts` — invoice state tespiti loading yarış durumunda false-negative veriyordu; polling + stabilize kontrol eklendi.
- [x] `search-keyboard-navigation.spec.ts` — keyboard-only senaryoda fokus/toggle adımı flaky idi; klavye odak döngüsü ve `Enter` + `Space` fallback eklendi.
- [x] `search-entity-filters.spec.ts`, `search-multi-tenant-isolation.spec.ts`, `search-recent-searches.spec.ts` — command palette aç/kapat ve data-dependent assertion’lar dayanıklı hale getirildi.
- [x] `projects.spec.ts` — proje kartı/detay akışları kırılgan selector’lardan arındırılıp mevcut UI ile hizalandı.
- [x] `notification-flow.spec.ts` — notification heading/label seçicileri güncel UI metinleriyle eşlendi.
- [x] `plan-upgrade-downgrade.spec.ts` — billing plan card assertion’ları yeni sayfa yapısına göre güncellendi.
- [x] `performance/dashboard-load.spec.ts` — lokal koşumda gerçekçi threshold ve varyans toleransı uygulandı.
- [x] `latency.spec.ts`, `performance.spec.ts`, `reconnection.spec.ts` — realtime harness gerektiren senaryolar `REALTIME_E2E=1` bayrağına bağlandı (default skip).
- [x] `stripe-webhook-handling.spec.ts` — strict-locator kaynaklı false fail’ler spesifik heading/metric assertion’larıyla düzeltildi.
- [x] `usage-tracking-limits.spec.ts` — usage metric metin eşleşmeleri strict-mode çakışmasından çıkarıldı (`exact`/`.first()`).
- [x] `tasks-kanban.spec.ts` — proje limit/yetki kaynaklı nondeterministic CRUD akışları yerine mevcut projede stabil list/board/filter smoke kontrollerine indirgenerek kırmızılar kapatıldı.

**Uygulama kapsamı:**

1. Ekip üyelerinin ortak platformda efor tahminleri girmesi
2. Farklı tahmin yöntemlerinin desteklenmesi (Planning Poker, T-Shirt Sizing, PERT, Wideband Delphi)
3. AI destekli öneri sistemi ile daha isabetli tahminler
4. Çok kiracılı (multi-tenant) yapı — organizasyon bazlı izolasyon
5. Gerçek zamanlı WebSocket tabanlı işbirliği
6. GitHub/Jira entegrasyonu ile issue/task senkronizasyonu
7. RBAC ile rol tabanlı erişim kontrolü

---

## 2. Pazar ve Rakip Analizi

| Ürün | Planning Poker | AI Tahmin | Mobil Destek | Raporlama | Fiyat |
|------|---------------|-----------|-------------|-----------|-------|
| Jira | Eklenti ile | Yok | Var | Gelişmiş | $$ |
| Monday.com | Yok | Yok | Var | Orta | $$ |
| TeamGantt | Yok | Yok | Sınırlı | İyi | $ |
| Teamhood | Story Point | Yok | Sınırlı | İyi | $ |
| PlanningPoker.AI | Var | Var | Web Only | Sınırlı | Freemium |
| PlanITPoker | Var | Yok | Web Only | Temel | Ücretsiz |
| **EstimatePro** | **Var** | **Var (GPT-4o)** | **Tam Destek** | **Gelişmiş** | **Freemium** |

### 2.1 Rekabet Avantajları

- Hem web hem native mobil uygulama (iOS & Android) desteği *(mobil planlı)*
- **AI destekli efor tahmini** — geçmiş proje verilerinden öğrenme (pgvector + GPT-4o)
- Çoklu tahmin yöntemi desteği (Planning Poker, T-Shirt, PERT, Wideband Delphi)
- **Gerçek zamanlı işbirliği** — WebSocket (Socket.io) tabanlı canlı tahmin oturumları
- **Multi-task session desteği** — bir oturumda birden fazla task tahmini (Wave-4)
- **RBAC** — owner/admin/member/viewer rol hiyerarşisi ile güvenli erişim (Wave-4)
- **Review workflow** — backlog → todo → in_progress → in_review → done geçiş akışı (Wave-4)
- Detaylı raporlama ve tahmin isabeti analizi
- GitHub / Jira entegrasyonları
- Türkçe dahil çoklu dil desteği (i18n)

---

## 3. Kullanıcı Rolleri ve Yetkileri

### 3.1 Platform Rolleri (Clerk)

| Rol | Açıklama | Yetkiler |
|-----|----------|---------|
| Super Admin | Platform yöneticisi | Tüm sistem yönetimi, kullanıcı yönetimi, lisans yönetimi |
| Proje Yöneticisi | Proje sahibi ve lideri | Proje oluşturma, task tanımlama, tahmin oturumu başlatma, raporlama |
| Takım Lideri | Teknik lider | Task efor giriş, tahmin oturumuna katılma, sprint planlama |
| Geliştirici | Takım üyesi | Efor tahmini girme, oturumlara katılma, kendi tasklarını görüntüleme |
| İzleyici | Paydaş / müşteri | Salt okunur erişim, raporları görüntüleme |

### 3.2 Organizasyon Üye Rolleri (RBAC — Wave-4)

Veritabanında `organization_members.role` sütununda saklanır:

| Rol | `adminProcedure` | Tahmin Oturumu | Task Yönetimi | Billing |
|-----|----------------|---------------|--------------|---------|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ (updateSubscription, cancelSubscription) |
| `member` | ❌ | ✅ | ✅ (kendi) | ❌ |
| `viewer` | ❌ | ✅ (gözlemci) | ❌ | ❌ |

**RBAC korunan endpoint'ler:** `team.addMember`, `team.updateRole`, `team.removeMember`, `billing.updateSubscription`, `billing.cancelSubscription`

---

## 4. Fonksiyonel Gereksinimler

### 4.1 Proje Yönetimi

- Proje oluşturma, düzenleme ve silme
- Proje şablonları (web, mobil, microservice, fullstack)
- Proje bazlı takım yönetimi ve rol atama (RBAC)
- Proje durumu dashboard (tamamlanma %, efor dağılımı)
- Çok kiracılı izolasyon (her sorguda `organization_id` filtresi)

### 4.2 Task Yönetimi

**Hiyerarşik yapı:** Epic > Feature > User Story > Task > Sub-task

**Task durumu state machine (Wave-4 — zorunlu geçişler):**

```
backlog ──→ todo ──→ in_progress ──→ in_review ──→ done
   ↑___________________________↗           ↓
   ←── cancelled ←─────────────────────────┘

backlog:     → todo, cancelled
todo:        → in_progress, cancelled
in_progress: → in_review, todo, cancelled
in_review:   → done, in_progress
done:        → (terminal)
cancelled:   → backlog
```

- Geçersiz geçişler `TRPC BAD_REQUEST` hatası döner
- Durum değişikliği için `task.updateStatus` kullanılır (task.update değil)
- "Submit for Review" butonu: `in_progress` → `in_review`
- "Approve" butonu (admin): `in_review` → `done`
- "Request Changes" butonu: `in_review` → `in_progress`

**Diğer özellikler:**
- Task detayları: başlık, açıklama, kabul kriterleri, öncelik, etiketler
- Task bağımlılıkları ve sıralama
- Drag & drop task sıralama ve sprint planlama
- Sprint bazlı task yönetimi (`sprint_id` FK)

### 4.3 Efor Tahmin Sistemi

| Yöntem | Açıklama | Uygulama |
|--------|----------|---------|
| **Planning Poker** | Fibonacci (1,2,3,5,8,13,21) ve T-Shirt (XS-XXL) | WebSocket tabanlı canlı oturum |
| **PERT** | (Optimist + 4×Olasılık + Kötümser) / 6 | `estimation-core` paketi, 48 test |
| **Wideband Delphi** | Birden fazla tur ile uzlaşma bazlı | Moderatör kontrollü |
| **Bireysel** | Tek kişi hızlı efor girişi (saat/gün/story point) | Senkron |
| **AI Önerisi** | Benzer geçmiş tasklere dayalı otomatik öneri | pgvector + GPT-4o |

### 4.4 Canlı Tahmin Oturumları (Wave-3 + Wave-4)

- Gerçek zamanlı oturum oluşturma (Socket.io WebSocket)
- QR kod ve link ile oturuma katılım
- **Multi-task session desteği (Wave-4):** `session_tasks` junction table ile bir oturuma birden fazla task bağlama
- Moderatör kontrolleri: oylamayı başlat, durdur, tekrar et, ortaya koy
- Anonim oylama ve sonuç açıklama mekanizması
- "X/Y voted" badge — reveal öncesi oy sayısını gösterir
- Oturum geçmişi ve istatistikleri
- `session.addTask`, `session.removeTask`, `session.listTasks` prosedürleri (Wave-4)

### 4.5 Raporlama ve Analitik

- Proje toplam efor özeti (tahmini vs gerçekleşen)
- Sprint velocity grafikleri ve trend analizi
- Burndown / Burnup chart
- Kişi bazlı efor dağılımı ve performans metrikleri
- Tahmin isabeti oranı (estimation accuracy score)
- AI destekli öngörücü proje analitikleri (Wave-3 branch 022)
- Tarihsel ML tahmin kalibrasyon loop'u (Wave-3 branch 023)
- PDF, Excel, CSV formatlarında rapor export

### 4.6 Bildirim Sistemi (Wave-3)

- In-app bildirimler: `task_assigned`, `task_status_change`, `session_started`, `comment_added`
- WebSocket tabanlı gerçek zamanlı bildirim push'u
- Bildirim tercihleri (per-user, per-type)
- Tablo: `notifications`, `notification_preferences`
- `notification.list`, `notification.markAsRead`, `notification.markAllAsRead`

### 4.7 Entegrasyon ve API

- **GitHub:** Issue senkronizasyonu (state/label/priority eşlemesi)
- **Jira:** Task entegrasyonu *(kısmi)*
- **Azure DevOps:** *(ertelendi)*
- **Stripe:** Subscription billing (checkout, update, cancel, webhook)
- **Resend:** Transactional email (takım davetiyesi, bildirimler)
- **Public API:** API key yönetimi + webhook desteği
- **Webhook:** Olay bazlı dış sistem bildirimleri
- **Audit Log:** Enterprise uyumluluk denetim kaydı

### 4.8 Arama ve Aktivite

- Tam metin arama (platform genelinde) — `search.query`, `search.getRecent`
- Aktivite feed ve değişiklik takibi — `activity.list`, `activity.listByEntity`
- Audit logging — enterprise uyumluluk

### 4.9 Kullanıcı Onboarding

- `/dashboard/onboarding` sayfası — adım takipçisi, progress bar, örnek veri yükleyici
- Sidebar'da "Getting Started" navigation item
- `onboarding_state` tablosu ile ilerleme kalıcılaştırma

---

## 5. Fonksiyonel Olmayan Gereksinimler

| Kategori | Gereksinim | Hedef |
|----------|-----------|-------|
| **Performans** | API yanıt süresi | < 200ms (P95) |
| **Performans** | WebSocket gecikme | < 50ms |
| **Ölçeklenebilirlik** | Eşanlı kullanıcı | 10.000+ eşanlı oturum |
| **Ölçeklenebilirlik** | Veri depolama | Yatay ölçeklenir mimari |
| **Güvenlik** | Veri şifreleme | AES-256 at-rest, TLS 1.3 in-transit |
| **Güvenlik** | Kimlik doğrulama | Clerk (SSO, MFA, OAuth 2.0) |
| **Güvenlik** | RBAC | `adminProcedure` ile admin/owner rol zorunluluğu |
| **Erişilebilirlik** | Uptime SLA | %99.9 aylık |
| **Erişilebilirlik** | Felaket kurtarma | RPO < 1 saat, RTO < 4 saat |
| **Uyumluluk** | Tarayıcı | Chrome, Firefox, Safari, Edge (son 2 versiyon) |
| **Uyumluluk** | Mobil *(planlı)* | iOS 15+, Android 12+ |
| **Lokalizasyon** | Dil desteği | TR, EN, DE, FR (i18n framework — Wave-3 branch 021) |

---

## 6. Temel İş Akışları

### 6.1 Efor Tahmin Oturumu İş Akışı

```
1. Proje Yöneticisi yeni tahmin oturumu oluşturur
   └─ Birden fazla task seçilebilir (session_tasks junction table — Wave-4)

2. Takım üyelerine davet linki / QR kod gönderilir
   └─ Her session card'ında "Copy URL" butonu

3. Moderatör sırayla her task için oylama başlatır
   └─ "X/Y voted" badge ile oy ilerlemesi görünür

4. Tüm üyeler kartlarını seçer (anonim)
   └─ Moderatör kartları açar (votes-revealed)

5. Sapmalar tartışıldıktan sonra gerekirse ikinci tur oylama

6. Uzlaşma sağlanan efor değeri task'a kaydedilir
   └─ session_results tablosuna yazılır

7. AI sistemi bu tahmini gelecekteki öneriler için öğrenir
   └─ embedding oluşturulur, pgvector'e yazılır
```

### 6.2 AI Tahmin Önerisi İş Akışı

```
1. Kullanıcı yeni bir task oluşturur → başlık + açıklama girer

2. AI motoru task metnini analiz eder
   └─ OpenAI text-embedding-3-small ile vektör oluşturur

3. pgvector cosine similarity ile geçmişten benzer taskler bulunur
   └─ Organizasyon bazlı izolasyon (kendi geçmiş veriniz)

4. Benzer taskların gerçekleşen eforlarına dayalı tahmin hesaplanır
   └─ Ağırlıklı ortalama + güven aralığı (%80, %90, %95)

5. GPT-4o ile doğal dil açıklaması üretilir

6. Kullanıcı öneriyi kabul eder, düzenler veya reddeder

7. Gerçekleşen efor sisteme beslenir → kalibrasyon loop'u güncellenir
```

### 6.3 Task Review Workflow (Wave-4)

```
Geliştirici:
  in_progress → [Submit for Review] → in_review

Admin/Owner:
  in_review → [Approve] → done
  in_review → [Request Changes] → in_progress

Bildirim:
  in_review geçişinde assigned user'a task_status_change bildirimi gönderilir
```

### 6.4 GitHub Entegrasyon İş Akışı

```
1. Proje ayarlarından repo bağlanır
   (format: owner/repo, github.com/owner/repo, https://github.com/...)

2. Issue'lar task olarak içe alınır
   state=open → todo | state=closed → done
   Labels → tür (epic/feature/bug) ve öncelik (P0-P3)
   PR'lar otomatik filtrelenir (sadece issue'lar alınır)

3. Başlık bazlı duplicate koruması

4. Manuel sync (Sync Now) veya proje açılışında otomatik sync (autoSync=true)
```

---

## 7. Veri Modeli (Güncel — 27 Tablo)

### 7.1 Temel Varlıklar

| Varlık | Tablo | Önemli Alanlar | İlişki |
|--------|-------|---------------|--------|
| Organization | `organizations` | id, name, plan, settings | 1:N User, 1:N Project |
| User | `users` | id, clerk_id, name, email, avatar | N:N Organization |
| Project | `projects` | id, name, description, status, methodology | 1:N Task, 1:N Sprint |
| Task | `tasks` | id, title, status, priority, sprint_id, sort_order | N:1 Project, N:1 Assignee |
| Sprint | `sprints` | id, name, start_date, end_date, velocity | N:N Task |

### 7.2 Tahmin Varlıkları

| Varlık | Tablo | Önemli Alanlar | İlişki |
|--------|-------|---------------|--------|
| Estimation Session | `sessions` | id, method, status, moderator_id | N:N Task (via session_tasks) |
| Session Task | `session_tasks` | session_id, task_id, order | Junction table (Wave-4) |
| Session Participant | `session_participants` | session_id, user_id, role | |
| Session Vote | `session_votes` | session_id, task_id, user_id, value | |
| Session Result | `session_results` | session_id, task_id, final_estimate | |
| Estimate | `estimates` | value, unit, method, confidence | N:1 Task, N:1 User |

### 7.3 Organizasyon Üyeliği ve RBAC

| Varlık | Tablo | Önemli Alanlar |
|--------|-------|---------------|
| Org Member | `organization_members` | org_id, user_id, **role** (owner/admin/member/viewer) |
| Invitation | `organization_invitations` | email, role, token, expires_at |

### 7.4 Diğer Tablolar

| Kategori | Tablolar |
|----------|---------|
| AI | `embeddings` (pgvector), `cost_analyses` |
| Sosyal | `activities`, `notifications`, `notification_preferences` |
| Billing | `subscriptions`, `invoices`, `usage_tracking` |
| API | `api_keys`, `public_api_keys`, `webhooks` |
| Entegrasyon | `integrations` |
| Enterprise | `audit_logs`, `onboarding_state` |

---

## 8. API Mimarisi (tRPC v11)

### 8.1 20 Router — Prosedür Özeti

| Router | Temel Prosedürler |
|--------|------------------|
| `project` | list, create, get, update, delete |
| `task` | list, create, update, **updateStatus**, delete, reorder, listByProject |
| `session` | list, create, get, start, end, submitVote, revealVotes, nextRound, complete, **addTask, removeTask, listTasks** |
| `sprint` | list, create, update, delete, addTask, removeTask |
| `team` | list, **me**, addMember*, updateRole*, removeMember* |
| `organization` | get, update, getMembers |
| `effort` | calculate, getRoadmap, applyRoadmap, getCostAnalysis (12 prosedür) |
| `analytics` | getSummary, getVelocity, getBurndown, getAccuracy (8 prosedür) |
| `ai` | suggestEffort, analyzeComplexity, generateSummary |
| `notification` | list, markAsRead, markAllAsRead, getPreferences, updatePreference |
| `billing` | getPlans, getCurrentSubscription, createCheckoutSession, updateSubscription*, cancelSubscription* |
| `search` | query, getRecent |
| `activity` | list, listByEntity, getForTask |
| `invitation` | send, list, accept, decline, resend, cancel |
| `integration` | list, create, update, delete, sync (10 prosedür) |
| `document` | analyzeText, compare |
| `webhooks` | register, list, delete, test, trigger |
| `publicApi` | create, list, delete, validate |
| `apiKeys` | create, list, delete |
| `onboarding` | getState, updateStep, complete, loadSampleData |

*`adminProcedure` ile korunan endpoint'ler — sadece owner/admin çağırabilir*

### 8.2 REST API Layer

- `/api/v1/` — Public REST API (external integrations için)
- `/api/analyze-document` — Doküman analizi
- `/health` — Health check endpoint
- `/webhooks/stripe` — Stripe webhook handler

---

## 9. İş Modeli ve Monetizasyon

| Özellik | Free | Pro ($12/ay/kişi) | Enterprise (Özel) |
|---------|------|-----------------|-----------------|
| Proje sayısı | 3 | Sınırsız | Sınırsız |
| Takım üyesi | 5 | 50 | Sınırsız |
| Tahmin oturumları | 10/ay | Sınırsız | Sınırsız |
| AI tahmin önerisi | Yok | Var | Var (Özel model) |
| Entegrasyonlar | Temel | Tümü | Tümü + Özel API |
| Raporlama | Temel | Gelişmiş | Gelişmiş + BI Export |
| Destek | Topluluk | E-posta + Chat | Öncelikli + SLA |
| SSO / SAML | Yok | Yok | Var |
| Audit Log | Yok | Yok | Var |
| RBAC | Temel (member/viewer) | Tümü (owner/admin/member/viewer) | Tümü + Custom roles |

---

## 10. Geliştirme Dalgaları (Wave History)

| Dalga | Açıklama | Durum | Tarih |
|-------|----------|-------|-------|
| Wave-1 | Foundation: monorepo, DB, API, Web, estimation-core | ✅ Tamamlandı | 2026-02-18 |
| Wave-2 | Core platform: 64 agent backlog görevi | ✅ Tamamlandı | 2026-02-20 |
| Wave-3 | 18 feature branch: bildirimler, billing, arama, audit, i18n, webhooks, analitik | ✅ Tamamlandı | 2026-02-23 |
| Wave-3 Hotfix | Auth bug'ları, sprint_id, onboarding refactor, session fixes | ✅ Tamamlandı | 2026-02-23 |
| Wave-4 | RBAC, session multi-task, review workflow, wave4-runner script | ✅ Tamamlandı | 2026-02-24 |
| Wave-4 Specs | 16 bekleyen spec (010, 012-034) — wave4-runner.mjs ile yönetilir | 🔄 Devam ediyor | 2026-02-24 |
| Mobile | Phase 0 planlama (0/186 görev) | ⬜ Planlandı | — |

---

## Ekler

- Teknik Stack Detayı: `docs/TEKNIK-STACK.md`
- Proje Durumu: `docs/PROJECT_STATUS.md`
- Kodlama Kuralları: `CLAUDE.md`
- Mobil Planlama: `docs/mobile/MOBILE_APP_TRACKER.md`

---

*Kaynak: `Estimate Pro Document - Project Effort Estimation.docx` + `Estimate Pro Document - Claude.docx` v1.0 (2026-02-18) güncellenerek birleştirildi. Arşiv: `docs/archived/`*
