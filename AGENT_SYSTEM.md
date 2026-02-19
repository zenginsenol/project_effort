# EstimatePro Agent System

Bu dokuman, proje adimlarinin ajanlar ile kesintisiz yonetimi icin operasyon modelidir.

## 1) Amaç

- Tum kalan go-live adimlarini ajana atanabilir gorevler halinde yonetmek
- Her ajana otomatik "siradaki gorev" vermek
- Gorev tamamlandikca bir sonraki gorevi otomatik aktive etmek
- Tracker/dokuman bitene kadar operasyonu durdurmadan ilerletmek

## 2) Sistem Bilesenleri

- Backlog kaynagi: `agent-ops/agent-backlog.json`
- Orkestrator CLI: `scripts/agent-orchestrator.mjs`
- Canli gorev raporu: `agent-ops/agent-next-tasks.md`
- Ana proje takibi: `PROJECT_TRACKER.md`

## 3) Roller

- `Agent-A`: Backend/API/security/integrations
- `Agent-B`: Database/tenant isolation/token encryption
- `Agent-C`: Frontend/UX/realtime UI
- `QA`: Test otomasyonu, guvenlik ve performans dogrulamasi
- `Ops`: Staging/prod/monitoring/DR
- `Manager`: Onceliklendirme, release karar noktasi, hypercare yonetimi

## 4) Durum Modeli

- `todo`: Hazir, baslanmamis
- `in_progress`: Aktif calisiliyor
- `blocked`: Engelli, neden kayitli
- `done`: Tamamlandi

Kurallar:
- Ayni ajan icin ayni anda maksimum 1 `in_progress` gorev.
- Bagimliliklar tamamlanmadan (`dependsOn`) gorev baslatilamaz.
- Her `done` durumundan sonra `agent:advance` calistirilir.

## 5) Gecis Akisi (Surekli Dongu)

1. Durumu gor:
   - `pnpm agent:status`
2. Siradaki gorevleri gor:
   - `pnpm agent:next`
3. Otomatik gorev baslat:
   - `pnpm agent:advance`
4. Icra edilen gorevi tamamla:
   - `node scripts/agent-orchestrator.mjs done <TASK_ID>`
5. Raporu yenile:
   - `pnpm agent:report`
6. 1. adıma geri don.

Bu dongu, backlogdaki tum gorevler `done` olana kadar devam eder.

## 6) Operasyon Komutlari

- Durum:
  - `pnpm agent:status`
- Siradaki gorev:
  - `pnpm agent:next`
- Otomatik aktiflestirme:
  - `pnpm agent:advance`
- Gorev baslat:
  - `node scripts/agent-orchestrator.mjs start <TASK_ID> [OWNER]`
- Gorev tamamla:
  - `node scripts/agent-orchestrator.mjs done <TASK_ID>`
- Bloke et:
  - `node scripts/agent-orchestrator.mjs block <TASK_ID> <REASON>`
- Blokeyi kaldir:
  - `node scripts/agent-orchestrator.mjs unblock <TASK_ID>`
- Rapor olustur:
  - `pnpm agent:report`
- Dogrulama:
  - `pnpm agent:validate`

## 7) Durma Kriteri

Ajan sistemi ancak tum backlog `done` oldugunda "dokuman bitmis" kabul eder.

Kontrol:
- `pnpm agent:status` cikti ozetinde `todo=0`, `in_progress=0`, `blocked=0`

## 8) Degisiklik Yonetimi

- Yeni gorev eklenecekse tek kaynak sadece `agent-ops/agent-backlog.json`.
- Phase, owner, dependsOn ve acceptance alanlari olmadan gorev acilmaz.
- Her buyuk re-plan sonrasinda `PROJECT_TRACKER.md` guncellenir.
