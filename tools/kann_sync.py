#!/usr/bin/env python3
"""Sync public books and movies/series from KANN notes into bookshelf/books.json and movieshelf/movies.json.

Usage: python3 tools/kann_sync.py NOTES_DIR ASSETS_DIR [--date YYYY-MM-DD]
  NOTES_DIR  : one JSON file per KANN note (<noteid>.json, from the artifact db "notes" collection)
  ASSETS_DIR : downloaded KANN assets, each file named by its asset id (any extension)
Exit codes: 0 = done (prints CHANGED or NOCHANGE), 3 = assets missing (prints NEED <id> lines),
  4 = export looks incomplete (no public books or no public screen notes while the shelf has some); nothing written.
Only notes with public:true, type book, status done/reading (or no status) are published.
Pages marked hide are never published. Journal entries / treadmill data are never published.
Movies/series: public screen notes, status done/reading. Existing movieshelf entries keep their curated
title, group, genre, year, poster and (for Facebook imports) review; KANN adds cheese, quote, favourite
scenes (n.pages, hide skipped), ending (n.pagesEnd), status/start/EP. Watch-log text is never published.
"""
import ast, glob, html, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS = os.path.join(ROOT, 'bookshelf', 'books.json')
MOVIES = os.path.join(ROOT, 'movieshelf', 'movies.json')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
NOTES, ASSETS = args[0], args[1]
TODAY = sys.argv[sys.argv.index('--date') + 1] if '--date' in sys.argv else None
SUPPORTS_READING = 'renderNow' in open(os.path.join(ROOT, 'bookshelf.html'), encoding='utf-8').read()

def arr(v):
    if isinstance(v, str):
        try: v = json.loads(v)
        except Exception:
            try: v = ast.literal_eval(v)
            except Exception: v = []
    return v if isinstance(v, list) else []

def strip_html(s):
    s = re.sub(r'</p>\s*<p>|<br\s*/?>', '\n', s or '')
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()

def asset(aid):
    for f in glob.glob(os.path.join(ASSETS, aid + '*')):
        return f
    return None

def save_jpg(src, dst, maxw):
    im = Image.open(src).convert('RGB')
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'JPEG', quality=80, optimize=True)
    return im

def hexc(c): return '#%02x%02x%02x' % tuple(c)

def spine_colors(im):
    s = im.resize((40, 60)).convert('RGB')
    px = [s.getpixel((x, y)) for y in range(s.height) for x in range(s.width)]
    avg = [sum(p[i] for p in px) // len(px) for i in range(3)]
    lum = 0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2]
    ink = '#0d0d0d' if lum > 140 else '#ffffff'
    return hexc(avg), [hexc(avg), ink, ink]

data = json.load(open(BOOKS, encoding='utf-8'))
old = {b['id']: b for b in data['books']}
missing, out = set(), []
notes = {}
for f in glob.glob(os.path.join(NOTES, '*.json')):
    n = json.load(open(f, encoding='utf-8'))
    notes[n.get('id') or os.path.splitext(os.path.basename(f))[0]] = n

for nid, n in notes.items():
    if n.get('type') != 'book' or not n.get('public') or n.get('example'): continue
    st = n.get('status') or 'done'
    if st == 'want' or (st == 'reading' and not SUPPORTS_READING): continue
    fl = n.get('fields') or {}
    b = dict(old.get(nid, {'id': nid, 'type': 'book', 'tags': []}))
    b['title'] = n.get('title') or b.get('title', '')
    if fl.get('creator'): b['author'] = fl['creator']
    if n.get('category'): b['category'] = n['category']
    if n.get('tags'): b['tags'] = n['tags']
    if st == 'reading': b['date'] = n.get('startDate') or b.get('date', '')
    elif n.get('date'): b['date'] = n['date']
    for k in ('liked', 'quote'):
        if fl.get(k): b[k] = fl[k]
    if str(fl.get('rating') or '').isdigit(): b['rating'] = int(fl['rating'])
    rv = fl.get('transcript') or strip_html(fl.get('review'))
    if rv: b['review'] = rv
    # status
    for k in ('status', 'start', 'page', 'pages', 'ending'): b.pop(k, None)
    if st == 'reading':
        b['status'] = 'reading'
        if n.get('startDate'): b['start'] = n['startDate']
        ps = [e.get('p') for e in arr(n.get('journal')) + arr(n.get('pages')) if isinstance(e.get('p'), int)]
        if ps: b['page'] = max(ps)
    pages = []
    for p in sorted(arr(n.get('pages')), key=lambda e: (0, e['p'], e.get('at', 0)) if isinstance(e.get('p'), int) and e['p'] else (1, 0, e.get('at', 0))):
        if p.get('hide') or not p.get('id'): continue
        dst = 'bookshelf/pages/%s-%s.jpg' % (nid, p['id'][:8])
        if not os.path.exists(os.path.join(ROOT, dst)):
            src = asset(p['id'])
            if not src: missing.add(p['id']); continue
            save_jpg(src, os.path.join(ROOT, dst), 1000)
        e = {'img': dst, 'd': p.get('d', '')}
        if p.get('p'): e['p'] = p['p']
        if p.get('t'): e['t'] = p['t']
        pages.append(e)
    if pages: b['pages'] = pages
    if (n.get('pagesEnd') or '').strip(): b['ending'] = n['pagesEnd'].strip()
    # cover for books not yet on the shelf
    if not b.get('image'):
        cid = n.get('cover') or (arr(n.get('images')) or [None])[0]
        cid = cid.get('id') if isinstance(cid, dict) else cid
        src = asset(cid) if cid else None
        if not src:
            missing.add(cid or ('NO-COVER:' + nid)); continue
        im = save_jpg(src, os.path.join(ROOT, 'bookshelf/covers/%s.jpg' % nid), 600)
        save_jpg(src, os.path.join(ROOT, 'bookshelf/face/%s.jpg' % nid), 600)
        b['image'], b['face'] = 'bookshelf/covers/%s.jpg' % nid, 'bookshelf/face/%s.jpg' % nid
        b['color'], b['spine'] = spine_colors(im)
    out.append(b)

