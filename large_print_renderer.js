/**
 * ════════════════════════════════════════════════════════════════════
 *  large_print_renderer.js — D/C Sheet + Large Print Cards renderer
 * ════════════════════════════════════════════════════════════════════
 *
 *  Generate HTML ตาม mockup (dc_large_print_mockup.html) จากข้อมูล bundle
 *  เรียกใช้ได้จาก IPD Pharm Hub D/C tab (Phase 4) หรือ Warfarin tab (Phase 5)
 *
 *  Depends on:  sig_translator.js (global SigTranslator)
 *
 *  Usage:
 *    var html = LargePrintRenderer.render({
 *      patient: { hn, name, age, sex, weight, admitDate, dcDate, dx, allergies },
 *      sections: {
 *        continue: [{...drug}],
 *        change:   [{...drug, sigBefore, sigAfter, reason}],
 *        new:      [{...drug, reason}],
 *        stop:     [{...drug, reason}],
 *      },
 *    }, {
 *      hospitalName: 'โรงพยาบาลห้วยผึ้ง',
 *      docCode: 'F-PHA-DC-001',
 *      docRev: 'Rev. 2569-04',
 *      includeCover: true,
 *      includeCards: [0,1,2,3],          // index เข้า flattened list (default = ทั้งหมด)
 *      inrNextDate: '2569-05-02',         // ถ้ามี — แสดงใน Warfarin card
 *    });
 *    // → complete HTML string พิมพ์ได้เลย
 *
 *  Special card types (auto-detect จาก drug.route + drug.name):
 *    • insulin  — syringe guide (full + zoom)
 *    • warfarin — weekly regimen grid + TWD
 *    • PRN      — icon-based (symptoms)
 *    • stop     — red X overlay
 *    • change   — before/after side-by-side
 *    • oral     — dot grid (4 meals)
 *
 *  Export: window.LargePrintRenderer + module.exports (UMD)
 * ════════════════════════════════════════════════════════════════════
 */

