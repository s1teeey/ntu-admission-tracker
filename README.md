# NTU Admission

臺大碩士班甄試放榜工具（非官方）。網站：https://s1teeey.github.io/ntu-admission-tracker/

- 選最多 3 個系所，貼上一階名單，自動配對二榜／三榜
- 放榜當天自動偵測教務處榜單 PDF（或自己上傳），在瀏覽器裡解析
- 116 試玩：真實榜單，只有准考證號
- 使用者輸入的資料只存在自己的瀏覽器

## 每年要更新的

`data/config.json`：

| 欄位 | 說明 |
|---|---|
| `year` | 學年度，例如 `117` |
| `batches."1".date` / `batches."2".date` | 第 1／第 2 梯次放榜日，格式 `2027-11-18`；時間預設 `09:00` |
| `worker` | 偵測器網址（Cloudflare Worker） |
| `feedback` | 意見回饋表單網址 |

## 檔案

- `index.html`, `style.css`, `app.js`：網站
- `lib/parse.js`：名單貼上解析、榜單解析、二榜配對（沒有 DOM，可以用 node 測）
- `lib/pdf.min.mjs`, `lib/pdf.worker.min.mjs`：pdf.js 4.10.38（Apache-2.0）
- `data/catalog.json`：系所組別清單（由 116 第 1、2 梯次榜單整理）
- `data/results116.json`, `data/demo116.json`：116 試玩資料，只有准考證號
- `worker/`：放榜偵測器。部署：`npx wrangler kv namespace create STATE`，把 id 填進 `wrangler.toml`，再 `npx wrangler deploy`