# ---------- movies / series ----------
def num_or_none(v):
    try:
        x = float(v)
        return int(x) if x == int(x) else x
    except Exception: return None

mdata = json.load(open(MOVIES, encoding='utf-8'))
mold = {m['id']: m for m in mdata['movies']}
mout = []
for nid, n in notes.items():
    if n.get('type') != 'screen' or not n.get('public') or n.get('example'): continue
    st = n.get('status') or 'done'
    if st == 'want': continue
    fl = n.get('fields') or {}
    m = dict(mold.get(nid, {'id': nid, 'tag': False, 'source': 'kann'}))
    m.setdefault('title', n.get('title') or '')
    if nid not in mold: m['title'] = n.get('title') or m['title']
    m['group'] = m.get('group') or n.get('sgroup') or 'อื่นๆ'
    if not m.get('genre') and n.get('genre'): m['genre'] = n['genre']
    if not m.get('year'):
        y = n.get('year') or (int((n.get('date') or n.get('startDate') or '0')[:4]) or None)
        if y: m['year'] = y
    c = num_or_none(fl.get('cheese'))
    if c is not None: m['cheese'] = c
    else: m.setdefault('cheese', None)
    if st == 'reading': m['date'] = n.get('startDate') or m.get('date') or TODAY or ''
    elif n.get('date'): m['date'] = n['date']
    if fl.get('quote'): m['quote'] = fl['quote']
    else: m.pop('quote', None)
    if n.get('source') != 'fb':
        rv = strip_html(fl.get('review')) or fl.get('liked') or ''
        if rv: m['review'] = rv
        else: m.setdefault('review', '')
    for k in ('status', 'start', 'ep', 'pages', 'ending'): m.pop(k, None)
    if n.get('startDate') and (st == 'reading' or n.get('startDate') != n.get('date')): m['start'] = n['startDate']
    if st == 'reading':
        m['status'] = 'reading'
        eps = [e.get('p') for e in arr(n.get('journal')) + arr(n.get('pages')) if isinstance(e.get('p'), int)]
        if eps: m['ep'] = max(eps)
    scenes = []
    for p in sorted(arr(n.get('pages')), key=lambda e: (0, e['p'], e.get('at', 0)) if isinstance(e.get('p'), int) and e['p'] else (1, 0, e.get('at', 0))):
        if p.get('hide') or not p.get('id'): continue
        dst = 'movieshelf/scenes/%s-%s.jpg' % (nid, p['id'][:8])
        if not os.path.exists(os.path.join(ROOT, dst)):
            src = asset(p['id'])
            if not src: missing.add(p['id']); continue
            save_jpg(src, os.path.join(ROOT, dst), 1000)
        e = {'img': dst, 'd': p.get('d', '')}
        if p.get('p'): e['p'] = p['p']
        if p.get('t'): e['t'] = p['t']
        scenes.append(e)
    if scenes: m['pages'] = scenes
    if (n.get('pagesEnd') or '').strip(): m['ending'] = n['pagesEnd'].strip()
    if 'image' not in m:
        cid = n.get('cover') or (arr(n.get('images')) or [None])[0]
        cid = cid.get('id') if isinstance(cid, dict) else cid
        if cid:
            src = asset(cid)
            if not src: missing.add(cid); continue
            im = save_jpg(src, os.path.join(ROOT, 'movieshelf/posters/%s.jpg' % nid), 900)
            m['image'] = 'movieshelf/posters/%s.jpg' % nid
            if im.width / im.height < 0.9: m['tall'] = True
        else: m['image'] = None
    mout.append(m)

if missing:
    for m in sorted(missing): print('NEED', m)
    sys.exit(3)

# guard: an empty or partial export must never wipe a live shelf
if data['books'] and not out:
    print('ERROR no public book notes found but books.json has %d books; export looks incomplete, nothing written' % len(data['books'])); sys.exit(4)
if mdata['movies'] and not mout:
    print('ERROR no public screen notes found but movies.json has %d titles; export looks incomplete, nothing written' % len(mdata['movies'])); sys.exit(4)

changed = []
order = {b['id']: i for i, b in enumerate(data['books'])}
out.sort(key=lambda b: (order.get(b['id'], 1e9), b.get('date', '')))
if out != data['books']:
    data['books'] = out
    if TODAY: data['updated'] = TODAY
    cats = data.get('categories', [])
    for b in out:
        if b.get('category') and b['category'] not in cats: cats.append(b['category'])
    data['categories'] = cats
    with open(BOOKS, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2); f.write('\n')
    changed.append('%d books' % len(out))

morder = {m['id']: i for i, m in enumerate(mdata['movies'])}
mout.sort(key=lambda m: (morder.get(m['id'], 1e9), m.get('date', '')))
if mout != mdata['movies']:
    mdata['movies'] = mout
    if TODAY: mdata['updated'] = TODAY
    for m in mout:
        if m.get('group') and m['group'] not in mdata['groups']: mdata['groups'].append(m['group'])
        if m.get('genre') and m['genre'] not in mdata.get('genres', []): mdata.setdefault('genres', []).append(m['genre'])
    with open(MOVIES, 'w', encoding='utf-8') as f:
        json.dump(mdata, f, ensure_ascii=False, indent=1); f.write('\n')
    changed.append('%d movies' % len(mout))

print('CHANGED ' + ', '.join(changed) if changed else 'NOCHANGE')
