/**
 * ════════════════════════════════════════════════════════════════════
 *  sig_translator.js — HOSxP SIG Code → ภาษาไทยสำหรับคนไข้
 * ════════════════════════════════════════════════════════════════════
 *
 *  ใช้กับ IPD Pharm Hub (D/C tab, Warfarin tab, large print labels)
 *
 *  Grammar อ้างอิง: "Code คำสั่งการใช้ยาผ่านระบบ HOSxP" + "hosxp_manual_11"
 *  รวม 4 ตำแหน่งหลัก + prefixes + suffixes + special keywords
 *
 *  Usage:
 *    var result = translateSig('11pt');
 *    // → { ok: true, thai: 'รับประทาน 1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า',
 *    //     parts: { qty:1, freq:1, timing:'p', unit:'t', ... } }
 *
 *    var fail = translateSig('xyz');
 *    // → { ok: false, original: 'xyz', reason: 'unknown pattern' }
 *
 *  Philosophy:
 *    • ถ้าแปลได้ → return Thai + expose parsed parts (สำหรับแสดง dot grid etc.)
 *    • ถ้าแปลไม่ได้ → return ok:false (frontend highlight แดง, เภสัชฯ พิมพ์เอง)
 *    • ไม่เดา ไม่ใส่ข้อมูลที่ไม่ได้มาจาก code จริง (safety first)
 *
 *  Export: window.translateSig + module.exports (UMD)
 * ════════════════════════════════════════════════════════════════════
 */

