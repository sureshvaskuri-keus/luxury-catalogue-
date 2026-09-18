#!/usr/bin/env python3
from pathlib import Path
import csv, urllib.parse
FILES=["downlights.csv","tracklights.csv","profiles.csv","outdoor-lights.csv"]
QUALITY=78
def conv(url):
    url=(url or "").strip()
    if not url:return url
    try:
        p=urllib.parse.urlparse(url)
        if p.hostname in {"wsrv.nl","images.weserv.nl"}: return url
        if p.hostname not in {"i.ibb.co","ibb.co","www.ibb.co"}: return url
        return "https://wsrv.nl/?"+urllib.parse.urlencode({"url":url,"output":"webp","q":str(QUALITY)})
    except Exception:return url
def main():
    root=Path(__file__).resolve().parent.parent/"data"
    for name in FILES:
        p=root/name
        if not p.exists():continue
        with p.open("r",encoding="utf-8-sig",newline="") as f:
            r=csv.DictReader(f); rows=list(r); fields=r.fieldnames or []
        col=next((h for h in fields if h.strip().lower() in {"image","image url","image link","imageurl"}),None)
        if not col:continue
        changed=0
        for row in rows:
            n=conv(row.get(col,""))
            if n!=row.get(col,""):row[col]=n;changed+=1
        with p.open("w",encoding="utf-8-sig",newline="") as f:
            w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
        print(name,changed)
if __name__=="__main__":main()
