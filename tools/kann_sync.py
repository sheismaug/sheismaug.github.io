#!/usr/bin/env python3
"""Sync public books from KANN notes into bookshelf/books.json.

Usage: python3 tools/kann_sync.py NOTES_DIR ASSETS_DIR [--date YYYY-MM-DD]
  NOTES_DIR  : one JSON file per KANN note (<noteid>.json, from the artifact db "notes" collection)
  ASSETS_DIR : downloaded KANN assets, each file named by its asset id (any extension)
Exit codes: 0 = done (prints CHANGED or NOCHANGE), 3 = assets missing (prints NEED <id> lines).
Only notes with public:true, type book, status done/reading (or no status) are published.
Pages marked hide are never published. Journal entries / treadmill data are never published.
"""
import ast, glob, html, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS = os.path.join(ROOT, 'bookshelf', 'books.json')
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

from html.parser import HTMLParser
RICH = {'p', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'aside', 'br', 'div', 's', 'strike', 'del', 'code', 'a'}
RICH_MAP = {'strong': 'b', 'em': 'i', 'strike': 's', 'del': 's', 'h1': 'h2', 'h5': 'h4', 'h6': 'h4', 'div': 'p'}

class _Clean(HTMLParser):
    """Keep only the simple formatting KANN's review editor makes; drop every attribute."""
    def __init__(self):
        super().__init__(convert_charrefs=True); self.out = []; self.skip = 0; self.links = []
    def handle_starttag(self, t, a):
        if t in ('script', 'style'): self.skip += 1
        elif t == 'a' and not self.skip:
            h = (dict(a).get('href') or '').strip()
            self.links.append(bool(re.match(r'https?://', h, re.I)))
            if self.links[-1]: self.out.append('<a href="%s">' % html.escape(h, quote=True))
        elif t in RICH and not self.skip: self.out.append('<%s>' % RICH_MAP.get(t, t))
    def handle_endtag(self, t):
        if t in ('script', 'style'): self.skip = max(0, self.skip - 1)
        elif t == 'a' and not self.skip:
            if self.links and self.links.pop(): self.out.append('</a>')
        elif t in RICH and t != 'br' and not self.skip: self.out.append('</%s>' % RICH_MAP.get(t, t))
    def handle_data(self, d):
        if not self.skip: self.out.append(html.escape(d, quote=False))

def rich_html(s):
    """Sanitised review HTML, or '' when the review has no formatting beyond plain paragraphs."""
    if not s or not re.search(r'<(h[1-6]|ul|ol|blockquote|aside|b|strong|i|em|u|s|strike|del|code|a)\b', s, re.I): return ''
    c = _Clean(); c.feed(s); c.close()
    return re.sub(r'(<p>(<br>|\s)*</p>)+', '', wrap_loose(''.join(c.out))).strip()

BLOCKS = {'p', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'aside'}
def wrap_loose(h):
    """Put text that sits outside any paragraph (KANN's first line often does) into its own <p>."""
    out, depth, open_p = [], 0, False
    for tok in re.split(r'(<[^>]+>)', h):
        if not tok: continue
        m = re.match(r'<(/?)([a-z0-9]+)', tok)
        if m and m.group(2) in BLOCKS:
            if not m.group(1) and depth == 0 and open_p: out.append('</p>'); open_p = False
            depth += -1 if m.group(1) else 1; depth = max(depth, 0)
        elif depth == 0 and not open_p and (m or tok.strip()):
            if m and m.group(1): pass
            else: out.append('<p>'); open_p = True
        out.append(tok)
    if open_p: out.append('</p>')
    return re.sub(r'<br></p>', '</p>', ''.join(out))

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
    rh = '' if fl.get('transcript') else rich_html(fl.get('review'))
    if rh: b['review_html'] = rh
    else: b.pop('review_html', None)
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

if missing:
    for m in sorted(missing): print('NEED', m)
    sys.exit(3)

order = {b['id']: i for i, b in enumerate(data['books'])}
out.sort(key=lambda b: (order.get(b['id'], 1e9), b.get('date', '')))
if out == data['books']:
    print('NOCHANGE'); sys.exit(0)
data['books'] = out
if TODAY: data['updated'] = TODAY
cats = data.get('categories', [])
for b in out:
    if b.get('category') and b['category'] not in cats: cats.append(b['category'])
data['categories'] = cats
with open(BOOKS, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2); f.write('\n')
print('CHANGED', len(out), 'books')