(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.translateSig = factory().translate, root.SigTranslator = factory();
})(typeof self !== 'undefined' ? self : this, function(){

  // ── Lookup tables ──────────────────────────────────────────────
  var UNIT_TH = {
    t: 'เม็ด',
    s: 'ช้อนชา',
    j: 'ช้อนโต๊ะ',
    z: 'ซีซี',
  };

  var TIMING_TH = {
    a:  'ก่อนอาหาร',
    p:  'หลังอาหาร',
    h:  'ก่อนนอน',
    pr: 'เมื่อมีอาการ',    // PRN — บริบทพิเศษอาจแปลเป็น "ทุก N ชม."
  };

  var SIDE_TH = {
    r:  'ขวา',
    l:  'ซ้าย',
    b:  'ทั้ง 2 ข้าง',
    eq: 'ข้างที่เป็น',
  };

  var FRACTIONS = {
    '½': 0.5, '¼': 0.25, '¾': 0.75,
    '1/2': 0.5, '1/4': 0.25, '3/4': 0.75,
    '1/3': 1/3, '2/3': 2/3,
  };

  // ── Helpers ────────────────────────────────────────────────────

  /** Convert qty string (.5, 1/2, ½, 1.5) → number */
  function parseQty(s){
    if(s == null) return NaN;
    s = String(s).trim();
    if(FRACTIONS[s] != null) return FRACTIONS[s];
    // "1/4" style
    var fr = s.match(/^(\d+)\/(\d+)$/);
    if(fr) return Number(fr[1]) / Number(fr[2]);
    // "1.5" or ".5"
    var n = Number(s);
    return isNaN(n) ? NaN : n;
  }

  /** Number → pretty Thai ("½", "1½", "2") */
  function qtyToThai(n){
    if(n == null || isNaN(n)) return '';
    if(n === 0.25) return '¼';
    if(n === 0.5)  return '½';
    if(n === 0.75) return '¾';
    if(n === 1.25) return '1¼';
    if(n === 1.5)  return '1½';
    if(n === 1.75) return '1¾';
    if(Number.isInteger(n)) return String(n);
    // Other decimals — show as is
    return String(+n.toFixed(2));
  }

  /** Default meal times based on freq + optional suffix override */
  function mealSlots(freq, suffix){
    if(suffix === 'ชท') return 'เช้า-เที่ยง';
    if(suffix === 'ชน') return 'เช้า-ก่อนนอน';
    switch(Number(freq)){
      case 1: return 'เช้า';
      case 2: return 'เช้า-เย็น';
      case 3: return 'เช้า-กลางวัน-เย็น';
      case 4: return 'เช้า-กลางวัน-เย็น-ก่อนนอน';
      default: return '';
    }
  }

  /** Dot grid (for large-print label rendering) — returns {m,n,e,b} quantities */
  function dotGrid(freq, qty, suffix, timing){
    var g = { m:0, n:0, e:0, b:0 };   // morning, noon, evening, bedtime
    // 'h' = ก่อนนอน → ลงช่อง bedtime โดยไม่สนใจ freq (11ht = 1 เม็ด ก่อนนอน)
    if(timing === 'h'){ g.b = qty; return g; }
    if(suffix === 'ชท'){ g.m = qty; g.n = qty; return g; }
    if(suffix === 'ชน'){ g.m = qty; g.b = qty; return g; }
    switch(Number(freq)){
      case 1: g.m = qty; break;
      case 2: g.m = qty; g.e = qty; break;
      case 3: g.m = qty; g.n = qty; g.e = qty; break;
      case 4: g.m = qty; g.n = qty; g.e = qty; g.b = qty; break;
    }
    return g;
  }

  /** Verb based on unit */
  function verbFor(unit){
    if(unit === 't' || unit === 's' || unit === 'j' || unit === 'z') return 'รับประทาน';
    return 'ใช้';
  }

  // ── Patterns ───────────────────────────────────────────────────

  // Qty pattern: 1, 2, 0.5, 1.5, .5, 1/2, 1/4, ½, ¼, ¾
  var QTY_RE = '(\\.\\d+|\\d+(?:\\.\\d+)?|\\d+\\/\\d+|[½¼¾])';

  // Oral base: [qty][freq][ad?][timing?][unit][suffix?]
  // e.g. 11pt, 1/41pt, 11adpt, 12pt ชท, 1prs pcm, 1.5 prs pcm
  var ORAL_RE = new RegExp(
    '^' + QTY_RE + '\\s*' +          // 1: qty
    '(\\d)\\s*' +                     // 2: freq
    '(ad)?\\s*' +                     // 3: ad (alt-day modifier, optional)
    '(pr|q\\d+|[aph])?\\s*' +         // 4: timing (optional for pr+note cases)
    '([tsjz])\\s*' +                  // 5: unit
    '(ชท|ชน|\\(พร้อมอาหาร\\))?\\s*' + // 6: suffix
    '(.*)$'                           // 7: trailing note
  );

  // Eye/Ear/Ointment: ed/ea/ep + side + freq + optional hs/qN
  var EDEARP_RE = /^(ed|ea|ep)([rlb]|eq)?(\d+)(hs|q\d+)?$/;

  // Topical ap / apm
  var AP_RE = /^(ap|apm)(\d+)$/;

  // Inhaler MDI — many variants: mdi2x2, mdi1puffq4, mdi 2 puff bid
  var MDI_RE = /^mdi\s*(\d+)(?:\s*(?:puff|x)\s*)(\d+|q\d+)(.*)$/i;

  // Nasal spray: ns + sides(1|2) + freq
  var NS_RE = /^ns(\d)(\d)$/;

  // Injection route prefixes
  var INJ_PREFIXES = ['im', 'iv', 'sc', '*sc'];

  // ── Parsers ────────────────────────────────────────────────────

  /** Special keywords (exact match or prefix match) */
  function parseSpecial(code){
    var c = String(code).trim().toLowerCase();
    if(c === 'troche')  return { ok:true, thai:'อมครั้งละ 1 เม็ด ทุก 6 ชั่วโมง เวลาเจ็บคอ', parts:{ type:'troche' } };
    if(c === 'drp')     return { ok:true, thai:'จิบเวลาไอ',                                      parts:{ type:'drp'    } };
    return null;
  }

  /** Oral base code parser */
  function parseOral(code){
    var m = String(code).trim().match(ORAL_RE);
    if(!m) return null;

    var qty    = parseQty(m[1]);
    var freq   = Number(m[2]);
    var isAd   = !!m[3];
    var timing = m[4] || '';
    var unit   = m[5];
    var suffix = m[6] || '';
    var trail  = (m[7] || '').trim();

    if(isNaN(qty) || !unit) return null;

    var unitTh = UNIT_TH[unit] || unit;
    var verb   = verbFor(unit);
    var parts  = [];

    // 1) qty + unit
    parts.push(verb + ' ' + qtyToThai(qty) + ' ' + unitTh);

    // 2) frequency / special timing
    if(isAd){
      parts.push('วันเว้นวัน');
    } else if(timing === 'pr'){
      // PRN — "ทุก N-M ชม." for common drugs if note recognized
      var lowerTrail = trail.toLowerCase();
      if(/pcm|paracetamol/.test(lowerTrail)){
        parts.push('ทุก 4-6 ชั่วโมง เวลาปวดหรือมีไข้');
      } else {
        parts.push('เมื่อมีอาการ');
      }
    } else if(timing && /^q\d+$/.test(timing)){
      var hrs = timing.substring(1);
      parts.push('ทุก ' + hrs + ' ชั่วโมง');
    } else {
      parts.push('วันละ ' + freq + ' ครั้ง');
    }

    // 3) timing + meal slots (สำหรับ a/p/h)
    if(!isAd && timing !== 'pr' && !(timing && /^q\d+$/.test(timing))){
      if(timing === 'a' || timing === 'p'){
        var meals = mealSlots(freq, suffix);
        var t = TIMING_TH[timing];
        if(suffix === '(พร้อมอาหาร)') t = 'พร้อมอาหาร';
        parts.push(meals ? (t + ' ' + meals) : t);
      } else if(timing === 'h'){
        parts.push(TIMING_TH.h);
      } else if(!timing) {
        // no explicit timing — skip
      }
    } else if(isAd && timing){
      // วันเว้นวัน + timing combo
      if(timing === 'a' || timing === 'p'){
        parts.push(TIMING_TH[timing] + 'เช้า');
      } else if(timing === 'h'){
        parts.push('ก่อนนอน');
      }
    }

    var thai = parts.join(' ');
    return {
      ok: true,
      thai: thai,
      parts: {
        type:    'oral',
        qty:     qty,
        freq:    freq,
        isAd:    isAd,
        timing:  timing,
        unit:    unit,
        suffix:  suffix,
        note:    trail,
        dotGrid: dotGrid(freq, qty, suffix, timing),
      }
    };
  }

  /** Eye/Ear/Ointment drops parser: edr1, edb4, eal3, epl4 */
  function parseEDEARP(code){
    var m = String(code).trim().toLowerCase().match(EDEARP_RE);
    if(!m) return null;
    var type = m[1];   // ed / ea / ep
    var side = m[2] || 'eq';
    var freq = Number(m[3]);
    var mod  = m[4] || '';

    var verb = type === 'ed' ? 'หยอดตา' :
               type === 'ea' ? 'หยอดหู' :
               'ป้ายตา';
    var sideTh = SIDE_TH[side] || '';
    var dose = (type === 'ep') ? '' : 'ครั้งละ 1-2 หยด ';

    var freqTh;
    if(mod === 'hs'){
      freqTh = 'วันละ ' + freq + ' ครั้ง ก่อนนอน';
    } else if(mod && /^q\d+$/.test(mod)){
      var hrs = mod.substring(1);
      freqTh = 'ทุก ' + hrs + ' ชั่วโมง';
    } else {
      var meals = mealSlots(freq);
      freqTh = 'วันละ ' + freq + ' ครั้ง' + (meals ? ' (' + meals + ')' : '');
    }

    return {
      ok: true,
      thai: verb + sideTh + ' ' + dose + freqTh,
      parts: { type:type, side:side, freq:freq, mod:mod }
    };
  }

  /** Topical: ap3, apm4 */
  function parseAP(code){
    var m = String(code).trim().toLowerCase().match(AP_RE);
    if(!m) return null;
    var type = m[1];  // ap or apm
    var freq = Number(m[2]);
    var verb = (type === 'apm') ? 'ป้ายแผลในปาก' : 'ทาบาง ๆ เฉพาะที่';
    var meals = mealSlots(freq);
    return {
      ok: true,
      thai: verb + ' วันละ ' + freq + ' ครั้ง' + (meals ? ' (' + meals + ')' : ''),
      parts: { type:type, freq:freq }
    };
  }

  /** Inhaler MDI: mdi2x2, mdi1puffq4 */
  function parseMDI(code){
    var m = String(code).trim().toLowerCase().match(MDI_RE);
    if(!m) return null;
    var puffs = Number(m[1]);
    var freqStr = m[2];
    var trail = (m[3] || '').trim();

    var parts = ['พ่นยา ' + puffs + ' puff'];

    if(/^q\d+$/.test(freqStr)){
      var hrs = freqStr.substring(1);
      parts.push('ทุก ' + hrs + ' ชั่วโมง');
      if(/หอบ|ไอ/.test(trail)) parts.push('เวลามีอาการหอบ/ไอ');
      else if(trail) parts.push('เมื่อมีอาการ');
    } else {
      var freq = Number(freqStr);
      var meals = mealSlots(freq);
      parts.push('วันละ ' + freq + ' ครั้ง' + (meals ? ' ' + meals : ''));
    }

    return {
      ok: true,
      thai: parts.join(' '),
      parts: { type:'mdi', puffs:puffs, freqRaw:freqStr, note:trail }
    };
  }

  /** Nasal spray: ns12, ns21, ns22 */
  function parseNS(code){
    var m = String(code).trim().toLowerCase().match(NS_RE);
    if(!m) return null;
    var sides = Number(m[1]);
    var freq  = Number(m[2]);
    var sideTh = sides === 2 ? '2 ข้าง' : '1 ข้าง';
    var meals = mealSlots(freq);
    return {
      ok: true,
      thai: 'พ่นจมูก ' + sideTh + ' ข้างละ ' + sides + ' ครั้ง วันละ ' + freq + ' ครั้ง' + (meals ? ' (' + meals + ')' : ''),
      parts: { type:'nasal', sides:sides, freq:freq }
    };
  }

  /** Injection route detector (basic — มักมี free text ตามหลัง) */
  function parseInjection(code){
    var c = String(code).trim().toLowerCase();
    for(var i = 0; i < INJ_PREFIXES.length; i++){
      var p = INJ_PREFIXES[i];
      if(c.indexOf(p) === 0){
        var rest = c.substring(p.length).trim();
        var routeTh = p === 'im' ? 'ฉีดเข้ากล้ามเนื้อ' :
                      p === 'iv' ? 'ฉีดเข้าเส้นเลือดดำ' :
                      'ฉีดใต้ผิวหนัง';  // sc or *sc
        return {
          ok: true,
          thai: routeTh + (rest ? ' · ' + rest : ''),
          parts: { type:'injection', route: p.replace('*',''), note: rest },
          partial: true,  // ใบสั่งฉีดมักมี free-text ตาม SC 10-0-8 etc. — เภสัชฯ ควรตรวจ
        };
      }
    }
    return null;
  }

  // ── Main translator ────────────────────────────────────────────

  function translate(code){
    if(code == null) return { ok:false, original:String(code), reason:'empty' };
    var raw = String(code).trim();
    if(!raw) return { ok:false, original:raw, reason:'empty' };

    var parsers = [parseSpecial, parseMDI, parseEDEARP, parseAP, parseNS, parseInjection, parseOral];
    for(var i = 0; i < parsers.length; i++){
      var r = parsers[i](raw);
      if(r && r.ok) return r;
    }

    return { ok:false, original:raw, reason:'unknown pattern' };
  }

  // ── Test suite (run in console) ────────────────────────────────

  function runTests(){
    var tests = [
      // จาก PDF hosxp_manual_11
      ['11pt',     'รับประทาน 1 เม็ด วันละ 1 ครั้ง หลังอาหาร เช้า'],
      ['11ht',     'รับประทาน 1 เม็ด วันละ 1 ครั้ง ก่อนนอน'],
      ['21hs',     'รับประทาน 2 ช้อนชา วันละ 1 ครั้ง ก่อนนอน'],
      ['.51pt',    'รับประทาน ½ เม็ด วันละ 1 ครั้ง หลังอาหาร เช้า'],
      ['1/41pt',   'รับประทาน ¼ เม็ด วันละ 1 ครั้ง หลังอาหาร เช้า'],
      ['11adpt',   'รับประทาน 1 เม็ด วันเว้นวัน หลังอาหารเช้า'],
      ['21adpt',   'รับประทาน 2 เม็ด วันเว้นวัน หลังอาหารเช้า'],
      ['12pt',     'รับประทาน 1 เม็ด วันละ 2 ครั้ง หลังอาหาร เช้า-เย็น'],
      ['troche',   'อมครั้งละ 1 เม็ด ทุก 6 ชั่วโมง เวลาเจ็บคอ'],
      ['drp',      'จิบเวลาไอ'],
      // eye/ear
      ['edr1',     'หยอดตาขวา ครั้งละ 1-2 หยด วันละ 1 ครั้ง (เช้า)'],
      ['edl1hs',   'หยอดตาซ้าย ครั้งละ 1-2 หยด วันละ 1 ครั้ง ก่อนนอน'],
      ['edb4',     'หยอดตาทั้ง 2 ข้าง ครั้งละ 1-2 หยด วันละ 4 ครั้ง (เช้า-กลางวัน-เย็น-ก่อนนอน)'],
      ['edeq4',    'หยอดตาข้างที่เป็น ครั้งละ 1-2 หยด วันละ 4 ครั้ง (เช้า-กลางวัน-เย็น-ก่อนนอน)'],
      ['ear2',     'หยอดหูขวา ครั้งละ 1-2 หยด วันละ 2 ครั้ง (เช้า-เย็น)'],
      ['ap3',      'ทาบาง ๆ เฉพาะที่ วันละ 3 ครั้ง (เช้า-กลางวัน-เย็น)'],
      ['apm4',     'ป้ายแผลในปาก วันละ 4 ครั้ง (เช้า-กลางวัน-เย็น-ก่อนนอน)'],
      // nasal, inhaler
      ['ns12',     'พ่นจมูก 1 ข้าง ข้างละ 1 ครั้ง วันละ 2 ครั้ง (เช้า-เย็น)'],
      ['ns22',     'พ่นจมูก 2 ข้าง ข้างละ 2 ครั้ง วันละ 2 ครั้ง (เช้า-เย็น)'],
      ['mdi2x2',   'พ่นยา 2 puff วันละ 2 ครั้ง เช้า-เย็น'],
    ];

    console.group('sig_translator — self-test');
    var pass = 0, fail = 0;
    tests.forEach(function(t){
      var r = translate(t[0]);
      var gotThai = r.ok ? r.thai : '(FAIL) ' + r.reason;
      var ok = (gotThai === t[1]);
      if(ok){ pass++; console.log('✓', t[0], '→', gotThai); }
      else  { fail++; console.warn('✗', t[0], '\n  expected:', t[1], '\n  got:     ', gotThai); }
    });
    console.log('Result:', pass, 'pass,', fail, 'fail /', tests.length);
    console.groupEnd();
    return { pass:pass, fail:fail, total:tests.length };
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    translate: translate,
    parseQty: parseQty,
    qtyToThai: qtyToThai,
    mealSlots: mealSlots,
    dotGrid: dotGrid,
    UNIT_TH: UNIT_TH,
    TIMING_TH: TIMING_TH,
    SIDE_TH: SIDE_TH,
    runTests: runTests,
  };
});