(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.LargePrintRenderer = factory();
})(typeof self !== 'undefined' ? self : this, function(){

  // ── Warfarin pill colors (ตามที่ใช้จริงที่ รพ.ห้วยผึ้ง) ──
  var WF_COLORS = {
    2: { fill:'#FFB078', stroke:'#B5561F', name:'ส้ม' },
    3: { fill:'#7FB3E5', stroke:'#1E5A99', name:'ฟ้า' },
    5: { fill:'#F7A8C4', stroke:'#9E2D5C', name:'ชมพู' },
  };

  // ── Meal emojis ──
  var MEAL_EMOJIS = { m:'🌅', n:'☀️', e:'🌆', b:'🌙' };
  var MEAL_TH     = { m:'เช้า', n:'เที่ยง', e:'เย็น', b:'ก่อนนอน' };

  // ── CSS (inline — printable standalone) ──
  var CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Google Sans','Noto Sans Thai',sans-serif;background:white;color:#1a1a1a;}
.page{width:210mm;min-height:297mm;background:white;padding:14mm 14mm;page-break-after:always;position:relative;}
.page:last-child{page-break-after:auto;}

/* Cover */
.hd{display:flex;align-items:center;gap:14px;border-bottom:2px solid #2e3f58;padding-bottom:10px;}
.hd-logo{width:64px;height:64px;border-radius:50%;background:#f5f4f2;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa;overflow:hidden;}
.hd-logo img{width:100%;height:100%;object-fit:cover;}
.hd-text{flex:1;}
.hd-text .title{font-size:18px;font-weight:700;color:#2e3f58;}
.hd-text .dept{font-size:11px;color:#777;margin-top:2px;}
.hd-doc{text-align:right;font-size:10px;color:#888;}
.doc-title{text-align:center;font-size:15px;font-weight:600;color:#2e3f58;margin:14px 0 8px;letter-spacing:0.5px;}
.pt-block{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 20px;margin-top:10px;font-size:12px;}
.pt-block .field{border-bottom:1px dotted #aaa;padding:3px 2px;}
.pt-block .field b{color:#555;font-weight:500;margin-right:6px;}
.sum-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px;}
.sum-tile{border-radius:12px;padding:14px 16px;text-align:center;}
.sum-tile .n{font-size:36px;font-weight:700;line-height:1;}
.sum-tile .l{font-size:11px;margin-top:6px;letter-spacing:0.04em;}
.sum-tile.cont{background:#e8f0ff;color:#234a8c;}
.sum-tile.new{background:#dcfce7;color:#14532d;}
.sum-tile.chg{background:#fef3c7;color:#854d0e;}
.sum-tile.stop{background:#fee2e2;color:#7f1d1d;}
.sec{margin-top:14px;}
.sec h3{font-size:12px;font-weight:600;color:#2e3f58;margin:0 0 6px;padding:4px 8px;background:#e4eef8;border-left:3px solid #2e3f58;}
table.med{width:100%;border-collapse:collapse;font-size:11px;}
table.med th,table.med td{border:0.5px solid #999;padding:5px 7px;vertical-align:top;}
table.med th{background:#f5f4f2;font-weight:600;color:#2e3f58;text-align:left;font-size:10px;letter-spacing:0.04em;}
table.med td.no{text-align:center;width:22px;}
table.med td.qty{text-align:center;width:54px;}
.tag{display:inline-block;font-size:9px;padding:1px 6px;border-radius:99px;margin-left:4px;font-weight:600;}
.tag-new{background:#d4edda;color:#155724;}
.tag-chg{background:#ffd79e;color:#7a4a00;}
.tag-stop{background:#f8d7da;color:#721c24;}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px;font-size:11px;}
.sign .box{border-top:1px dotted #888;padding-top:4px;text-align:center;}
.ft{position:absolute;bottom:10mm;left:14mm;right:14mm;font-size:9px;color:#999;text-align:center;border-top:0.5px solid #ddd;padding-top:4px;}

/* Large print card */
.card-page{padding:10mm 12mm;}
.card-banner{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;margin-bottom:14px;}
.card-banner.new{background:#22c55e;color:white;}
.card-banner.chg{background:#f59e0b;color:white;}
.card-banner.stop{background:#dc2626;color:white;}
.card-banner.cont{background:#f5f4f2;color:#555;border:1px solid #ddd;}
.card-banner.warfarin{background:#dc2626;color:white;}
.card-banner .bn-title{font-size:22px;font-weight:700;}
.card-banner .bn-num{font-size:14px;opacity:0.8;}
.drug-name{font-size:52px;font-weight:700;line-height:1.1;color:#111;margin-bottom:6px;letter-spacing:-0.01em;}
.drug-strength{font-size:20px;color:#555;margin-bottom:4px;}
.drug-purpose{font-size:28px;color:#2e3f58;font-weight:500;padding:10px 16px;background:#f5f4f2;border-radius:10px;margin:10px 0 18px;display:inline-block;border-left:5px solid #2e3f58;}

/* Dot grid */
.dot-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0;}
.dot-cell{border:2px solid #ccc;border-radius:12px;padding:14px 6px 16px;text-align:center;}
.dot-cell.on{border-color:#111;border-width:3px;background:#faf8f3;}
.dot-cell.off{opacity:0.4;}
.dot-emoji{font-size:40px;line-height:1;margin-bottom:6px;}
.dot-time{font-size:14px;color:#666;margin-bottom:10px;font-weight:500;}
.dot-num{font-size:64px;font-weight:700;line-height:0.9;color:#111;}
.dot-num.zero{font-size:36px;color:#ccc;}
.dot-unit{font-size:13px;color:#777;margin-top:2px;}

/* Sig Thai */
.sig-thai{font-size:36px;line-height:1.3;margin:16px 0;padding:16px 20px;background:#fffbea;border-radius:10px;border-left:6px solid #f59e0b;}
.sig-thai.error{background:#fef2f2;border-left-color:#dc2626;color:#991b1b;}
.sig-orig{font-size:13px;color:#888;margin-top:8px;font-family:monospace;}
.sig-orig b{color:#555;}
.sig-warn{display:inline-block;margin-left:8px;padding:2px 8px;background:#dc2626;color:white;border-radius:4px;font-size:12px;font-weight:500;}

/* Warning / next box */
.warn{margin-top:14px;padding:12px 16px;border-radius:10px;background:#fef2f2;border-left:5px solid #dc2626;}
.warn-title{font-size:18px;font-weight:700;color:#991b1b;margin-bottom:4px;}
.warn-text{font-size:20px;color:#450a0a;line-height:1.5;}
.next-box{margin-top:14px;padding:14px;background:#f0f9ff;border-radius:10px;border:1px solid #bfdbfe;font-size:12px;color:#1e3a8a;}
.next-box b{display:block;font-size:13px;margin-bottom:4px;}

/* Before/after (change) */
.ba-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;}
.ba-box{padding:12px;border-radius:10px;}
.ba-before{background:#fef3c7;border-left:4px solid #f59e0b;}
.ba-after{background:#dcfce7;border-left:4px solid #22c55e;}
.ba-label{font-size:12px;color:#666;margin-bottom:4px;}
.ba-text{font-size:26px;font-weight:500;}
.ba-before .ba-text{text-decoration:line-through;color:#999;}
.ba-after .ba-text{font-weight:700;color:#14532d;}

/* Stop */
.stop-name{position:relative;display:inline-block;color:#999;}
.stop-name::after{content:'';position:absolute;left:-4px;right:-4px;top:48%;height:6px;background:#dc2626;}
.stop-msg{font-size:48px;font-weight:700;color:#dc2626;margin:24px 0;text-align:center;padding:24px;background:#fef2f2;border-radius:12px;border:3px solid #dc2626;}

/* PRN */
.prn-box{margin:20px 0;padding:20px;background:#f5f4f2;border-radius:12px;border-left:6px solid #2e3f58;}
.prn-icons{display:flex;gap:20px;align-items:center;flex-wrap:wrap;}
.prn-item{text-align:center;}
.prn-emoji{font-size:42px;}
.prn-label{font-size:18px;color:#333;}

/* Insulin syringe */
.ins-guide-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 16px;}
.ins-guide{border:2px solid #111;border-radius:12px;padding:12px 14px;background:#faf8f3;}
.ins-guide-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #ddd;}
.ins-guide-emoji{font-size:32px;line-height:1;}
.ins-guide-time{font-size:16px;font-weight:600;color:#111;flex:1;}
.ins-guide-dose{font-size:30px;font-weight:700;color:#111;line-height:1;}
.ins-guide-dose small{font-size:12px;font-weight:500;color:#666;margin-left:3px;}
.ins-guide-body{display:flex;gap:10px;align-items:flex-start;}
.ins-guide-zoom{flex:1;}
.ins-guide-note{font-size:10px;color:#666;margin-top:8px;line-height:1.5;border-top:1px solid #eee;padding-top:6px;}

/* Warfarin */
.twd-banner{margin:14px 0 14px;padding:16px 20px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px solid #f59e0b;border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
.twd-label{font-size:14px;color:#92400e;letter-spacing:0.06em;text-transform:uppercase;font-weight:500;}
.twd-value{font-size:52px;font-weight:700;color:#7c2d12;line-height:1;}
.twd-value small{font-size:18px;font-weight:500;margin-left:4px;color:#92400e;}
.twd-note{font-size:14px;color:#7c2d12;text-align:right;line-height:1.5;}
.twd-note b{display:block;font-size:16px;}
.strength-legend{display:flex;gap:12px;margin:8px 0 14px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #e5e5e5;flex-wrap:wrap;}
.sl-item{display:flex;align-items:center;gap:8px;font-size:14px;}
.sl-swatch{width:28px;height:28px;border-radius:50%;border:1.5px solid #333;}
.sl-text b{font-weight:700;}
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:10px 0;}
.day-cell{border:2px solid #d4d4d4;border-radius:12px;padding:10px 4px 12px;text-align:center;background:white;}
.day-cell.has-dose{border-color:#111;border-width:2.5px;}
.day-name{font-size:15px;font-weight:700;color:#111;margin-bottom:2px;}
.day-sub{font-size:10px;color:#888;margin-bottom:8px;letter-spacing:0.05em;text-transform:uppercase;}
.day-pills{display:flex;justify-content:center;align-items:center;gap:3px;height:92px;}
.day-pills svg{width:72px;height:72px;}
.day-pills.two svg{width:56px;height:56px;}
.day-dose{font-size:18px;font-weight:700;color:#111;margin-top:8px;line-height:1.1;}
.day-mg{font-size:12px;color:#444;margin-top:3px;font-weight:500;}
.day-color{font-size:11px;color:#666;margin-top:2px;font-style:italic;}
.day-cell.zero .day-pills{opacity:0.4;}
.day-cell.zero .day-dose,.day-cell.zero .day-mg,.day-cell.zero .day-color{color:#bbb;}
.time-banner{margin:12px 0;padding:12px 18px;background:#1e3a8a;color:white;border-radius:10px;font-size:22px;font-weight:600;text-align:center;display:flex;align-items:center;justify-content:center;gap:10px;}
.inr-banner{margin:10px 0;padding:12px 18px;background:#eff6ff;border:2px dashed #1e40af;border-radius:10px;font-size:18px;color:#1e3a8a;font-weight:600;display:flex;align-items:center;gap:10px;}

.card-foot{position:absolute;bottom:10mm;left:12mm;right:12mm;display:flex;justify-content:space-between;font-size:10px;color:#999;border-top:0.5px solid #ddd;padding-top:4px;}

@media print{
  body{background:white;}
  @page{size:A4 portrait;margin:0;}
}
`;

  // ── Helpers ────────────────────────────────────────────────────

  function esc(s){
    if(s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function fmtDate(d){
    if(!d) return '';
    if(typeof d === 'string') return d;
    if(d instanceof Date){
      var dd = ('0'+d.getDate()).slice(-2);
      var mm = ('0'+(d.getMonth()+1)).slice(-2);
      var yy = d.getFullYear()+543;
      return dd+'/'+mm+'/'+yy;
    }
    return String(d);
  }

  /** Translate sig ผ่าน SigTranslator (if loaded) หรือ override */
  function translateSig(sig, override){
    if(override && override.trim()) return { ok:true, thai: override };
    var T = (typeof SigTranslator !== 'undefined') ? SigTranslator :
            (typeof root !== 'undefined' && root.SigTranslator) ? root.SigTranslator :
            null;
    if(!T) return { ok:false, reason:'sig_translator not loaded' };
    return T.translate(sig || '');
  }

  /** Detect drug type for card selection */
  function detectDrugType(drug){
    var name = (drug.name || '').toLowerCase();
    var route = (drug.route || '').toLowerCase();
    var sig  = (drug.sig  || '').toLowerCase();

    if(/warfarin|orfarin|marevan/.test(name)) return 'warfarin';

    // Insulin — expanded to include Thai hospital brands
    if(/insulin|gensulin|mixtard|humulin|actrapid|novomix|lantus|levemir|humalog|novorapid|ryzodeg|tresiba|toujeo|novolin|apidra|\bnph\b|\bri\b/.test(name)
       || route === 'sc'
       || /^\*?sc\b/.test(sig)
       || /penfill|cartridge/.test(name))
      return 'insulin';

    // Inhaler (MDI/DPI)
    if(/\binhaler\b|\bmdi\b|\bdpi\b|ventolin|berodual|seretide|symbicort|pulmicort|aerotide|accuhaler|evohaler|atrovent|spiriva|bricanyl|turbuhaler/.test(name)
       || /^mdi/.test(sig))
      return 'inhaler';

    if(/pr\b|prn/.test(sig)) return 'prn';
    return 'oral';
  }

  // ── Dot grid renderer ──────────────────────────────────────────

  function renderDotGrid(qty, freq, suffix){
    // Use SigTranslator.dotGrid if available
    var grid;
    var T = (typeof SigTranslator !== 'undefined') ? SigTranslator : null;
    if(T && T.dotGrid) grid = T.dotGrid(freq, qty, suffix);
    else {
      // Fallback — default spread
      grid = { m:0, n:0, e:0, b:0 };
      if(freq === 1) grid.m = qty;
      else if(freq === 2){ grid.m = qty; grid.e = qty; }
      else if(freq === 3){ grid.m = qty; grid.n = qty; grid.e = qty; }
      else if(freq === 4){ grid.m = qty; grid.n = qty; grid.e = qty; grid.b = qty; }
    }

    function qtyTxt(n){
      if(!n) return '0';
      if(n === 0.5) return '½';
      if(n === 0.25) return '¼';
      if(n === 0.75) return '¾';
      if(n === 1.5) return '1½';
      if(Number.isInteger(n)) return String(n);
      return String(+n.toFixed(2));
    }

    var slots = ['m','n','e','b'];
    var cells = slots.map(function(s){
      var n = grid[s];
      var on = n > 0;
      return `<div class="dot-cell ${on?'on':'off'}">
        <div class="dot-emoji">${MEAL_EMOJIS[s]}</div>
        <div class="dot-time">${MEAL_TH[s]}</div>
        <div class="dot-num ${on?'':'zero'}">${qtyTxt(n)}</div>
        <div class="dot-unit">${on ? 'เม็ด' : '&nbsp;'}</div>
      </div>`;
    });
    return `<div class="dot-grid">${cells.join('')}</div>`;
  }

  // ── Insulin pen SVG (GensuPen 2 — teal body + clear cartridge + black grip + dose window) ──
  // ออกแบบตามรูปอุปกรณ์จริง: needle → cartridge โปร่งใส → teal barrel + label →
  //                             black central clip → dose window → black end cap + green dot
  function buildPenSVG(dose, opts){
    opts = opts || {};
    var color     = opts.color     || '#3BCFD4';   // GensuPen 2 teal (default)
    var accent    = opts.accent    || '#0e7490';   // dark teal (stroke/accent)
    var label     = opts.label     || 'GensuPen 2';
    var labelColor= opts.labelColor|| accent;
    return '<svg viewBox="0 0 500 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">'
      // ── Far left: needle ──
      + '<line x1="2" y1="50" x2="26" y2="50" stroke="#6b7280" stroke-width="1.3"/>'
      + '<polygon points="2,50 10,47 10,53" fill="#4b5563"/>'
      // needle cap / hub (clear plastic)
      + '<rect x="26" y="37" width="48" height="26" rx="5" fill="#f3f4f6" fill-opacity="0.7" stroke="#9ca3af" stroke-width="1"/>'
      // ── Cartridge holder (โปร่งใส เห็น insulin + plunger) ──
      + '<rect x="74" y="30" width="80" height="40" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5" rx="1"/>'
      // insulin liquid (อ่อน ๆ)
      + '<rect x="78" y="34" width="70" height="32" fill="#e0f2fe" opacity="0.5"/>'
      // green plunger stopper (ตามรูปจริง)
      + '<rect x="142" y="34" width="10" height="32" fill="#86efac" stroke="#16a34a" stroke-width="0.8"/>'
      + '<rect x="144" y="36" width="2" height="28" fill="#4ade80"/>'
      // ── Main teal body ──
      + '<rect x="154" y="20" width="260" height="60" rx="8" fill="'+color+'" stroke="'+accent+'" stroke-width="1.5"/>'
      // gloss (ด้านบน)
      + '<rect x="160" y="24" width="250" height="7" rx="3.5" fill="white" opacity="0.35"/>'
      // ── Product label "GensuPen 2" (ขาว-เงา พร้อมเส้นขอบ) ──
      + '<rect x="168" y="38" width="84" height="24" rx="2" fill="#e0f7fa" stroke="'+accent+'" stroke-width="0.6"/>'
      + '<text x="210" y="55" text-anchor="middle" font-size="12" font-family="Google Sans,sans-serif" font-weight="700" fill="'+labelColor+'">'+label+'</text>'
      // ── Central black grip / clip (แนวตั้ง แคบ ตามรูป) ──
      + '<rect x="258" y="28" width="50" height="44" rx="4" fill="#111827"/>'
      // grip texture (ขีดแนวตั้ง)
      + '<line x1="268" y1="34" x2="268" y2="66" stroke="#4b5563" stroke-width="0.6"/>'
      + '<line x1="277" y1="34" x2="277" y2="66" stroke="#4b5563" stroke-width="0.6"/>'
      + '<line x1="286" y1="34" x2="286" y2="66" stroke="#4b5563" stroke-width="0.6"/>'
      + '<line x1="295" y1="34" x2="295" y2="66" stroke="#4b5563" stroke-width="0.6"/>'
      // ── Dose window (ด้านขวา) ──
      + '<rect x="320" y="32" width="80" height="36" rx="3" fill="#111827" stroke="#000" stroke-width="0.8"/>'
      + '<rect x="326" y="37" width="68" height="26" fill="white" stroke="#374151" stroke-width="0.5" rx="1"/>'
      + '<text x="360" y="57" text-anchor="middle" font-size="22" font-family="Google Sans,sans-serif" font-weight="700" fill="#0f172a">'+dose+'</text>'
      // indicator tick (สีขาว ใต้ window)
      + '<line x1="360" y1="65" x2="360" y2="71" stroke="white" stroke-width="2" stroke-linecap="round"/>'
      // ── Black end cap + green indicator dot ──
      + '<rect x="414" y="20" width="72" height="60" rx="8" fill="#1f2937" stroke="#000" stroke-width="1"/>'
      + '<rect x="418" y="24" width="64" height="6" rx="3" fill="white" opacity="0.15"/>'
      + '<circle cx="468" cy="50" r="5" fill="#10b981" stroke="#047857" stroke-width="1"/>'
      + '</svg>';
  }

  // ── Syringe SVG (for insulin vial — 0 at needle/top, 100 at plunger/bottom) ──

  function buildSyringeSVG(dose){
    function yF(u){return 12 + u*2.5;}
    var prevMaj = Math.floor(dose/10)*10;
    var nextMaj = prevMaj+10; if(nextMaj>100) nextMaj=100;
    var ZTOP=20, ZBOT=250, ZH=230;
    var rangeU = nextMaj - prevMaj;
    var PER2 = ZH / (rangeU / 2);
    function yZ(u){return ZTOP + (u - prevMaj)/2*PER2;}

    var fullSvg = '<svg width="44" height="292" viewBox="0 0 56 292" style="flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">';
    fullSvg += '<line x1="21" y1="2" x2="21" y2="12" stroke="#888" stroke-width="1.5"/>';
    fullSvg += '<rect x="11" y="12" width="20" height="250" rx="3" fill="white" stroke="#333" stroke-width="1.5"/>';
    var yT = yF(dose);
    fullSvg += '<rect x="12" y="12" width="18" height="'+(yT-12)+'" fill="#333"/>';
    fullSvg += '<line x1="5" y1="'+yT+'" x2="36" y2="'+yT+'" stroke="#000" stroke-width="3"/>';
    fullSvg += '<polygon points="3,'+yT+' 9,'+(yT-4)+' 9,'+(yT+4)+'" fill="#000"/>';
    for(var u=10; u<=100; u+=10){
      var y = yF(u);
      fullSvg += '<line x1="31" y1="'+y+'" x2="35" y2="'+y+'" stroke="#555" stroke-width="1.2"/>';
      fullSvg += '<text x="37" y="'+(y+3)+'" font-size="7" font-family="Google Sans,sans-serif" fill="#444">'+u+'</text>';
    }
    fullSvg += '<text x="37" y="'+(yT-2)+'" font-size="7" font-family="Google Sans,sans-serif" fill="#000" font-weight="500">◀'+dose+'</text>';
    fullSvg += '<text x="37" y="15" font-size="7" font-family="Google Sans,sans-serif" fill="#444">0</text>';
    for(var u2=2; u2<=98; u2+=2){
      if(u2%10===0) continue;
      var y2 = yF(u2), isTgt = (u2===dose);
      fullSvg += '<line x1="11" y1="'+y2+'" x2="15" y2="'+y2+'" stroke="'+(isTgt?'#000':'#CCC')+'" stroke-width="'+(isTgt?'2':'0.8')+'"/>';
    }
    var yZT = yF(prevMaj), yZB = yF(nextMaj);
    fullSvg += '<rect x="10" y="'+yZT+'" width="22" height="'+(yZB-yZT)+'" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="3,2"/>';
    fullSvg += '<rect x="4" y="262" width="34" height="7" rx="2" fill="#DDD" stroke="#999" stroke-width="1"/>';
    fullSvg += '<rect x="15" y="269" width="12" height="14" rx="1" fill="#EEE" stroke="#BBB" stroke-width="1"/>';
    fullSvg += '<rect x="2" y="279" width="38" height="5" rx="2" fill="#DDD" stroke="#999" stroke-width="1"/>';
    fullSvg += '</svg>';

    var zSvg = '<svg width="100%" height="270" viewBox="0 0 148 270" xmlns="http://www.w3.org/2000/svg">';
    zSvg += '<rect x="30" y="'+ZTOP+'" width="52" height="'+ZH+'" rx="4" fill="white" stroke="#333" stroke-width="2"/>';
    var yFill = yZ(dose);
    var fillH = yFill - ZTOP;
    if(fillH > 0) zSvg += '<rect x="32" y="'+ZTOP+'" width="48" height="'+fillH+'" fill="#333"/>';
    zSvg += '<line x1="8" y1="'+yFill+'" x2="92" y2="'+yFill+'" stroke="#000" stroke-width="5"/>';
    zSvg += '<polygon points="5,'+yFill+' 15,'+(yFill-7)+' 15,'+(yFill+7)+'" fill="#000"/>';
    for(var zu=prevMaj; zu<=nextMaj; zu+=2){
      var zy = yZ(zu), isMaj = (zu%10===0), isTgt2 = (zu===dose);
      if(isTgt2){
        zSvg += '<rect x="94" y="'+(zy-12)+'" width="40" height="24" rx="3" fill="#000"/>';
        zSvg += '<text x="114" y="'+(zy+5)+'" font-size="14" fill="white" font-weight="500" text-anchor="middle">'+zu+'</text>';
        zSvg += '<rect x="16" y="'+(zy-12)+'" width="14" height="24" rx="3" fill="#000"/>';
        zSvg += '<text x="23" y="'+(zy+5)+'" font-size="14" fill="white" font-weight="500" text-anchor="middle">'+zu+'</text>';
      } else if(isMaj){
        zSvg += '<line x1="82" y1="'+zy+'" x2="97" y2="'+zy+'" stroke="#333" stroke-width="2.5"/>';
        zSvg += '<text x="100" y="'+(zy+5)+'" font-size="15" fill="#222" font-weight="500">'+zu+'</text>';
        zSvg += '<line x1="30" y1="'+zy+'" x2="15" y2="'+zy+'" stroke="#333" stroke-width="2.5"/>';
        zSvg += '<text x="0" y="'+(zy+5)+'" font-size="15" fill="#222" font-weight="500">'+zu+'</text>';
      } else {
        zSvg += '<line x1="82" y1="'+zy+'" x2="92" y2="'+zy+'" stroke="#555" stroke-width="1.5"/>';
        zSvg += '<text x="95" y="'+(zy+4)+'" font-size="13" fill="#444">'+zu+'</text>';
        zSvg += '<line x1="30" y1="'+zy+'" x2="20" y2="'+zy+'" stroke="#555" stroke-width="1.5"/>';
        zSvg += '<text x="5" y="'+(zy+4)+'" font-size="13" fill="#444">'+zu+'</text>';
      }
    }
    zSvg += '</svg>';
    return fullSvg + '<div class="ins-guide-zoom">' + zSvg + '</div>';
  }

  // ── Warfarin pill SVGs ────────────────────────────────────────

  function pillFull(strength){
    var c = WF_COLORS[strength] || WF_COLORS[3];
    var gid = 'gf_'+strength+'_'+Math.random().toString(36).substr(2,6);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><radialGradient id="'+gid+'" cx="35%" cy="30%" r="70%">'
      +'<stop offset="0%" stop-color="white" stop-opacity="0.55"/>'
      +'<stop offset="35%" stop-color="'+c.fill+'"/><stop offset="100%" stop-color="'+c.fill+'"/>'
      +'</radialGradient></defs>'
      +'<ellipse cx="50" cy="88" rx="32" ry="4" fill="#000" opacity="0.18"/>'
      +'<circle cx="50" cy="48" r="36" fill="url(#'+gid+')" stroke="'+c.stroke+'" stroke-width="3"/>'
      +'<line x1="50" y1="14" x2="50" y2="82" stroke="'+c.stroke+'" stroke-width="2.5" opacity="0.5"/>'
      +'<ellipse cx="36" cy="30" rx="13" ry="6" fill="white" opacity="0.55"/>'
      +'</svg>';
  }

  function pillHalf(strength){
    var c = WF_COLORS[strength] || WF_COLORS[3];
    var gid = 'gh_'+strength+'_'+Math.random().toString(36).substr(2,6);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><radialGradient id="'+gid+'" cx="50%" cy="25%" r="70%">'
      +'<stop offset="0%" stop-color="white" stop-opacity="0.55"/>'
      +'<stop offset="35%" stop-color="'+c.fill+'"/><stop offset="100%" stop-color="'+c.fill+'"/>'
      +'</radialGradient></defs>'
      +'<ellipse cx="58" cy="88" rx="22" ry="4" fill="#000" opacity="0.18"/>'
      +'<path d="M 50 12 A 36 36 0 0 0 50 84 Z" fill="none" stroke="'+c.stroke+'" stroke-width="2" stroke-dasharray="4,3" opacity="0.3"/>'
      +'<path d="M 50 12 A 36 36 0 0 1 50 84 Z" fill="url(#'+gid+')" stroke="'+c.stroke+'" stroke-width="3"/>'
      +'<line x1="50" y1="12" x2="50" y2="84" stroke="'+c.stroke+'" stroke-width="3"/>'
      +'<line x1="53" y1="16" x2="53" y2="80" stroke="#000" stroke-width="1" opacity="0.15"/>'
      +'<ellipse cx="64" cy="28" rx="10" ry="5" fill="white" opacity="0.5"/>'
      +'<text x="72" y="60" text-anchor="middle" font-size="36" font-family="Google Sans,sans-serif" font-weight="700" fill="white" stroke="'+c.stroke+'" stroke-width="1.5">½</text>'
      +'</svg>';
  }

  function pillZero(){
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="36" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="5,4" opacity="0.4"/>'
      +'<text x="50" y="62" text-anchor="middle" font-size="40" font-family="Google Sans,sans-serif" fill="#bbb">—</text>'
      +'</svg>';
  }

  // ── Card builders ──────────────────────────────────────────────

  function bannerHTML(status, idx, total){
    var map = {
      cont: { cls:'cont', title:'✓ ยาเดิม ใช้ต่อ' },
      chg:  { cls:'chg',  title:'⚡ ยาเดิม ปรับขนาดใหม่' },
      new:  { cls:'new',  title:'⭐ ยาใหม่ เริ่มใช้วันนี้' },
      stop: { cls:'stop', title:'✕ ยานี้ หยุดใช้แล้ว' },
    };
    var b = map[status] || map.cont;
    return `<div class="card-banner ${b.cls}">
      <div class="bn-title">${b.title}</div>
      <div class="bn-num">ยาตัวที่ ${idx+1}/${total}</div>
    </div>`;
  }

  function sigBlock(drug){
    var r = translateSig(drug.sig, drug.sigThai);
    if(r.ok){
      return `<div class="sig-thai">
        <b>วิธีรับประทาน:</b><br>
        ${esc(r.thai)}
        <div class="sig-orig"><b>HOSxP code:</b> ${esc(drug.sig || '—')}</div>
      </div>`;
    } else {
      return `<div class="sig-thai error">
        <b>⚠ แปล HOSxP code ไม่ได้ — เภสัชฯ ต้องพิมพ์ภาษาไทยเอง</b>
        <div class="sig-orig"><b>HOSxP code:</b> ${esc(drug.sig || '—')}
          <span class="sig-warn">ต้องแก้</span>
        </div>
      </div>`;
    }
  }

  function warnBlock(text, title){
    if(!text) return '';
    return `<div class="warn">
      <div class="warn-title">⚠️ ${esc(title || 'ข้อควรระวัง')}</div>
      <div class="warn-text">${String(text).replace(/\n/g,'<br>')}</div>
    </div>`;
  }

  function footerHTML(patient, idx, total){
    return `<div class="card-foot">
      <div>HN ${esc(patient.hn)} · ${esc(patient.name)}</div>
      <div>หน้า ${idx+2}/${total+1}</div>
    </div>`;
  }

  /** Standard oral card with dot grid */
  function buildOralCard(drug, status, idx, total, patient){
    var parts = (translateSig(drug.sig, drug.sigThai).parts) || {};
    var qty = parts.qty || 1;
    var freq = parts.freq || 1;
    var suffix = parts.suffix || '';

    return `<div class="page card-page">
      ${bannerHTML(status, idx, total)}
      <div class="drug-name">${esc(drug.name)}</div>
      ${drug.strength ? `<div class="drug-strength">${esc(drug.strength)}</div>` : ''}
      ${drug.purpose ? `<div class="drug-purpose">${esc(drug.purpose)}</div>` : ''}
      ${renderDotGrid(qty, freq, suffix)}
      ${sigBlock(drug)}
      ${warnBlock(drug.warnings)}
      ${status === 'chg' && drug.reason ? `<div class="next-box"><b>เหตุผลที่แพทย์ปรับขนาด:</b>${esc(drug.reason)}</div>` : ''}
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** Change card — before/after visual */
  function buildChangeCard(drug, idx, total, patient){
    var before = translateSig(drug.sigBefore, drug.sigBeforeThai);
    var after  = translateSig(drug.sigAfter || drug.sig, drug.sigThai);
    var parts = (after.parts || {});

    return `<div class="page card-page">
      ${bannerHTML('chg', idx, total)}
      <div class="drug-name">${esc(drug.name)}</div>
      ${drug.strength ? `<div class="drug-strength">${esc(drug.strength)}</div>` : ''}
      ${drug.purpose ? `<div class="drug-purpose">${esc(drug.purpose)}</div>` : ''}
      <div class="ba-grid">
        <div class="ba-box ba-before"><div class="ba-label">ของเดิม</div><div class="ba-text">${esc(before.ok?before.thai:drug.sigBefore||'—')}</div></div>
        <div class="ba-box ba-after"><div class="ba-label">ของใหม่ (กินแบบนี้)</div><div class="ba-text">${esc(after.ok?after.thai:drug.sig||'—')}</div></div>
      </div>
      ${renderDotGrid(parts.qty||1, parts.freq||1, parts.suffix||'')}
      ${sigBlock(drug)}
      ${drug.reason ? `<div class="next-box"><b>เหตุผลที่แพทย์ปรับขนาด:</b>${esc(drug.reason)}</div>` : ''}
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** PRN card — icon-based */
  function buildPRNCard(drug, status, idx, total, patient){
    // Detect symptom hints from drug name/note
    var isPCM = /paracetamol|pcm/i.test(drug.name + ' ' + (drug.sig||''));
    var icons = isPCM
      ? [{emoji:'🤒', label:'มีไข้'}, {emoji:'🤕', label:'ปวดศีรษะ/ปวดตัว'}]
      : [{emoji:'😣', label:'มีอาการ'}];

    return `<div class="page card-page">
      ${bannerHTML(status, idx, total)}
      <div class="drug-name">${esc(drug.name)}</div>
      ${drug.strength ? `<div class="drug-strength">${esc(drug.strength)}</div>` : ''}
      ${drug.purpose ? `<div class="drug-purpose">${esc(drug.purpose)}</div>` : ''}
      <div class="prn-box">
        <div style="font-size:16px;color:#555;margin-bottom:10px;font-weight:500;">กินเมื่อมีอาการ:</div>
        <div class="prn-icons">
          ${icons.map(function(i, k){ return (k>0?'<div style="font-size:30px;color:#ccc;">หรือ</div>':'') + `<div class="prn-item"><div class="prn-emoji">${i.emoji}</div><div class="prn-label">${esc(i.label)}</div></div>`; }).join('')}
        </div>
      </div>
      ${sigBlock(drug)}
      ${warnBlock(drug.warnings || (isPCM ? 'ห้ามเกินวันละ 8 เม็ด (4 กรัม) — ถ้ากินครบแล้วยังไม่หาย ให้รีบมาพบแพทย์' : ''), 'ข้อควรระวัง')}
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** Insulin card — syringe guide per dose time */
  function buildInsulinCard(drug, status, idx, total, patient){
    // doses: [{time:'morning'|'noon'|'evening'|'bedtime', units:N}, ...]
    var doses = drug.doses || [];
    // Fallback: parse จาก sig เช่น "22-0-14 u" หรือ "10-0-0-8" หรือ "*sc 10-0-8"
    // 4-position convention: morning-noon-evening-bedtime
    // 3-position convention: morning-noon-evening  (standard Thai prescribing)
    if(!doses.length && drug.sig){
      var s = String(drug.sig);
      var m4 = s.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
      var m3 = s.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
      if(m4){
        if(+m4[1]>0) doses.push({time:'morning', units:+m4[1]});
        if(+m4[2]>0) doses.push({time:'noon',    units:+m4[2]});
        if(+m4[3]>0) doses.push({time:'evening', units:+m4[3]});
        if(+m4[4]>0) doses.push({time:'bedtime', units:+m4[4]});
      } else if(m3){
        if(+m3[1]>0) doses.push({time:'morning', units:+m3[1]});
        if(+m3[2]>0) doses.push({time:'noon',    units:+m3[2]});
        if(+m3[3]>0) doses.push({time:'evening', units:+m3[3]});
      }
    }

    var timeEmojis = { morning:'🌅', noon:'☀️', evening:'🌆', bedtime:'🌙' };
    var timeTh     = { morning:'เช้า', noon:'กลางวัน', evening:'เย็น', bedtime:'ก่อนนอน' };

    // เลือก device type — ที่ รพ.ห้วยผึ้ง:
    //   • Gensulin → Gensupen (teal pen)
    //   • Mixtard, NPH, RI → syringe + vial
    //   • ยี่ห้ออื่นที่ชื่อระบุ penfill/flexpen/kwikpen/solostar → pen
    var nameL = (drug.name || '').toLowerCase();
    var isPen = /gensulin|gensupen/.test(nameL)
             || /penfill|flexpen|kwikpen|solostar|prefilled/.test(nameL);

    // ตั้งค่าปากกาตาม brand (GensuPen 2 = default ที่ รพ.ห้วยผึ้ง)
    var penOpts = { color:'#3BCFD4', accent:'#0e7490', label:'GensuPen 2' };
    if(/lantus|solostar/.test(nameL))        { penOpts = { color:'#9ca3af', accent:'#4b5563', label:'Lantus SoloStar' }; }
    else if(/levemir|flexpen/.test(nameL))   { penOpts = { color:'#10b981', accent:'#065f46', label:'Levemir FlexPen' }; }
    else if(/novorapid|kwikpen/.test(nameL)) { penOpts = { color:'#ef4444', accent:'#991b1b', label:'NovoRapid' }; }

    var deviceLabel = isPen
      ? 'หมุน dial ให้ตัวเลขในช่องตรงกับขนาดที่ต้องฉีด'
      : 'กล่องดำ = ขีดที่ต้องดูดยาถึง · 1 ขีด = 2 ยูนิต · 0 อยู่ด้านเข็ม';
    var deviceTitle = isPen
      ? 'วิธีฉีด — ' + penOpts.label + ' (SC) ที่หน้าท้อง/ต้นขา'
      : 'วิธีฉีด — ใต้ผิวหนัง (SC) ที่หน้าท้อง/ต้นขา';

    var guides = doses.map(function(d){
      var deviceSVG = isPen ? buildPenSVG(d.units, penOpts) : buildSyringeSVG(d.units);
      return `<div class="ins-guide">
        <div class="ins-guide-head">
          <div class="ins-guide-emoji">${timeEmojis[d.time] || '💉'}</div>
          <div class="ins-guide-time">${esc(timeTh[d.time] || d.time)}</div>
          <div class="ins-guide-dose">${d.units}<small>U</small></div>
        </div>
        <div class="ins-guide-body${isPen ? ' ins-pen' : ''}">${deviceSVG}</div>
        <div class="ins-guide-note">${deviceLabel}</div>
      </div>`;
    });

    return `<div class="page card-page">
      ${bannerHTML(status, idx, total)}
      <div class="drug-name">${esc(drug.name)}</div>
      ${drug.strength ? `<div class="drug-strength">${esc(drug.strength)}</div>` : ''}
      ${drug.purpose ? `<div class="drug-purpose">${esc(drug.purpose)}</div>` : ''}
      <div style="font-size:13px;color:#666;letter-spacing:0.06em;text-transform:uppercase;margin:10px 0 6px;font-weight:500;">${deviceTitle}</div>
      <div class="ins-guide-grid">${guides.join('')}</div>
      ${sigBlock(drug)}
      ${warnBlock(drug.warnings || 'ถ้ารู้สึก ใจสั่น เหงื่อออก หิวจัด มือสั่น ให้อม ลูกอม/น้ำหวาน ทันที แล้วรีบมาพบแพทย์', 'สัญญาณน้ำตาลต่ำ')}
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** Warfarin card — weekly regimen grid */
  function buildWarfarinCard(drug, status, idx, total, patient, options){
    // regimen: array(7) ของ { pills: [{strength, count}] } เรียงจาก จันทร์
    var regimen = drug.regimen || [];
    var dayNames = [
      {name:'จันทร์', sub:'จ'},
      {name:'อังคาร', sub:'อ'},
      {name:'พุธ',    sub:'พ'},
      {name:'พฤหัสบดี', sub:'พฤ'},
      {name:'ศุกร์',  sub:'ศ'},
      {name:'เสาร์',  sub:'ส'},
      {name:'อาทิตย์', sub:'อา'},
    ];

    function qtyTxt(n){
      if(n === 0.5) return '½ เม็ด';
      if(n === 1) return '1 เม็ด';
      if(n === 1.5) return '1½ เม็ด';
      if(n === 2) return '2 เม็ด';
      if(n === 0) return 'งดกิน';
      return n + ' เม็ด';
    }

    var usedStrengths = {};
    var twdMg = 0, totalTabs = 0;

    var cells = dayNames.map(function(dn, i){
      var day = regimen[i] || { pills: [] };
      var pills = day.pills || [];
      var pillHTML = '';
      var doseTexts = [];
      var colorNames = [];
      var dayMg = 0;

      if(!pills.length){
        pillHTML = pillZero();
        doseTexts.push('งดกิน');
      } else {
        pills.forEach(function(p){
          var col = WF_COLORS[p.strength] || WF_COLORS[3];
          usedStrengths[p.strength] = true;
          if(p.count === 0.5) pillHTML += pillHalf(p.strength);
          else if(p.count === 1) pillHTML += pillFull(p.strength);
          else if(p.count === 1.5) pillHTML += pillFull(p.strength) + pillHalf(p.strength);
          else if(p.count === 2) pillHTML += pillFull(p.strength) + pillFull(p.strength);
          doseTexts.push(qtyTxt(p.count));
          if(colorNames.indexOf(col.name) === -1) colorNames.push(col.name);
          dayMg += p.count * p.strength;
          totalTabs += p.count;
        });
      }
      twdMg += dayMg;
      var pillCount = pills.reduce(function(s,p){ return s + (p.count<=1 ? 1 : 2); }, 0);
      var pillsClass = pillCount >= 2 ? 'day-pills two' : 'day-pills';
      var cls = pills.length ? 'day-cell has-dose' : 'day-cell zero';
      return `<div class="${cls}">
        <div class="day-name">${dn.name}</div>
        <div class="day-sub">${dn.sub}</div>
        <div class="${pillsClass}">${pillHTML}</div>
        <div class="day-dose">${doseTexts.join(' + ')}</div>
        <div class="day-mg">${dayMg>0 ? dayMg+' mg' : '—'}</div>
        ${colorNames.length ? `<div class="day-color">สี${colorNames.join('+')}</div>` : ''}
      </div>`;
    });

    var legendItems = Object.keys(usedStrengths).sort().map(function(s){
      var c = WF_COLORS[s] || WF_COLORS[3];
      return `<div class="sl-item">
        <div class="sl-swatch" style="background:${c.fill};border-color:${c.stroke};"></div>
        <div class="sl-text">Warfarin <b>${s} mg</b> · <b style="color:${c.stroke};">สี${c.name}</b></div>
      </div>`;
    });

    var strengthLabel = Object.keys(usedStrengths).sort().map(function(s){ return s+' มิลลิกรัม'; }).join(' · ');
    var inrDate = (options && options.inrNextDate) ? options.inrNextDate : drug.inrNextDate;

    return `<div class="page card-page">
      <div class="card-banner warfarin">
        <div class="bn-title">⚠️ HIGH ALERT · ยาต้านการแข็งตัวของเลือด</div>
        <div class="bn-num">ยาตัวที่ ${idx+1}/${total}</div>
      </div>
      <div class="drug-name">Warfarin</div>
      <div class="drug-strength">${esc(strengthLabel || '3 มิลลิกรัม')} · รับประทาน</div>
      <div class="drug-purpose">${esc(drug.purpose || 'ยาต้านการแข็งตัวของเลือด (กันลิ่มเลือดอุดตัน)')}</div>
      <div class="twd-banner">
        <div>
          <div class="twd-label">ปริมาณต่อสัปดาห์ (TWD)</div>
          <div class="twd-value">${twdMg}<small>mg</small></div>
        </div>
        <div class="twd-note">
          <b>${totalTabs} เม็ด / สัปดาห์</b>
          ${Object.keys(usedStrengths).length > 1 ? '(รวม '+Object.keys(usedStrengths).sort().map(function(s){return s+' mg';}).join(' และ ')+')' : ''}
        </div>
      </div>
      <div class="strength-legend">
        <div style="font-size:12px;color:#666;letter-spacing:0.04em;text-transform:uppercase;font-weight:500;margin-right:8px;">ชนิดยาที่ใช้:</div>
        ${legendItems.join('')}
      </div>
      <div class="week-grid">${cells.join('')}</div>
      <div class="time-banner">🌙 รับประทาน<b style="margin-left:4px;">ก่อนนอน</b> ทุกวัน · เวลาเดิมทุกวัน</div>
      ${inrDate ? `<div class="inr-banner">
        <span style="font-size:22px;">📅</span>
        <div>
          <div style="font-size:12px;font-weight:500;color:#3b82f6;letter-spacing:0.04em;text-transform:uppercase;">นัดเจาะ INR ครั้งถัดไป</div>
          <div style="font-size:20px;font-weight:700;">${esc(fmtDate(inrDate))}</div>
        </div>
      </div>` : ''}
      <div class="warn">
        <div class="warn-title">🚨 สัญญาณเลือดออกผิดปกติ — รีบมาโรงพยาบาล</div>
        <div class="warn-text" style="font-size:18px;">
          • มีรอยช้ำ/จ้ำเขียวขึ้นเอง โดยไม่ได้กระแทก<br>
          • เลือดกำเดาไหล / เลือดออกตามไรฟัน หยุดยาก<br>
          • <b>อุจจาระดำ</b> หรือ <b>ปัสสาวะสีชมพู/แดง</b><br>
          • ปวดศีรษะรุนแรง / อาเจียน / ตามัวเฉียบพลัน
        </div>
      </div>
      <div class="next-box">
        <b>ข้อควรรู้เรื่องอาหาร:</b>
        กินผักใบเขียว (คะน้า บรอคโคลี ผักโขม) ได้ แต่กินสม่ำเสมอ <b>ห้ามเปลี่ยนปริมาณขึ้นลงเอง</b>
        · ห้ามกินสมุนไพร/อาหารเสริมโดยไม่ปรึกษาเภสัชฯ ก่อน
      </div>
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** Stop card */
  function buildStopCard(drug, idx, total, patient){
    return `<div class="page card-page">
      ${bannerHTML('stop', idx, total)}
      <div class="drug-name"><span class="stop-name">${esc(drug.name)}</span></div>
      ${drug.strength ? `<div class="drug-strength">${esc(drug.strength)}</div>` : ''}
      <div class="stop-msg">
        ✕ หยุดใช้ยานี้
        <div style="font-size:24px;font-weight:500;color:#7f1d1d;margin-top:8px;line-height:1.4;">
          ถ้ามียาเหลือที่บ้าน<br>
          <b>นำกลับมาที่โรงพยาบาล</b><br>
          <span style="font-size:20px;">หรือทิ้งในถังขยะติดเชื้อ</span>
        </div>
      </div>
      ${drug.reason ? `<div class="next-box"><b>เหตุผลที่แพทย์ให้หยุด:</b>${esc(drug.reason)}</div>` : ''}
      ${drug.warnings ? warnBlock(drug.warnings, 'สำคัญ') : ''}
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** Inhaler card — MDI/DPI (puff-based, มักเป็น PRN) */
  function buildInhalerCard(drug, status, idx, total, patient){
    var sigTrans = translateSig(drug.sig, drug.sigThai);
    var fullText = (drug.sig || '') + ' ' + (drug.sigThai || '') + ' ' + (sigTrans.ok ? sigTrans.thai : '');
    // PRN detection: keywords หรือ bare "mdiNpuff" (ไม่มี freq) → default = PRN
    var isPRN = /pr\b|prn|มีอาการ|หอบ|ไอ|เหนื่อย|หายใจ/i.test(fullText)
              || /^mdi\s*\d+\s*puff\s*$/i.test((drug.sig || '').trim())
              || /^mdi\s*\d+\s*$/i.test((drug.sig || '').trim());

    // Inhaler SVG — Evohaler style (MDI canister + boot + mouthpiece L-shape)
    // สีของ boot ตาม brand (ถ้าระบุได้)
    var drugNameL = (drug.name || '').toLowerCase();
    var bootColor = '#a78bfa';     // default purple (Seretide)
    var bootAccent = '#6d28d9';
    if(/ventolin|salbutamol/.test(drugNameL))  { bootColor = '#60a5fa'; bootAccent = '#1d4ed8'; }  // blue
    if(/berodual|atrovent|ipratropium/.test(drugNameL)) { bootColor = '#5eead4'; bootAccent = '#0f766e'; }  // teal
    if(/pulmicort|budesonide/.test(drugNameL)) { bootColor = '#fca5a5'; bootAccent = '#b91c1c'; }  // reddish
    if(/symbicort/.test(drugNameL))            { bootColor = '#fbbf24'; bootAccent = '#b45309'; }  // amber

    var inhalerSVG = '<svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">'
      // puff clouds (ด้านบน แสดงว่าเป็นยาพ่น)
      + '<ellipse cx="60" cy="6" rx="18" ry="4" fill="#bfdbfe" opacity="0.5"/>'
      + '<ellipse cx="75" cy="14" rx="10" ry="3" fill="#bfdbfe" opacity="0.35"/>'
      + '<ellipse cx="48" cy="16" rx="8" ry="2.5" fill="#bfdbfe" opacity="0.35"/>'
      // ── Metal canister (silver, บนสุด โผล่ออกจาก boot) ──
      + '<rect x="40" y="22" width="40" height="55" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5"/>'
      + '<ellipse cx="60" cy="23" rx="20" ry="2.5" fill="#d1d5db"/>'
      // ridges บน canister
      + '<line x1="42" y1="30" x2="78" y2="30" stroke="#9ca3af" stroke-width="0.8"/>'
      + '<line x1="42" y1="33" x2="78" y2="33" stroke="#9ca3af" stroke-width="0.5" opacity="0.5"/>'
      + '<line x1="42" y1="36" x2="78" y2="36" stroke="#9ca3af" stroke-width="0.5" opacity="0.5"/>'
      + '<rect x="43" y="50" width="34" height="22" fill="#9ca3af" opacity="0.3"/>'
      // ── Boot body (plastic holder, สี brand) ──
      + '<rect x="28" y="75" width="64" height="75" rx="5" fill="'+bootColor+'" stroke="#6b7280" stroke-width="1.5"/>'
      // gloss highlight
      + '<rect x="32" y="80" width="56" height="4" rx="2" fill="white" opacity="0.35"/>'
      // white label
      + '<rect x="37" y="92" width="46" height="42" rx="2" fill="white" opacity="0.95" stroke="#e5e7eb" stroke-width="0.5"/>'
      + '<text x="60" y="108" text-anchor="middle" font-size="11" font-family="Google Sans,sans-serif" font-weight="700" fill="'+bootAccent+'">MDI</text>'
      + '<text x="60" y="120" text-anchor="middle" font-size="7" font-family="Google Sans,sans-serif" fill="'+bootAccent+'">Inhaler</text>'
      + '<rect x="42" y="124" width="36" height="5" fill="'+bootColor+'" opacity="0.5"/>'
      // ── Mouthpiece (ด้านล่าง) ──
      + '<path d="M 28 145 L 28 165 L 20 175 L 20 180 L 100 180 L 100 175 L 92 165 L 92 145 Z" fill="'+bootColor+'" stroke="#6b7280" stroke-width="1.5"/>'
      // mouthpiece opening (ช่องดำ)
      + '<rect x="38" y="168" width="44" height="6" rx="1" fill="#1f2937"/>'
      + '</svg>';

    var dosageSection;
    if(isPRN){
      dosageSection = '<div style="display:grid;grid-template-columns:170px 1fr;gap:24px;margin:16px 0;align-items:center;">'
        + '<div style="text-align:center;padding:10px;background:#f0f9ff;border-radius:12px;border:2px solid #7FB3E5;">' + inhalerSVG + '</div>'
        + '<div>'
          + '<div style="font-size:22px;font-weight:600;color:#555;margin-bottom:12px;">พ่นเมื่อมีอาการ:</div>'
          + '<div style="display:flex;gap:30px;align-items:center;">'
            + '<div style="text-align:center;"><div style="font-size:52px;">💨</div><div style="font-size:18px;color:#333;font-weight:500;">หอบ</div></div>'
            + '<div style="font-size:26px;color:#ccc;font-weight:300;">หรือ</div>'
            + '<div style="text-align:center;"><div style="font-size:52px;">😤</div><div style="font-size:18px;color:#333;font-weight:500;">หายใจไม่ออก</div></div>'
          + '</div>'
        + '</div></div>';
    } else {
      // Scheduled: show dot grid with puff count
      var parts = (sigTrans.parts || {});
      var puffs = parts.puffs || parts.qty || 1;
      var freq = parts.freq || 2;
      var suffix = parts.suffix || '';
      dosageSection = '<div style="display:grid;grid-template-columns:170px 1fr;gap:20px;margin:12px 0;align-items:start;">'
        + '<div style="text-align:center;padding:10px;background:#f0f9ff;border-radius:12px;border:2px solid #7FB3E5;">' + inhalerSVG + '</div>'
        + '<div>' + renderDotGrid(puffs, freq, suffix).replace(/>เม็ด</g, '>puff<') + '</div>'
        + '</div>';
    }

    return `<div class="page card-page">
      ${bannerHTML(status, idx, total)}
      <div class="drug-name">${esc(drug.name)}</div>
      ${drug.strength ? `<div class="drug-strength">${esc(drug.strength)}</div>` : ''}
      ${drug.purpose ? `<div class="drug-purpose">${esc(drug.purpose)}</div>` : ''}
      ${dosageSection}
      ${sigBlock(drug)}
      ${warnBlock(drug.warnings || (isPRN ? 'ถ้าพ่นแล้วไม่ดีขึ้น หรือต้องพ่นถี่ผิดปกติ ให้รีบมาโรงพยาบาล · เขย่าขวดก่อนพ่นทุกครั้ง' : 'เขย่าขวดก่อนพ่นทุกครั้ง · บ้วนปากหลังพ่น (ถ้าเป็นสเตียรอยด์)'), 'ข้อควรระวัง')}
      ${footerHTML(patient, idx, total)}
    </div>`;
  }

  /** Dispatch to correct card builder */
  function buildDrugCard(drug, status, idx, total, patient, options){
    if(status === 'stop') return buildStopCard(drug, idx, total, patient);
    var type = detectDrugType(drug);
    if(type === 'warfarin') return buildWarfarinCard(drug, status, idx, total, patient, options);
    if(type === 'insulin')  return buildInsulinCard(drug, status, idx, total, patient);
    if(type === 'inhaler')  return buildInhalerCard(drug, status, idx, total, patient);
    if(type === 'prn')      return buildPRNCard(drug, status, idx, total, patient);
    if(status === 'chg')    return buildChangeCard(drug, idx, total, patient);
    return buildOralCard(drug, status, idx, total, patient);
  }

  // ── Cover page ─────────────────────────────────────────────────

  function buildCoverPage(patient, sections, options){
    options = options || {};
    sections = sections || {};
    var cont = sections.continue || [];
    var chg  = sections.change   || [];
    var nw   = sections.new      || [];
    var stp  = sections.stop     || [];

    function sigCell(drug){
      var r = translateSig(drug.sig, drug.sigThai);
      return r.ok ? esc(r.thai) : '<span style="color:#dc2626;">' + esc(drug.sig || '—') + ' (ต้องแก้)</span>';
    }

    function tableRows(list, statusTag){
      return list.map(function(d, i){
        return `<tr>
          <td class="no">${i+1}</td>
          <td>${esc(d.name)}${statusTag ? ' <span class="tag '+statusTag+'">'+(statusTag==='tag-new'?'ใหม่':statusTag==='tag-chg'?'ปรับ':statusTag==='tag-stop'?'หยุด':'')+'</span>' : ''}</td>
          <td>${esc(d.sig || '—')}</td>
          <td>${sigCell(d)}</td>
          <td class="qty">${esc(d.qty || '—')}</td>
        </tr>`;
      }).join('');
    }

    function changeRows(list){
      return list.map(function(d, i){
        var bef = translateSig(d.sigBefore, d.sigBeforeThai);
        var aft = translateSig(d.sigAfter || d.sig, d.sigThai);
        return `<tr>
          <td class="no">${i+1}</td>
          <td>${esc(d.name)} <span class="tag tag-chg">ปรับ</span></td>
          <td>${esc(bef.ok?bef.thai:d.sigBefore||'—')}</td>
          <td><b>${esc(aft.ok?aft.thai:d.sig||'—')}</b></td>
          <td>${esc(d.reason || '')}</td>
        </tr>`;
      }).join('');
    }

    function stopRows(list){
      return list.map(function(d, i){
        return `<tr>
          <td class="no">${i+1}</td>
          <td>${esc(d.name)} <span class="tag tag-stop">หยุด</span></td>
          <td>${esc(d.reason || '')}</td>
        </tr>`;
      }).join('');
    }

    var hospitalLogoHTML = options.hospitalLogo
      ? `<img src="${esc(options.hospitalLogo)}" alt="logo">`
      : 'LOGO';

    return `<div class="page">
      <div class="hd">
        <div class="hd-logo">${hospitalLogoHTML}</div>
        <div class="hd-text">
          <div class="title">${esc(options.hospitalName || 'โรงพยาบาลห้วยผึ้ง')}</div>
          <div class="dept">กลุ่มงานเภสัชกรรม · งานบริบาลผู้ป่วยใน</div>
        </div>
        <div class="hd-doc">${esc(options.docCode || 'F-PHA-DC-001')}<br>${esc(options.docRev || 'Rev. 2569-04')}</div>
      </div>
      <div class="doc-title">แบบฟอร์มรายการยากลับบ้าน · Discharge Medication Reconciliation</div>
      <div class="pt-block">
        <div class="field"><b>ชื่อ-สกุล</b> ${esc(patient.name || '')}</div>
        <div class="field"><b>HN</b> ${esc(patient.hn || '')}</div>
        <div class="field"><b>AN</b> ${esc(patient.an || '')}</div>
        <div class="field"><b>เพศ</b> ${esc(patient.sex || '')}</div>
        <div class="field"><b>อายุ</b> ${esc(patient.age || '')}</div>
        <div class="field"><b>น้ำหนัก</b> ${esc(patient.weight || '')}</div>
        <div class="field"><b>Admit</b> ${esc(fmtDate(patient.admitDate))}</div>
        <div class="field"><b>D/C</b> ${esc(fmtDate(patient.dcDate))}</div>
        <div class="field"><b>LOS</b> ${esc(patient.los || '')}</div>
        <div class="field" style="grid-column:1 / 3;"><b>Dx</b> ${esc(patient.dx || '')}</div>
        <div class="field"><b>แพ้ยา</b> ${esc(patient.allergies || 'ปฏิเสธ')}</div>
      </div>
      <div class="sum-grid">
        <div class="sum-tile cont"><div class="n">${cont.length}</div><div class="l">ยาเดิมใช้ต่อ</div></div>
        <div class="sum-tile new"><div class="n">${nw.length}</div><div class="l">ยาใหม่</div></div>
        <div class="sum-tile chg"><div class="n">${chg.length}</div><div class="l">ปรับเปลี่ยน</div></div>
        <div class="sum-tile stop"><div class="n">${stp.length}</div><div class="l">หยุด</div></div>
      </div>
      ${cont.length ? `<div class="sec"><h3>1. ยาเดิมที่ใช้ต่อ (Continue)</h3>
        <table class="med"><thead><tr><th class="no">#</th><th>ชื่อยา</th><th>Sig (code)</th><th>ภาษาไทย (print)</th><th class="qty">จำนวน</th></tr></thead>
        <tbody>${tableRows(cont)}</tbody></table></div>` : ''}
      ${chg.length ? `<div class="sec"><h3>2. ปรับขนาด/วิธีใช้ (Changed)</h3>
        <table class="med"><thead><tr><th class="no">#</th><th>ชื่อยา</th><th>เดิม</th><th>ใหม่</th><th>เหตุผล</th></tr></thead>
        <tbody>${changeRows(chg)}</tbody></table></div>` : ''}
      ${nw.length ? `<div class="sec"><h3>3. ยาใหม่ (New)</h3>
        <table class="med"><thead><tr><th class="no">#</th><th>ชื่อยา</th><th>Sig (code)</th><th>ภาษาไทย (print)</th><th class="qty">จำนวน</th></tr></thead>
        <tbody>${tableRows(nw, 'tag-new')}</tbody></table></div>` : ''}
      ${stp.length ? `<div class="sec"><h3>4. หยุดใช้ (Stopped)</h3>
        <table class="med"><thead><tr><th class="no">#</th><th>ชื่อยา</th><th>เหตุผลที่หยุด</th></tr></thead>
        <tbody>${stopRows(stp)}</tbody></table></div>` : ''}
      <div class="sign">
        <div class="box">(...........................................)<br>เภสัชกรผู้จ่ายยา<br><span style="font-size:10px;color:#666;">วันที่ ..../..../....</span></div>
        <div class="box">(...........................................)<br>ผู้ป่วย / ญาติผู้รับยา<br><span style="font-size:10px;color:#666;">วันที่ ..../..../....</span></div>
      </div>
      <div class="ft">IPD Pharm Hub · ${esc(options.hospitalName || 'รพ.ห้วยผึ้ง')} · เอกสารนี้พิมพ์อัตโนมัติจากระบบ</div>
    </div>`;
  }

  // ── Section flattener ──────────────────────────────────────────

  function flattenSections(sections){
    var all = [];
    (sections.continue || []).forEach(function(d){ all.push({ drug:d, status:'cont' }); });
    (sections.change   || []).forEach(function(d){ all.push({ drug:d, status:'chg'  }); });
    (sections.new      || []).forEach(function(d){ all.push({ drug:d, status:'new'  }); });
    (sections.stop     || []).forEach(function(d){ all.push({ drug:d, status:'stop' }); });
    return all;
  }

  // ── Main render ────────────────────────────────────────────────

  function render(data, options){
    options = options || {};
    data = data || {};
    var patient = data.patient || {};
    var sections = data.sections || {};

    var html = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">';
    html += '<title>ฉลากยา · ' + esc(patient.name || '') + '</title>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">';
    html += '<style>' + CSS + '</style></head><body>';

    // Cover page
    if(options.includeCover !== false){
      html += buildCoverPage(patient, sections, options);
    }

    // Flattened meds with filter
    var allMeds = flattenSections(sections);
    var filter = options.includeCards;  // array of indices or undefined = all
    var cards = [];
    allMeds.forEach(function(item, i){
      if(filter && filter.indexOf(i) === -1) return;
      cards.push(item);
    });
    var total = cards.length;
    cards.forEach(function(item, i){
      html += buildDrugCard(item.drug, item.status, i, total, patient, options);
    });

    html += '</body></html>';
    return html;
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    render: render,
    buildCoverPage: buildCoverPage,
    buildDrugCard: buildDrugCard,
    buildOralCard: buildOralCard,
    buildChangeCard: buildChangeCard,
    buildPRNCard: buildPRNCard,
    buildInsulinCard: buildInsulinCard,
    buildInhalerCard: buildInhalerCard,
    buildWarfarinCard: buildWarfarinCard,
    buildStopCard: buildStopCard,
    detectDrugType: detectDrugType,
    renderDotGrid: renderDotGrid,
    buildSyringeSVG: buildSyringeSVG,
    pillFull: pillFull,
    pillHalf: pillHalf,
    pillZero: pillZero,
    flattenSections: flattenSections,
    WF_COLORS: WF_COLORS,
    CSS: CSS,
  };
});
