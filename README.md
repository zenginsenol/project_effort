# EstimatePro (project_effort)

EstimatePro, proje gereksinimlerini görev bazlı efora dönüştürüp maliyet, roadmap ve canlı operasyon takibi yapan bir ürün yönetim platformudur.

## Ana Kabiliyetler

- Doküman/metin/manuel girişten task üretimi
- Task bazlı efor ve maliyet hesaplama
- Haftalık/günlük roadmap üretimi (contingency dahil)
- Roadmap&apos;in Kanban&apos;a otomatik uygulanması (sıra + durum yönetimi)
- GitHub/Jira entegrasyonları ile gerçek issue/task senkronu
- Çok kiracılı yapı (organization izolasyonu), auth ve rol tabanlı erişim
- Proje takip dökümanı ile uçtan uca teslim, operasyon ve maliyet görünürlüğü

## GitHub Entegrasyonu (Detay)

Bu projede GitHub entegrasyonu gerçek veri ile çalışır ve proje bazında yönetilir:

- Proje bazlı repo eşleştirme:
  - Her proje için ayrı repo linki saklanır (`integrations.settings.projectLinks`).
  - Aynı organizasyonda farklı projeler farklı reposlara bağlanabilir.
- Senkron davranışı:
  - Issue&apos;lar task olarak içeri alınır.
  - `pull_request` kayıtları otomatik filtrelenir.
  - Başlık bazlı duplicate kayıtlar tekrar eklenmez.
- Alan eşlemeleri:
  - `state=open` => `todo`, `state=closed` => `done`
  - Label&apos;lardan tür: `epic`, `feature`, `story`, `subtask`, `bug`, `task`
  - Label&apos;lardan öncelik: `critical/high/medium/low` (P0-P3 ve priority etiketleri dahil)
  - Label&apos;lardan story point: `sp:3`, `points:5`, `estimate:8`
- Repo giriş formatları:
  - `owner/repo`
  - `github.com/owner/repo`
  - `https://github.com/owner/repo` (`.git` uzantısı dahil)
- Çalıştırma modları:
  - Manuel sync (`Sync Now`)
  - Proje açılışında otomatik sync (`autoSync=true`)

## Efor ve Takip Akışı

1. Proje task&apos;ları oluşturulur veya entegrasyondan alınır.
2. Effort ekranında saatlik ücret, contingency ve günlük kapasite girilir.
3. Toplam efor/maliyet hesaplanır.
4. Roadmap üretilir (phase/week/day kırılımı).
5. Roadmap Kanban&apos;a uygulanır:
   - Sıralama (`sortOrder`) roadmap&apos;e göre güncellenir
   - İstenirse 1. hafta işleri `todo`ya taşınır, diğerleri `backlog`da kalır
6. Sonuçlar `PROJECT_TRACKER.md` üzerinde operasyonel olarak izlenir.

## Teknoloji Yığını

- Monorepo: `pnpm`, `turbo`
- Web: `Next.js`, `React`, `tRPC`, `Tailwind`
- API: `Fastify`, `tRPC`
- DB: `PostgreSQL`, `Drizzle ORM`
- Cache/Rate-limit: `Redis`
- Auth: `Clerk`

## Ortam Değişkenleri (Önemli)

- `NEXT_PUBLIC_APP_URL`: Web app base URL
- `NEXT_PUBLIC_API_URL`: Web client için API base URL (`/trpc`, `/api/analyze-document`, realtime socket)
- `API_PUBLIC_URL`: API&apos;nin dışarıdan erişilen base URL&apos;i
- `OAUTH_CALLBACK_BASE_URL`: OAuth callback base (varsa `API_PUBLIC_URL` üstüne yazar)
- `OPENAI_OAUTH_CLIENT_ID`: OpenAI OAuth public client id override
- `OPENAI_OAUTH_MODE`: `local_temp_server` (local) veya `api_server_callback` (deployed web)

Örnek dosyalar:
- `.env.example`
- `.env.staging.example`
- `.env.production.example`
