# announcement-bot

Java/Spring layihəsinin Node 22 portu. Mövcud `src/main/java` koduna toxunmur.

Telegram əmlak axtarış botu: bina.az, tap.az, ev10.az, yeniemlak.az, emlak.az, arenda.az, evv.az, unvan.az, lalafo.az, binatap.az. Yalnız Azərbaycan elanları; kupça filtri detal səhifəsində yoxlanır (Bələdiyyə sənədi kupça sayılmır).

**Ev** axtarışı mənzil (yeni + köhnə tikili), həyət evi və bağ evini bütün mənbələrdən birləşdirir. Torpaq ayrıca qalır. Otaq və sahə minimumdur (məsələn 3+ otaq, 100 m²+).

## Stack

- Node 22 + native `fetch` (`undici`)
- `cheerio` — HTML parse
- `better-sqlite3` — tək fayl DB
- Railway Volume — production-da persist

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

və ya Docker: `docker compose up --build`

## Railway deploy

1. Yeni **bot** service. **Root Directory** boş qoyun (repo kökü). Dockerfile bu qovluqdadır.
2. Volume: mount `/data`
3. Bot Variables:
   - `SQLITE_PATH=/data/announcement.db`
   - `TELEGRAM_BOT_TOKEN=...`
   - `PORT` Railway özü verir

Hobby + SQLite adətən **$5/ay** credit içinə sığır.
