#!/usr/bin/env python3
"""陽明交大 碩士班甄試 榜單：檢查官方公告清單有沒有出現指定梯次的榜單，有就下載。

交大的榜單檔案網址是隨機 ID（action.aspx?id=<UUID>），猜不到檔名；
但招生網「甄試入學」頁面的公告清單來自這個 JSON，榜單一上架就會出現在裡面：
  https://exam.nycu.edu.tw/ap/FuncItem/GetExamNewsJSON?sn=ma-md

用法：
  python check.py                 # 檢查一次 116 第二梯次
  python check.py --every 10      # 每 10 秒檢查一次，找到就下載並停止
  python check.py --year 116 --batch 一
"""
import argparse, json, re, sys, time, urllib.request

FEED = "https://exam.nycu.edu.tw/ap/FuncItem/GetExamNewsJSON?sn=ma-md"
UA = {"User-Agent": "Mozilla/5.0"}

def get(url, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

def find(year, batch):
    data = json.loads(get(FEED).decode("utf-8"))
    if isinstance(data, str): data = json.loads(data)
    for y in data:
        if str(year) not in y.get("Title", ""): continue
        stack = list(y.get("items", []))
        while stack:
            it = stack.pop(0); stack.extend(it.get("items", []))
            t = it.get("Title", "")
            if "榜單" in t and f"第{batch}梯次" in t and it.get("Url"):
                return t, it["Url"]
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", default="116"); ap.add_argument("--batch", default="二")
    ap.add_argument("--every", type=float, default=0, help="秒；0 = 只檢查一次")
    a = ap.parse_args()
    while True:
        try:
            hit = find(a.year, a.batch)
        except Exception as e:
            hit = None; print(time.strftime("%H:%M:%S"), "讀取失敗：", e, flush=True)
        if hit:
            title, url = hit
            print(time.strftime("%H:%M:%S"), "找到：", title, url, flush=True)
            m = re.search(r"id=([0-9a-fA-F-]{36})", url)
            if m:
                pdf = get(f"https://exam.nycu.edu.tw/apfiles/getFile.aspx?type=1&id={m.group(1)}", timeout=60)
                name = f"nycu-{a.year}-第{a.batch}梯次榜單.pdf"
                open(name, "wb").write(pdf); print("已下載：", name, len(pdf), "bytes", flush=True)
            return 0
        print(time.strftime("%H:%M:%S"), f"{a.year} 第{a.batch}梯次榜單 還沒出現", flush=True)
        if not a.every: return 1
        time.sleep(a.every)

if __name__ == "__main__":
    sys.exit(main())
