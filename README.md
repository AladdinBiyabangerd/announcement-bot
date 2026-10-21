# announcement-bot

Java/Spring layihəsinin Node 22 portu. Mövcud `src/main/java` koduna toxunmur.

Telegram əmlak axtarış botu: bina.az, tap.az, ev10.az, yeniemlak.az, emlak.az, arenda.az, evv.az, unvan.az, lalafo.az, binatap.az. Yalnız Azərbaycan elanları; kupça filtri detal səhifəsində yoxlanır (Bələdiyyə sənədi kupça sayılmır).

**Ev** axtarışı mənzil (yeni + köhnə tikili), həyət evi və bağ evini bütün mənbələrdən birləşdirir. Torpaq ayrıca qalır. Otaq və sahə minimumdur (məsələn 3+ otaq, 100 m²+).

## Stack

- Node 22 + native `fetch` (`undici`)
- `cheerio` — HTML parse
- `better-sqlite3` — tək fayl DB
- Railway Volume — production-da persist
- FlareSolverr — Cloudflare 403 üçün (Railway datacenter IP)

## Database (lokal və Railway)

**SQLite.** MySQL/Postgres yoxdur.

| Mühit | Fayl |
|---|---|
| Lokal | `./data/announcement.db` (`SQLITE_PATH`) |
| Railway | Volume mount `/data` → `SQLITE_PATH=/data/announcement.db` |

Railway-də Volume olmasa konteyner restart-da abunəliklər silinir. Dashboard-da Volume əlavə et, mount path: `/data`.

## Lokal işə salma

```bash
cp .env.example .env
# .env-də TELEGRAM_BOT_TOKEN yaz
npm install
npm test
npm start
```

Health: http://localhost:3000/health

FlareSolverr (Cloudflare üçün):

```bash
docker compose up -d flaresolverr
# .env: SCRAPER_FLARESOLVERR_URL=http://localhost:8191
```

və ya bütün stack: `docker compose up --build`

İstəyə bağlı residential proxy (FlareSolverr uğursuz olsa fallback):

```bash
# .env
SCRAPER_HTTP_PROXY=http://user:pass@proxy-host:8080
```

## Railway deploy

1. Yeni **bot** service. **Root Directory** boş qoyun (repo kökü). Dockerfile bu qovluqdadır.
2. Volume: mount `/data`
3. Bot Variables:
   - `SQLITE_PATH=/data/announcement.db`
   - `TELEGRAM_BOT_TOKEN=...`
   - `PORT` Railway özü verir

### FlareSolverr (məcburidir Cloudflare üçün)

Railway datacenter IP-dən bina.az, tap.az, lalafo.az, yeniemlak.az və emlak.az 403 qaytarır. `SCRAPER_FLARESOLVERR_URL` boşdursa bot həmin saytları server logunda atlayır; istifadəçiyə bunu yazmır.

Dəqiq addımlar:

1. Railway layihədə **New** → **Empty Service** (və ya Docker Image).
2. Service adı: `flaresolverr` (bu ad internal DNS-də görünür).
3. Settings → **Source** → **Docker Image**:
   - Image: `ghcr.io/flaresolverr/flaresolverr:latest`
4. Settings → **Networking**:
   - Public networking lazım deyil. **Private Networking** aktiv olsun.
   - Konteyner portu: `8191`
5. Bot service → Variables → əlavə et (ad `flaresolverr`dirsə eynilə):

   ```
   SCRAPER_FLARESOLVERR_URL=http://flaresolverr.railway.internal:8191
   ```

   Service adını başqa qoysanız, URL-də həmin adı yazın: `http://<service-name>.railway.internal:8191`
6. İstəyə bağlı residential proxy (FlareSolverr işləməsə bot bir dəfə proxy ilə cəhd edir; FlareSolverr özü də eyni proxy-dən keçə bilər):

   ```
   SCRAPER_HTTP_PROXY=http://user:pass@host:port
   ```
7. Bot service-i redeploy edin. Logda `FlareSolverr uğurlu` görünməlidir; 403/Cloudflare mesajları yalnız server logunda qalır.

Hobby + SQLite (FlareSolverr-siz) adətən **$5/ay** credit içinə sığır. FlareSolverr ayrı service-dir və əlavə RAM/CPU götürür.
