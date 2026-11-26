# GramMap

A sheet of 1,000,000 pixels on TON. Visitors connect a TON wallet, mark an area, pay for it in GRAM and put a
picture, a title and a link on it. Live at [grammap.app](https://grammap.app).

Next.js on Vercel, TON Connect for the wallet, Vercel Blob for pictures and the saved map. No database and no
private keys on the server.

## How it works

Everything that changes the map is a plain transfer to one wallet (the treasury) with a text comment:

| Comment                  | Meaning                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `gm:b:X:Y:W:H[:CONTENT]` | Buy the W×H area whose top-left pixel is X,Y, optionally with content       |
| `gm:u:X:Y:CONTENT`       | Owner changes the picture and link of the plot at X,Y (`0` clears it)       |
| `gm:h:X:Y` / `gm:s:X:Y`  | Moderator hides / shows the content of the plot covering X,Y               |

1. The visitor fills in a picture, title and link. `POST /api/drafts` validates and stores them under the hash of
   their own text (`CONTENT`), so the payment commits to exactly that content.
2. `POST /api/order` checks the area is free and returns the transfer for the wallet to sign: treasury address,
   amount, and the comment as a payload.
3. The wallet sends the transfer. Nothing is reserved: the first payment to reach the chain gets the area.
4. The server reads the treasury's incoming transactions from toncenter (tonapi as a fallback) and applies them in
   chain order (`src/lib/indexer.ts`). Each new state of the map is saved to Vercel Blob as its own write-once file
   under `state/`, named after the last transaction it includes.

The indexer is deterministic, so the saved map is only a cache: delete the `state/` folder in the Blob store and it
is rebuilt from the chain. The whole map lives in one JSON file; past tens of thousands of plots it should move to
a database.

A payment that cannot be applied (the area was taken a moment earlier, the amount was too small, …) is listed at
`/api/rejected` and in the site menu under “Refund list”. **Refunds are sent by hand from the treasury wallet.**

## Settings

Environment variables (see `.env.example`):

| Variable                           | Default         | Notes                                                              |
| ---------------------------------- | --------------- | ------------------------------------------------------------------ |
| `TREASURY_ADDRESS`                 | —               | Wallet that receives payments. Sales are closed until it is set.   |
| `TON_NETWORK`                      | `mainnet`       | or `testnet`                                                       |
| `GRID_W`, `GRID_H`                 | `1000`          | Sheet size in pixels                                               |
| `PRICE_PER_PIXEL`                  | `1`             | GRAM                                                               |
| `EDIT_FEE`                         | `0.1`           | GRAM for changing a plot's picture or link                         |
| `MAX_SIDE`, `MAX_AREA`             | `200`, `10000`  | Largest single purchase                                            |
| `ADMIN_ADDRESSES`                  | —               | Extra moderator wallets; the treasury is always one                |
| `TONCENTER_API_KEY`, `TONAPI_KEY`  | —               | Optional; without them the public rate limits apply                |
| `TELEGRAM_URL`                     | —               | Link shown in the menu                                             |
| `TITLE_PLATE`                      | on              | `0` frees the 120×40 title area in the centre of the sheet         |
| `BLOB_READ_WRITE_TOKEN`            | —               | Added by Vercel when a Blob store is connected                     |
| `GOOGLE_SITE_VERIFICATION`         | —               | Code from Google Search Console, when confirming by meta tag       |
| `YANDEX_VERIFICATION`              | —               | Code from Yandex Webmaster, when confirming by meta tag            |
| `BING_SITE_VERIFICATION`           | —               | Code from Bing Webmaster Tools (`msvalidate.01`)                   |

Use a treasury wallet that receives nothing but GramMap payments, and do not change `TREASURY_ADDRESS`,
`PRICE_PER_PIXEL` or the grid once plots are sold: the map is derived from that wallet's history under these rules.

## Moderation

Send any small amount from the treasury wallet (or a wallet in `ADMIN_ADDRESSES`) to the treasury with the comment
`gm:h:X:Y` to hide the picture and link of the plot covering that pixel, `gm:s:X:Y` to show them again. The plot
stays with its owner.

## Search engines and AI assistants

The map itself is drawn in the browser, so every address also carries a server-rendered text version
for crawlers, AI assistants and browsers without JavaScript. All of it is written once, in
`src/lib/seo-content.ts`, with figures taken from the settings.

| Address                    | What it is                                                                 |
| -------------------------- | -------------------------------------------------------------------------- |
| `/`, `/ru`                 | The map, with its text version: facts, how to buy, the newest plots        |
| `/about`, `/ru/about`      | How it works, prices, rules, questions and answers (FAQ structured data)   |
| `/terms`, `/ru/terms`      | Terms and privacy                                                          |
| `/plot/X-Y`                | One plot: the map opened on it, plus its title, picture, link and owner    |
| `/llms.txt`                | Short brief for language models ([llmstxt.org](https://llmstxt.org))       |
| `/llms-full.txt`           | Everything above in one Markdown file                                      |
| `/sitemap.xml`             | All pages and every plot that shows content, with language alternates      |
| `/robots.txt`              | Open to everyone; AI crawlers are named explicitly                         |

The daily cron also announces new and changed pages to Bing, Yandex and the other IndexNow engines
(key file in `public/`). Google is told through the sitemap in Search Console.

## Development

```bash
npm install
npm test          # indexer, payment comments, content rules, sync
npm run dev
```

Without `BLOB_READ_WRITE_TOKEN` files go to `.data/`. To look at a populated map without real payments:

```bash
# .env.local
TREASURY_ADDRESS=0:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
MOCK_CHAIN_FILE=.data/mock-chain.json
GENESIS_UTIME=0
DISABLE_RATE_LIMIT=1
```

```bash
npm run build && npm start
python3 scripts/dev-seed.py http://localhost:3000   # needs Pillow
```

`MOCK_CHAIN_FILE` and `DISABLE_RATE_LIMIT` are ignored on Vercel.

## Layout

```
src/lib/protocol.ts      payment comment format
src/lib/indexer.ts       transactions → map (pure, tested)
src/lib/chain.ts         toncenter / tonapi readers
src/lib/state.ts         sync and saved state
src/lib/content.ts       picture, title and link validation and storage
src/app/api/*            map, sync, order, drafts, rejected, cron
src/components/*         map canvas, purchase flow, panels
src/components/site/*    server-rendered pages: about, terms, plot pages, text version of the map
src/lib/seo*.ts          site copy, robots, sitemap, llms.txt, structured data
```
