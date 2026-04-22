/* ============================================================
 * ADR Decision Support — Knowledge Base + Rule Engine
 *
 * Reference: Patients with drug allergy and hypersensitivity
 *            Siriraj 2018 (siriraj_drug_allergy_2018.pdf)
 *
 * Scope: ~45 drugs commonly causing ADR ที่ relevant กับ รพ.ห้วยผึ้ง
 *        (formulary + refer-back + คนไข้พกยามาจาก รพ.อื่น)
 *
 * Output keys (canonical, lowercase, no dose/route)
 * Phenotype keys: mpe, sjs_ten, dress, urticaria, anaphylaxis, agep, fde
 * Risk levels: 'high' | 'medium' | 'low' | 'rare'
 * ============================================================ */

/* ─────────────────────────────────────────────────────────────
 *  PHENOTYPE METADATA — latency windows + clinical hallmarks
 *  Source: Siriraj 2018, Table 1 (p.3)
 * ───────────────────────────────────────────────────────────── */
const ADR_PHENOTYPE = {
  mpe: {
    label: 'Maculopapular eruption (MPE)',
    latencyDays:    [4, 14],
    severity:       'mild-moderate',
    skin:           'symmetric maculopapular rash',
    systemic:       'usually absent',
    ref:            'Siriraj 2018, Table 1, p.3'
  },
  sjs_ten: {
    label: 'SJS / TEN',
    latencyDays:    [7, 21],
    severity:       'severe',
    skin:           'targetoid lesions, mucosal erosions, BSA detach',
    systemic:       'fever, malaise, mucositis ≥2 sites',
    ref:            'Siriraj 2018, Table 1, p.3 + Tx p.6'
  },
  dress: {
    label: 'DRESS / DIHS',
    latencyDays:    [14, 42],
    severity:       'severe',
    skin:           'morbilliform with facial edema',
    systemic:       'fever, LN, eosinophilia, hepatitis, nephritis',
    ref:            'Siriraj 2018, Table 1, p.3 + Tx p.6'
  },
  agep: {
    label: 'AGEP',
    latencyDays:    [1, 2],
    severity:       'moderate',
    skin:           'sterile pustules on erythema, intertriginous',
    systemic:       'fever, neutrophilia',
    ref:            'Siriraj 2018, Table 1, p.3'
  },
  urticaria: {
    label: 'Urticaria',
    latencyMinutes: [5, 360],
    severity:       'mild-moderate',
    skin:           'wheals, pruritus',
    systemic:       'rarely',
    ref:            'Siriraj 2018, Table 1, p.3'
  },
  anaphylaxis: {
    label: 'Anaphylaxis',
    latencyMinutes: [1, 60],
    severity:       'life-threatening',
    skin:           'urticaria, angioedema',
    systemic:       'hypotension, bronchospasm, GI',
    ref:            'Siriraj 2018, Table 1, p.3 + Tx p.5'
  },
  fde: {
    label: 'Fixed drug eruption (FDE)',
    latencyMinutes: [30, 480],
    severity:       'mild',
    skin:           'recurrent at same site, dusky red',
    systemic:       'absent',
    ref:            'Siriraj 2018, Table 1, p.3'
  }
};


/* ─────────────────────────────────────────────────────────────
 *  ADR_DRUG_KB — 45 drugs
 *  Each entry:
 *    aliases:    [strings] for normalizer matching
 *    label:      display name (Title Case)
 *    klass:      'beta-lactam' | 'sulfonamide' | 'aromatic-aed' | 'nsaid'
 *                | 'macrolide' | 'quinolone' | 'aminoglycoside'
 *                | 'antifungal' | 'anti-tb' | 'allopurinol' | 'glycopeptide'
 *                | 'nitroimidazole' | 'analgesic' | 'opioid'
 *    subclass:   penicillin | cephalosporin | carbapenem | oxicam | propionic …
 *    risk:       { phenotypeKey: 'high'|'medium'|'low'|'rare', … }
 *    crossKeys:  [canonical keys of cross-reactive drugs]
 *    note:       special clinical note (Thai)
 *    ref:        Siriraj citation
 * ───────────────────────────────────────────────────────────── */
const ADR_DRUG_KB = {

  /* ── A. β-Lactams (13) ──────────────────────────────────── */
  'amoxicillin': {
    aliases: ['amoxicillin','amox','amoxil'],
    label:   'Amoxicillin',
    klass:   'beta-lactam', subclass: 'penicillin',
    risk:    { mpe:'high', urticaria:'high', anaphylaxis:'high', sjs_ten:'medium', dress:'low' },
    crossKeys: ['augmentin','ampicillin','cloxacillin','dicloxacillin','tazocin','ceftriaxone','ceftazidime','cefazolin','cefotaxime','cefixime','meropenem','imipenem'],
    note:    'Penicillin — cross กับ cephalosporin ~5-10%, carbapenem ~1%',
    ref:     'Siriraj 2018, Table 1 (β-lactams), p.3'
  },
  'augmentin': {
    aliases: ['augmentin','co-amoxiclav','coamoxiclav','amox-clav','amoxiclav','amoxicillin clavulanate'],
    label:   'Augmentin (Amoxicillin + Clavulanate)',
    klass:   'beta-lactam', subclass: 'penicillin',
    risk:    { mpe:'high', urticaria:'high', anaphylaxis:'high', sjs_ten:'medium', dress:'low' },
    crossKeys: ['amoxicillin','ampicillin','cloxacillin','dicloxacillin','tazocin','ceftriaxone','ceftazidime','cefazolin','cefotaxime','cefixime','meropenem','imipenem'],
    note:    'เหมือน amoxicillin + clavulanate (clavulanate เองก็เป็นสาเหตุ allergy ได้)',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'dicloxacillin': {
    aliases: ['dicloxacillin','diclox','dxc'],
    label:   'Dicloxacillin',
    klass:   'beta-lactam', subclass: 'penicillin',
    risk:    { mpe:'high', urticaria:'high', anaphylaxis:'medium', sjs_ten:'low' },
    crossKeys: ['amoxicillin','augmentin','ampicillin','cloxacillin','tazocin','ceftriaxone','ceftazidime','cefazolin','cefotaxime','cefixime','meropenem','imipenem'],
    note:    'Penicillin — cross-reactive ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'ampicillin': {
    aliases: ['ampicillin','amp'],
    label:   'Ampicillin',
    klass:   'beta-lactam', subclass: 'penicillin',
    risk:    { mpe:'high', urticaria:'medium', anaphylaxis:'high', sjs_ten:'medium' },
    crossKeys: ['amoxicillin','augmentin','dicloxacillin','cloxacillin','tazocin','ceftriaxone','ceftazidime','cefazolin','cefotaxime','cefixime','meropenem','imipenem'],
    note:    'Penicillin — incidence MPE สูงเป็นพิเศษถ้า EBV co-infection',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'cloxacillin': {
    aliases: ['cloxacillin','clox'],
    label:   'Cloxacillin',
    klass:   'beta-lactam', subclass: 'penicillin',
    risk:    { mpe:'medium', urticaria:'medium', anaphylaxis:'medium' },
    crossKeys: ['amoxicillin','augmentin','dicloxacillin','ampicillin','tazocin','ceftriaxone','ceftazidime','cefazolin','cefotaxime','cefixime','meropenem','imipenem'],
    note:    'Penicillin — cross-reactive ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'tazocin': {
    aliases: ['tazocin','piperacillin','piperacillin-tazobactam','pip-tazo','piptaz'],
    label:   'Tazocin (Piperacillin/Tazobactam)',
    klass:   'beta-lactam', subclass: 'penicillin',
    risk:    { mpe:'high', dress:'medium', urticaria:'medium', anaphylaxis:'medium', sjs_ten:'low' },
    crossKeys: ['amoxicillin','augmentin','ampicillin','cloxacillin','dicloxacillin','ceftriaxone','ceftazidime','cefazolin','cefotaxime','cefixime','meropenem','imipenem'],
    note:    'Refer-back · DRESS เพิ่มขึ้นถ้า prolonged use (>1 wk)',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'ceftriaxone': {
    aliases: ['ceftriaxone','rocephin','cef-3','cef3','cftx'],
    label:   'Ceftriaxone',
    klass:   'beta-lactam', subclass: 'cephalosporin',
    risk:    { mpe:'high', urticaria:'medium', anaphylaxis:'medium', sjs_ten:'medium', dress:'low' },
    crossKeys: ['ceftazidime','cefazolin','cefotaxime','cefixime','amoxicillin','augmentin','ampicillin','meropenem','imipenem'],
    note:    'Cephalosporin — cross กับ penicillin 5-10%, กับ carbapenem ~1%',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'ceftazidime': {
    aliases: ['ceftazidime','fortum','cef-taz','ctz'],
    label:   'Ceftazidime',
    klass:   'beta-lactam', subclass: 'cephalosporin',
    risk:    { mpe:'medium', urticaria:'medium', anaphylaxis:'medium', sjs_ten:'low' },
    crossKeys: ['ceftriaxone','cefazolin','cefotaxime','cefixime','amoxicillin','augmentin','ampicillin','meropenem','imipenem'],
    note:    'Cephalosporin — cross-reactive ทั้งกลุ่ม + partial cross กับ penicillin',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'cefazolin': {
    aliases: ['cefazolin','ancef','kefzol','cfz'],
    label:   'Cefazolin',
    klass:   'beta-lactam', subclass: 'cephalosporin',
    risk:    { mpe:'medium', urticaria:'medium', anaphylaxis:'medium' },
    crossKeys: ['ceftriaxone','ceftazidime','cefotaxime','cefixime','amoxicillin','augmentin','ampicillin','meropenem','imipenem'],
    note:    'Cephalosporin gen 1 — cross กับ penicillin สูงกว่า gen 2-3',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'cefotaxime': {
    aliases: ['cefotaxime','claforan'],
    label:   'Cefotaxime',
    klass:   'beta-lactam', subclass: 'cephalosporin',
    risk:    { mpe:'medium', urticaria:'medium', anaphylaxis:'medium' },
    crossKeys: ['ceftriaxone','ceftazidime','cefazolin','cefixime','amoxicillin','augmentin','ampicillin','meropenem','imipenem'],
    note:    'Cephalosporin — cross-reactive ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'cefixime': {
    aliases: ['cefixime','suprax'],
    label:   'Cefixime',
    klass:   'beta-lactam', subclass: 'cephalosporin',
    risk:    { mpe:'medium', urticaria:'medium', anaphylaxis:'low' },
    crossKeys: ['ceftriaxone','ceftazidime','cefazolin','cefotaxime','amoxicillin','augmentin','ampicillin'],
    note:    'Cephalosporin oral — risk ต่ำกว่า IV',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'meropenem': {
    aliases: ['meropenem','mero','mrp'],
    label:   'Meropenem',
    klass:   'beta-lactam', subclass: 'carbapenem',
    risk:    { mpe:'medium', anaphylaxis:'medium', dress:'low', sjs_ten:'low' },
    crossKeys: ['imipenem','amoxicillin','augmentin','ampicillin','ceftriaxone','ceftazidime','cefazolin','cefotaxime'],
    note:    'Refer-back · Carbapenem — cross กับ penicillin/cephalosporin ~1%',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'imipenem': {
    aliases: ['imipenem','tienam','impc'],
    label:   'Imipenem',
    klass:   'beta-lactam', subclass: 'carbapenem',
    risk:    { mpe:'medium', anaphylaxis:'medium', dress:'low', sjs_ten:'low' },
    crossKeys: ['meropenem','amoxicillin','augmentin','ampicillin','ceftriaxone','ceftazidime','cefazolin','cefotaxime'],
    note:    'Refer-back · Carbapenem — cross-reactive cluster',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── B. Sulfonamides (2) ─────────────────────────────────── */
  'co-trimoxazole': {
    aliases: ['co-trimoxazole','cotrimoxazole','bactrim','tmp-smx','tmp/smx','sulfa','sulfamethoxazole','trimethoprim'],
    label:   'Co-trimoxazole (Bactrim)',
    klass:   'sulfonamide', subclass: 'sulfa-antibiotic',
    risk:    { sjs_ten:'high', mpe:'high', dress:'high', anaphylaxis:'medium', fde:'medium' },
    crossKeys: ['sulfasalazine'],
    note:    'High SJS-TEN risk especially in HIV (~10x), อย่า rechallenge',
    ref:     'Siriraj 2018, Table 1 (sulfonamides), p.3'
  },
  'sulfasalazine': {
    aliases: ['sulfasalazine','salazopyrin'],
    label:   'Sulfasalazine',
    klass:   'sulfonamide', subclass: 'sulfa',
    risk:    { sjs_ten:'medium', mpe:'medium', dress:'medium' },
    crossKeys: ['co-trimoxazole'],
    note:    'Cross กับ sulfonamide antibiotics',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── C. Aromatic Anticonvulsants (5) — DRESS ★ ──────────── */
  'phenytoin': {
    aliases: ['phenytoin','dilantin','phyntn','dpht'],
    label:   'Phenytoin',
    klass:   'aromatic-aed', subclass: 'hydantoin',
    risk:    { dress:'high', sjs_ten:'high', mpe:'high', agep:'low' },
    crossKeys: ['carbamazepine','phenobarbital','lamotrigine'],
    note:    'Aromatic AED — cross-react ทั้งกลุ่ม · HLA-B*15:02 risk (Thai)',
    ref:     'Siriraj 2018, Table 1 (anticonvulsants), p.3'
  },
  'phenobarbital': {
    aliases: ['phenobarbital','phenobarb','phb','luminal'],
    label:   'Phenobarbital',
    klass:   'aromatic-aed', subclass: 'barbiturate',
    risk:    { dress:'high', sjs_ten:'high', mpe:'high' },
    crossKeys: ['phenytoin','carbamazepine','lamotrigine'],
    note:    'Aromatic AED — cross-react ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'carbamazepine': {
    aliases: ['carbamazepine','tegretol','cbz'],
    label:   'Carbamazepine',
    klass:   'aromatic-aed', subclass: 'iminostilbene',
    risk:    { dress:'high', sjs_ten:'high', mpe:'high' },
    crossKeys: ['phenytoin','phenobarbital','lamotrigine'],
    note:    'จากนอก รพ. · HLA-B*15:02 ★ Thai risk allele — screen ก่อน start',
    ref:     'Siriraj 2018, Table 1, p.3 + HLA section p.8'
  },
  'lamotrigine': {
    aliases: ['lamotrigine','lamictal','ltg'],
    label:   'Lamotrigine',
    klass:   'aromatic-aed', subclass: 'phenyltriazine',
    risk:    { dress:'high', sjs_ten:'high', mpe:'high' },
    crossKeys: ['phenytoin','phenobarbital','carbamazepine'],
    note:    'จากนอก รพ. · risk สูงขึ้นถ้า rapid titration หรือใช้ร่วม valproate',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'sodium-valproate': {
    aliases: ['sodium valproate','valproate','depakine','vpa'],
    label:   'Sodium Valproate',
    klass:   'aromatic-aed', subclass: 'fatty-acid',
    risk:    { dress:'low', mpe:'low' },
    crossKeys: [],
    note:    'Risk ต่ำกว่า aromatic AED อื่น แต่ระวัง hepatotoxicity',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── D. NSAIDs (5) ───────────────────────────────────────── */
  'ibuprofen': {
    aliases: ['ibuprofen','brufen','ibu'],
    label:   'Ibuprofen',
    klass:   'nsaid', subclass: 'propionic',
    risk:    { urticaria:'high', anaphylaxis:'medium', mpe:'low', sjs_ten:'low' },
    crossKeys: ['naproxen','diclofenac','piroxicam','aspirin'],
    note:    'NSAID — cross-react cluster (COX-1 inhibitor)',
    ref:     'Siriraj 2018, Table 1 (NSAIDs), p.3'
  },
  'diclofenac': {
    aliases: ['diclofenac','voltaren','dcf'],
    label:   'Diclofenac',
    klass:   'nsaid', subclass: 'acetic',
    risk:    { urticaria:'high', anaphylaxis:'medium', mpe:'low', sjs_ten:'low' },
    crossKeys: ['ibuprofen','naproxen','piroxicam','aspirin'],
    note:    'NSAID — cross-react cluster',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'naproxen': {
    aliases: ['naproxen','naprosyn'],
    label:   'Naproxen',
    klass:   'nsaid', subclass: 'propionic',
    risk:    { urticaria:'medium', anaphylaxis:'medium', mpe:'low' },
    crossKeys: ['ibuprofen','diclofenac','piroxicam','aspirin'],
    note:    'NSAID — cross-react cluster',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'piroxicam': {
    aliases: ['piroxicam','feldene','meloxicam','tenoxicam'],
    label:   'Piroxicam (Oxicam)',
    klass:   'nsaid', subclass: 'oxicam',
    risk:    { sjs_ten:'high', mpe:'medium', urticaria:'medium', anaphylaxis:'medium' },
    crossKeys: ['ibuprofen','diclofenac','naproxen','aspirin'],
    note:    'Oxicam — high SJS-TEN risk (สูงกว่า NSAID อื่น) · ระวังในผู้สูงอายุ',
    ref:     'Siriraj 2018, Table 1 (NSAIDs — oxicams highest SJS), p.3'
  },
  'aspirin': {
    aliases: ['aspirin','asa','salicylate'],
    label:   'ASA / Aspirin',
    klass:   'nsaid', subclass: 'salicylate',
    risk:    { urticaria:'high', anaphylaxis:'medium', mpe:'low' },
    crossKeys: ['ibuprofen','diclofenac','naproxen','piroxicam'],
    note:    'NSAID — สำคัญใน asthma triad (Samter)',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── E. Macrolides (3) ───────────────────────────────────── */
  'erythromycin': {
    aliases: ['erythromycin','erm'],
    label:   'Erythromycin',
    klass:   'macrolide', subclass: 'macrolide',
    risk:    { mpe:'low', urticaria:'low', anaphylaxis:'rare' },
    crossKeys: ['azithromycin','roxithromycin'],
    note:    'Risk ต่ำ · alternative ใน β-lactam allergy',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'azithromycin': {
    aliases: ['azithromycin','azithro','zithromax','azt'],
    label:   'Azithromycin',
    klass:   'macrolide', subclass: 'macrolide',
    risk:    { mpe:'low', urticaria:'low' },
    crossKeys: ['erythromycin','roxithromycin'],
    note:    'Risk ต่ำ · alternative ใน β-lactam allergy',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'roxithromycin': {
    aliases: ['roxithromycin','rulid','rxm'],
    label:   'Roxithromycin',
    klass:   'macrolide', subclass: 'macrolide',
    risk:    { mpe:'low', urticaria:'low' },
    crossKeys: ['erythromycin','azithromycin'],
    note:    'Risk ต่ำ · alternative ใน β-lactam allergy',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── F. Quinolones (4) ───────────────────────────────────── */
  'ciprofloxacin': {
    aliases: ['ciprofloxacin','cipro','cpx'],
    label:   'Ciprofloxacin',
    klass:   'quinolone', subclass: 'fluoroquinolone',
    risk:    { anaphylaxis:'medium', mpe:'medium', urticaria:'medium', sjs_ten:'low' },
    crossKeys: ['ofloxacin','norfloxacin','levofloxacin'],
    note:    'Quinolone — cross-react ทั้งกลุ่ม · photosensitivity',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'ofloxacin': {
    aliases: ['ofloxacin','oflx','ofx'],
    label:   'Ofloxacin',
    klass:   'quinolone', subclass: 'fluoroquinolone',
    risk:    { anaphylaxis:'medium', mpe:'medium', urticaria:'medium' },
    crossKeys: ['ciprofloxacin','norfloxacin','levofloxacin'],
    note:    'Quinolone — cross-react ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'norfloxacin': {
    aliases: ['norfloxacin','noroxin','nfx'],
    label:   'Norfloxacin',
    klass:   'quinolone', subclass: 'fluoroquinolone',
    risk:    { anaphylaxis:'low', mpe:'low', urticaria:'low' },
    crossKeys: ['ciprofloxacin','ofloxacin','levofloxacin'],
    note:    'Quinolone — cross-react ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'levofloxacin': {
    aliases: ['levofloxacin','levaquin','lvfx'],
    label:   'Levofloxacin',
    klass:   'quinolone', subclass: 'fluoroquinolone',
    risk:    { anaphylaxis:'medium', mpe:'medium', urticaria:'medium' },
    crossKeys: ['ciprofloxacin','ofloxacin','norfloxacin'],
    note:    'Quinolone — cross-react ทั้งกลุ่ม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── G. Aminoglycosides (2) ──────────────────────────────── */
  'amikacin': {
    aliases: ['amikacin','amk'],
    label:   'Amikacin',
    klass:   'aminoglycoside', subclass: 'aminoglycoside',
    risk:    { anaphylaxis:'rare', mpe:'low', urticaria:'low' },
    crossKeys: ['gentamicin'],
    note:    'Refer-back · Hypersensitivity rare · ระวัง nephro/ototoxicity',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'gentamicin': {
    aliases: ['gentamicin','genta','gen'],
    label:   'Gentamicin',
    klass:   'aminoglycoside', subclass: 'aminoglycoside',
    risk:    { mpe:'low', urticaria:'low' },
    crossKeys: ['amikacin'],
    note:    'Aminoglycoside — risk ต่ำ',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── H. Antifungals (2) ──────────────────────────────────── */
  'amphotericin-b': {
    aliases: ['amphotericin','amphotericin b','ampho-b','amphob','ambisome','fungizone'],
    label:   'Amphotericin B',
    klass:   'antifungal', subclass: 'polyene',
    risk:    { anaphylaxis:'rare', dress:'rare' },
    crossKeys: [],
    note:    'Refer-back · Infusion reaction (fever/chills) บ่อย — แยกจาก hypersensitivity จริง · pre-medicate ด้วย CPM/Paracetamol',
    ref:     'Siriraj 2018 (general antifungals)'
  },
  'fluconazole': {
    aliases: ['fluconazole','diflucan','flcz'],
    label:   'Fluconazole',
    klass:   'antifungal', subclass: 'azole',
    risk:    { sjs_ten:'low', mpe:'low', dress:'rare' },
    crossKeys: [],
    note:    'Hepatotoxic · SJS-TEN occasional especially in HIV',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── I. Anti-TB (4) — DRESS ★ in TB regimen ─────────────── */
  'rifampicin': {
    aliases: ['rifampicin','rifampin','rmp','r','rifadin'],
    label:   'Rifampicin',
    klass:   'anti-tb', subclass: 'rifamycin',
    risk:    { dress:'high', mpe:'medium', sjs_ten:'medium', anaphylaxis:'medium' },
    crossKeys: ['isoniazid','pyrazinamide','ethambutol'],   // group flag, not true cross
    note:    'TB regimen group — เริ่มพร้อม INH/PZA/EMB · sequential rechallenge หลัง resolve',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'isoniazid': {
    aliases: ['isoniazid','inh','h'],
    label:   'Isoniazid (INH)',
    klass:   'anti-tb', subclass: 'isoniazid',
    risk:    { dress:'high', mpe:'medium', sjs_ten:'medium', hepatitis:'high' },
    crossKeys: ['rifampicin','pyrazinamide','ethambutol'],
    note:    'TB regimen group · Hepatotoxic — สำคัญใน DRESS workup',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'pyrazinamide': {
    aliases: ['pyrazinamide','pza','z'],
    label:   'Pyrazinamide (PZA)',
    klass:   'anti-tb', subclass: 'pyrazinamide',
    risk:    { dress:'high', mpe:'medium', sjs_ten:'low', hepatitis:'high' },
    crossKeys: ['rifampicin','isoniazid','ethambutol'],
    note:    'TB regimen group · มี hyperuricemia ร่วม',
    ref:     'Siriraj 2018, Table 1, p.3'
  },
  'ethambutol': {
    aliases: ['ethambutol','emb','e','myambutol'],
    label:   'Ethambutol (EMB)',
    klass:   'anti-tb', subclass: 'ethambutol',
    risk:    { dress:'medium', mpe:'medium', sjs_ten:'low' },
    crossKeys: ['rifampicin','isoniazid','pyrazinamide'],
    note:    'TB regimen group · ระวัง optic neuritis',
    ref:     'Siriraj 2018, Table 1, p.3'
  },

  /* ── J. Other High-Risk (2) ──────────────────────────────── */
  'allopurinol': {
    aliases: ['allopurinol','zyloric','allo'],
    label:   'Allopurinol',
    klass:   'allopurinol', subclass: 'xanthine-oxidase-inh',
    risk:    { dress:'high', sjs_ten:'high', mpe:'high' },
    crossKeys: [],
    note:    '★ HLA-B*58:01 risk (Thai, Han Chinese ~15%) — screen ก่อน start ในกลุ่มเสี่ยง · mortality DRESS ~10%',
    ref:     'Siriraj 2018, Table 1 + HLA section p.8'
  },
  'vancomycin': {
    aliases: ['vancomycin','vanco','van'],
    label:   'Vancomycin',
    klass:   'glycopeptide', subclass: 'glycopeptide',
    risk:    { dress:'high', agep:'medium', mpe:'medium', anaphylaxis:'medium' },
    crossKeys: [],
    note:    'Refer-back · Red-man syndrome (rate-related, ไม่ใช่ allergy) · DRESS เพิ่มถ้า prolonged',
    ref:     'Siriraj 2018, Table 1 (glycopeptides), p.3'
  },

  /* ── K. Other / Common (3) ───────────────────────────────── */
  'metronidazole': {
    aliases: ['metronidazole','flagyl','mtz'],
    label:   'Metronidazole',
    klass:   'nitroimidazole', subclass: 'nitroimidazole',
    risk:    { dress:'rare', mpe:'low', urticaria:'low' },
    crossKeys: [],
    note:    'DRESS rare · ห้ามดื่มสุรา (disulfiram-like)',
    ref:     'Siriraj 2018'
  },
  'paracetamol': {
    aliases: ['paracetamol','acetaminophen','para','pcm','tylenol'],
    label:   'Paracetamol',
    klass:   'analgesic', subclass: 'aniline',
    risk:    { mpe:'rare', urticaria:'rare', anaphylaxis:'rare', sjs_ten:'rare' },
    crossKeys: [],
    note:    'Rare cause — แต่ใช้บ่อยมาก · ต้อง track ทุกราย',
    ref:     'Siriraj 2018 (rare cause)'
  },
  'tramadol': {
    aliases: ['tramadol','tramol','trd'],
    label:   'Tramadol',
    klass:   'opioid', subclass: 'opioid',
    risk:    { anaphylaxis:'rare', urticaria:'low' },
    crossKeys: [],
    note:    'Rare anaphylaxis · serotonergic — ระวัง interaction',
    ref:     'Siriraj 2018'
  }
};


/* ─────────────────────────────────────────────────────────────
 *  ALIAS INDEX — built once at load time
 *  Maps every alias → canonical key for fast lookup
 * ───────────────────────────────────────────────────────────── */
const ADR_ALIAS_INDEX = (function() {
  const idx = {};
  Object.keys(ADR_DRUG_KB).forEach(function(key) {
    const entry = ADR_DRUG_KB[key];
    idx[key] = key; // canonical → canonical
    (entry.aliases || []).forEach(function(a) {
      idx[a.toLowerCase().trim()] = key;
    });
  });
  return idx;
})();


/* ─────────────────────────────────────────────────────────────
 *  NORMALIZER — drug name → canonical key
 *
 *  Strips: dose ("500mg", "1g"), route ("IV","PO","IM","SC"),
 *          frequency ("q6h","tid","prn","stat","OD","BID"),
 *          form ("inj","tab","cap","syr","drop"),
 *          parens ("(Augmentin)" or "(Bactrim)") — but extracts content
 *          punctuation
 *  Returns: canonical key from ADR_ALIAS_INDEX, or null if not recognized
 * ───────────────────────────────────────────────────────────── */
function _adrNormalizeDrugName(rawName) {
  if (!rawName) return null;

  let s = String(rawName).toLowerCase();

  // 1) extract parens content (e.g., "Amoxicillin (Augmentin)" → also try "augmentin")
  const parenMatches = [];
  s = s.replace(/\(([^)]+)\)/g, function(_, inner) {
    parenMatches.push(inner.trim());
    return ' ';
  });

  // 2) strip dose/route/freq/form patterns
  const stripPatterns = [
    /\b\d+(\.\d+)?\s?(mg|mcg|g|ml|gm|iu|u|mEq|meq)\b/g, // dose units
    /\b\d+(\.\d+)?\s?(mg\/ml|mg\/kg|g\/day|mg\/day)\b/g,
    /\b\d+\s?(amp|tab|cap|vial|sachet)\b/g,             // count + form
    /\b(iv|im|sc|po|pr|sl|inh|neb|topical)\b/g,         // route
    /\b(stat|prn|od|bid|tid|qid|q\d+h|q\dh|qhs|qd|hs|ac|pc|ngt)\b/g, // freq
    /\b(inj|injection|tab|tablet|cap|capsule|syr|syrup|drop|drops|cream|oint|ointment|gel|spray|mdi|nebule|nasal)\b/g, // form
    /\b(slow|fast|drip|infusion|bolus)\b/g,             // admin
    /[+×*,;]/g,                                          // separators (NOT "x" or "/" — would break drug names)
    /\b\d+\s?[x×]\s?\d+/g,                               // multipliers like "5x", "5×3"
    /\d+\s?\/\s?\d+/g                                    // ratios like 30/70
  ];
  stripPatterns.forEach(function(re) { s = s.replace(re, ' '); });

  // 3) collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  // 4) try lookup in alias index — first the cleaned full string, then word-by-word
  if (ADR_ALIAS_INDEX[s]) return ADR_ALIAS_INDEX[s];

  // 5) try paren content
  for (let i = 0; i < parenMatches.length; i++) {
    const p = parenMatches[i].toLowerCase().trim();
    if (ADR_ALIAS_INDEX[p]) return ADR_ALIAS_INDEX[p];
  }

  // 6) word-by-word — try each token
  const tokens = s.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (ADR_ALIAS_INDEX[tokens[i]]) return ADR_ALIAS_INDEX[tokens[i]];
  }

  // 7) try multi-word combinations (e.g., "co trimoxazole")
  for (let i = 0; i < tokens.length - 1; i++) {
    const combo = tokens[i] + ' ' + tokens[i + 1];
    if (ADR_ALIAS_INDEX[combo]) return ADR_ALIAS_INDEX[combo];
    const dashed = tokens[i] + '-' + tokens[i + 1];
    if (ADR_ALIAS_INDEX[dashed]) return ADR_ALIAS_INDEX[dashed];
  }

  return null; // unrecognized
}


/* ─────────────────────────────────────────────────────────────
 *  HELPERS
 * ───────────────────────────────────────────────────────────── */

// Convert risk level to numeric weight
const _RISK_WEIGHT = { high: 3, medium: 2, low: 1, rare: 0.3 };

// Compute days between two YYYY-MM-DD strings
function _adrDaysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const a = new Date(startStr);
  const b = new Date(endStr);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}


/* ─────────────────────────────────────────────────────────────
 *  SUSPECT-DRUG RULE ENGINE
 *
 *  Input: state = {
 *    classification: 'mpe' | 'sjs_ten' | 'dress' | 'agep' | 'urticaria' | 'anaphylaxis' | 'fde',
 *    onsetDate:      'YYYY-MM-DD',  // วันเริ่มมีอาการแพ้
 *    drugs: [
 *      { name: 'Meropenem 1g IV q8h',
 *        startDate: 'YYYY-MM-DD',
 *        stopDate:  'YYYY-MM-DD' (or empty if ongoing),
 *        isSuspect: true|false }
 *    ]
 *  }
 *
 *  Output: {
 *    suspects: [{ rank, drug, kbEntry, score, latencyDays, reasoning: [...] }],
 *    crossReactWarn: [...]   // ยาที่ cross-react กับ top suspect
 *  }
 * ───────────────────────────────────────────────────────────── */
function _adrSuggestSuspects(state) {
  const phenotypeKey = state.classification;
  const phenotype = ADR_PHENOTYPE[phenotypeKey];
  if (!phenotype) {
    return { suspects: [], crossReactWarn: [], error: 'Unknown phenotype: ' + phenotypeKey };
  }

  const onsetDate = state.onsetDate;
  const drugs = state.drugs || [];
  const scored = [];

  drugs.forEach(function(d) {
    const canonical = _adrNormalizeDrugName(d.name);
    const kb = canonical ? ADR_DRUG_KB[canonical] : null;
    const reasoning = [];
    let score = 0;

    // ── 1) Latency check ──
    const latency = _adrDaysBetween(d.startDate, onsetDate);
    let latencyMatch = null;
    if (latency !== null && phenotype.latencyDays) {
      const [lo, hi] = phenotype.latencyDays;
      if (latency >= lo && latency <= hi) {
        latencyMatch = 'in-window';
        score += 4;
        reasoning.push({
          icon: 'pos',
          text: 'latency ' + latency + ' วัน — อยู่ใน ' + phenotype.label + ' window (' + lo + '–' + hi + ' วัน)'
        });
      } else if (latency >= lo - 2 && latency <= hi + 7) {
        latencyMatch = 'borderline';
        score += 2;
        reasoning.push({
          icon: 'warn',
          text: 'latency ' + latency + ' วัน — borderline (window ' + lo + '–' + hi + ' วัน)'
        });
      } else {
        latencyMatch = 'out-of-window';
        score += 0;
        reasoning.push({
          icon: 'warn',
          text: 'latency ' + latency + ' วัน — นอก window (' + lo + '–' + hi + ' วัน)'
        });
      }
    } else if (phenotype.latencyMinutes && latency !== null && latency <= 1) {
      // immediate-type (urticaria/anaphylaxis) — within 24h is fine
      latencyMatch = 'in-window';
      score += 4;
      reasoning.push({ icon: 'pos', text: 'immediate-type · ภายใน 24 ชม. หลังได้ยา' });
    } else if (latency === null) {
      reasoning.push({ icon: 'warn', text: 'ไม่มีข้อมูล start date — ประเมิน latency ไม่ได้' });
    }

    // ── 2) KB class match ──
    if (kb) {
      const riskLevel = (kb.risk && kb.risk[phenotypeKey]) || null;
      if (riskLevel) {
        const w = _RISK_WEIGHT[riskLevel] || 0;
        score += w * 1.5; // class match weighted higher
        reasoning.push({
          icon: 'pos',
          text: kb.klass + (kb.subclass ? ' (' + kb.subclass + ')' : '') +
                ' — known cause ของ ' + phenotype.label + ' (risk: ' + riskLevel + ')'
        });
      } else {
        reasoning.push({
          icon: 'info',
          text: kb.klass + ' — ไม่ใช่ typical cause ของ ' + phenotype.label
        });
      }
      // Special note from KB
      if (kb.note) {
        reasoning.push({ icon: 'info', text: kb.note });
      }
    } else {
      reasoning.push({
        icon: 'warn',
        text: 'ไม่พบใน KB — ระบบไม่สามารถประเมิน class/risk ได้'
      });
    }

    // ── 3) Still ongoing at onset? ──
    let ongoingAtOnset = false;
    if (d.startDate && onsetDate) {
      if (!d.stopDate || d.stopDate >= onsetDate) {
        ongoingAtOnset = true;
        score += 1;
        reasoning.push({
          icon: 'pos',
          text: 'ยังให้อยู่ ณ เวลาเกิด event — temporal association แรง'
        });
      }
    }

    // ── 4) User-marked suspect bonus ──
    if (d.isSuspect) score += 0.5;

    scored.push({
      drug:        d,
      canonical:   canonical,
      kbEntry:     kb,
      score:       score,
      latencyDays: latency,
      latencyMatch: latencyMatch,
      ongoingAtOnset: ongoingAtOnset,
      reasoning:   reasoning
    });
  });

  // Sort by score descending
  scored.sort(function(a, b) { return b.score - a.score; });

  // Add rank
  scored.forEach(function(s, i) { s.rank = i + 1; });

  // ── Cross-react warnings (based on top suspect) ──
  const crossReactWarn = [];
  if (scored.length > 0 && scored[0].kbEntry && scored[0].kbEntry.crossKeys) {
    scored[0].kbEntry.crossKeys.forEach(function(ck) {
      const ckEntry = ADR_DRUG_KB[ck];
      if (ckEntry) {
        crossReactWarn.push({
          canonical: ck,
          label: ckEntry.label,
          klass: ckEntry.klass,
          subclass: ckEntry.subclass
        });
      }
    });
  }

  return {
    suspects: scored,
    crossReactWarn: crossReactWarn,
    phenotypeUsed: phenotype
  };
}


/* ─────────────────────────────────────────────────────────────
 *  MANAGEMENT TEMPLATES — by phenotype + severity
 *
 *  Source: Siriraj 2018, Treatment section (p.5-6)
 *
 *  Each template returns groups:
 *    - hold:      drugs to stop (filled by suspect engine + cross-react)
 *    - treatment: acute management orders
 *    - stepdown:  oral/maintenance after acute
 *    - workup:    labs/investigations
 *    - consult:   referral / specialty
 *
 *  Hospital constraints:
 *    - Methylprednisolone NOT available — refer for pulse therapy
 *    - IVIG NOT available — refer for SJS-TEN
 *    - Adrenaline available
 *    - CPM inj 10mg, Dex inj 4mg/8mg, Hydrocort 100mg, Pred 5mg PO,
 *      Cetirizine 10mg PO available
 * ───────────────────────────────────────────────────────────── */
const ADR_MGMT_TEMPLATES = {

  /* ── MPE — mild ───────────────────────────────────────────── */
  mpe_mild: {
    label: 'MPE — mild (BSA <10%, no systemic)',
    treatment: [
      { text: 'CPM (Chlorpheniramine) inj 10 mg IV stat (1 amp)',
        ref:  'Siriraj 2018, Tx mild rash, p.5' },
      { text: 'Triamcinolone (TA) 0.1% cream apply ทาบริเวณผื่น bid',
        ref:  'Siriraj 2018, Tx mild rash, p.5' }
    ],
    stepdown: [
      { text: 'Cetirizine 10 mg PO OD × 7 วัน',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Pred 5 mg PO 4 tab OD × 5 วัน then taper (ถ้าผื่นไม่ดีขึ้นใน 48 ชม.)',
        ref:  'Siriraj 2018, p.5' }
    ],
    workup: [
      { text: 'CBC + LFT + Cr (baseline — exclude DRESS evolution)',
        ref:  'Siriraj 2018, monitor p.5' }
    ],
    consult: [],
    monitor: 'นัด follow-up 3-5 วัน · ถ้ามีไข้/หน้าบวม/lab ผิดปกติ → re-evaluate DRESS'
  },

  /* ── MPE — moderate-severe ───────────────────────────────── */
  mpe_moderate: {
    label: 'MPE — moderate (BSA 10-30% or extensive)',
    treatment: [
      { text: 'CPM inj 10 mg IV stat (1 amp) → 4 mg IV q6h',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Dex inj 8 mg IV stat (2 amp) → 4 mg IV q6h × 24-48 ชม.',
        ref:  'Siriraj 2018, p.5' },
      { text: 'หรือ Hydrocortisone 100 mg IV q6h (ถ้าเป็น DM/มี infection)',
        ref:  'Siriraj 2018, p.5' },
      { text: 'TA 0.1% cream ทาผื่น bid',
        ref:  'Siriraj 2018, p.5' }
    ],
    stepdown: [
      { text: 'Pred 30 mg PO OD เมื่อผื่นเริ่มจาง then taper × 1-2 wk',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Cetirizine 10 mg PO OD',
        ref:  'Siriraj 2018, p.5' }
    ],
    workup: [
      { text: 'CBC + diff (eos), LFT, Cr — exclude DRESS',
        ref:  'Siriraj 2018, p.6' }
    ],
    consult: [],
    monitor: 'admit 24-48 ชม. · ถ้ามี facial edema/eos/LFT rise → DRESS → upgrade Tx'
  },

  /* ── DRESS / DIHS — severe ───────────────────────────────── */
  dress: {
    label: 'DRESS / DIHS — severe systemic',
    treatment: [
      { text: 'STOP suspect drugs ทุกตัวที่เริ่มภายใน 2 เดือน',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Hydrocortisone 100 mg IV q6h × 2-3 วัน (acute phase)',
        ref:  'Siriraj 2018, Tx DRESS p.6' },
      { text: 'Topical steroid (high potency) ทาผื่น bid',
        ref:  'Siriraj 2018, p.6' }
    ],
    stepdown: [
      { text: 'Pred 40-60 mg PO OD (1 mg/kg) — slow taper × 6-8 สัปดาห์',
        ref:  'Siriraj 2018, p.6 (slow taper สำคัญ ป้องกัน flare)' },
      { text: 'Cetirizine 10 mg PO OD',
        ref:  'Siriraj 2018, p.6' }
    ],
    workup: [
      { text: 'CBC + diff (eosinophilia ≥1500 cells/μL?)',
        ref:  'RegiSCAR criteria · Siriraj 2018, p.3' },
      { text: 'LFT (AST, ALT, ALP, bilirubin) — hepatitis ≥30%',
        ref:  'Siriraj 2018, p.3' },
      { text: 'BUN/Cr + UA — interstitial nephritis',
        ref:  'Siriraj 2018, p.3' },
      { text: 'EBV / HHV-6 / HHV-7 PCR (ถ้าทำได้ — refer center)',
        ref:  'Siriraj 2018, viral reactivation p.6' },
      { text: 'TSH baseline + 2-3 เดือนหลัง (autoimmune thyroiditis sequel)',
        ref:  'Siriraj 2018, prognosis p.7' }
    ],
    consult: [
      { text: 'Consult อายุรแพทย์ — admit ติดตาม organ involvement',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Refer: Methylprednisolone pulse 1g IV × 3d (ถ้า severe organ involvement) — รพ.ห้วยผึ้งไม่มี',
        unavailable: true,
        ref:  'Siriraj 2018, p.6' }
    ],
    monitor: 'admit · monitor LFT/Cr q24h × 3-5d · DRESS mortality ~10%'
  },

  /* ── SJS / TEN — severe ──────────────────────────────────── */
  sjs_ten: {
    label: 'SJS / TEN — severe mucocutaneous',
    treatment: [
      { text: 'STOP suspect drugs ทุกตัวทันที',
        ref:  'Siriraj 2018, Tx SJS-TEN p.6' },
      { text: 'NPO ระวัง mucositis · IV fluid resuscitation (Ringer)',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Eye care — artificial tears + ophthalmologist',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Mouth care — chlorhexidine mouthwash',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Skin care — non-adherent dressing, ห้ามดึงผิวหลุด',
        ref:  'Siriraj 2018, p.6' }
    ],
    stepdown: [
      { text: 'Cetirizine 10 mg PO OD (เมื่อกินได้)',
        ref:  'Siriraj 2018, p.6' }
    ],
    workup: [
      { text: 'CBC, LFT, BUN/Cr, electrolytes, blood culture',
        ref:  'Siriraj 2018, p.6' },
      { text: 'SCORTEN score — prognostication',
        ref:  'Siriraj 2018, Table 3, p.7' }
    ],
    consult: [
      { text: 'REFER ICU / Burn unit ด่วน',
        unavailable: true,
        ref:  'Siriraj 2018, p.6' },
      { text: 'Refer: IVIG 1 g/kg/วัน × 3 วัน — รพ.ห้วยผึ้งไม่มี',
        unavailable: true,
        ref:  'Siriraj 2018, p.6' },
      { text: 'Refer: Cyclosporin 3-5 mg/kg/วัน — option ใน TEN',
        unavailable: true,
        ref:  'Siriraj 2018, p.6' }
    ],
    monitor: 'mortality SJS ~10%, TEN ~30% · refer center ทันที — รพ.ชุมชนทำได้แค่ stabilize'
  },

  /* ── AGEP ─────────────────────────────────────────────────── */
  agep: {
    label: 'AGEP — Acute Generalized Exanthematous Pustulosis',
    treatment: [
      { text: 'STOP suspect drug — ส่วนใหญ่เริ่มภายใน 1-2 วันก่อน onset',
        ref:  'Siriraj 2018, Tx AGEP p.6' },
      { text: 'Topical steroid (mid-high potency) ทาผื่น bid',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Antiseptic dressing — ป้องกัน secondary infection',
        ref:  'Siriraj 2018, p.6' }
    ],
    stepdown: [
      { text: 'Cetirizine 10 mg PO OD ถ้าคัน',
        ref:  'Siriraj 2018, p.6' }
    ],
    workup: [
      { text: 'CBC — neutrophilia (>7000) ตามนิยาม',
        ref:  'Siriraj 2018, Table 1, p.3' },
      { text: 'Skin culture/swab — exclude bacterial pustulosis',
        ref:  'Siriraj 2018, p.6' }
    ],
    consult: [],
    monitor: 'self-limited 4-10 วันหลัง stop drug · prognosis ดี · mortality <5%'
  },

  /* ── Urticaria — acute drug-induced ──────────────────────── */
  urticaria: {
    label: 'Urticaria — acute drug-induced',
    treatment: [
      { text: 'STOP suspect drug',
        ref:  'Siriraj 2018, p.5' },
      { text: 'CPM inj 10 mg IV stat (ถ้าผื่น generalized)',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Hydrocortisone 100 mg IV stat (ถ้า severe/หายใจติด — แต่ไม่ใช่ anaphylaxis)',
        ref:  'Siriraj 2018, p.5' }
    ],
    stepdown: [
      { text: 'Cetirizine 10 mg PO OD × 7-14 วัน',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Loratadine 10 mg PO OD (ถ้าไม่อยากให้ง่วง)',
        ref:  'Siriraj 2018, p.5' }
    ],
    workup: [],
    consult: [],
    monitor: 'observe 1-2 ชม. · ถ้า progress → wheeze/hypotension → anaphylaxis protocol'
  },

  /* ── Anaphylaxis — life-threatening ──────────────────────── */
  anaphylaxis: {
    label: 'Anaphylaxis — life-threatening',
    treatment: [
      { text: '★ Adrenaline (1:1000) 0.3-0.5 mL IM ที่ thigh stat — repeat q5-15min ถ้าไม่ดีขึ้น',
        ref:  'Siriraj 2018, Anaphylaxis Tx p.5' },
      { text: 'O2 supplement keep SpO2 ≥94%',
        ref:  'Siriraj 2018, p.5' },
      { text: 'IV fluid (NSS) bolus 1-2 L ถ้า hypotension',
        ref:  'Siriraj 2018, p.5' },
      { text: 'CPM inj 10 mg IV stat (H1 blocker)',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Ranitidine 50 mg IV stat (H2 blocker)',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Hydrocortisone 200 mg IV stat → 100 mg q6h × 24 ชม.',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Salbutamol nebulize ถ้า bronchospasm',
        ref:  'Siriraj 2018, p.5' }
    ],
    stepdown: [
      { text: 'Cetirizine 10 mg PO OD × 3-5 วัน',
        ref:  'Siriraj 2018, p.5' },
      { text: 'Pred 30 mg PO OD × 3 วัน',
        ref:  'Siriraj 2018, p.5' }
    ],
    workup: [
      { text: 'Tryptase level (ถ้าทำได้ — ภายใน 1-3 ชม. หลัง episode)',
        ref:  'Siriraj 2018, p.5' }
    ],
    consult: [
      { text: 'admit observe 6-24 ชม. (biphasic ~5%)',
        ref:  'Siriraj 2018, p.5' }
    ],
    monitor: 'ทำ ADR card · ส่ง allergy clinic · พกยา card + EpiPen (ถ้ามี)'
  },

  /* ── Fixed Drug Eruption ──────────────────────────────────── */
  fde: {
    label: 'Fixed Drug Eruption (FDE)',
    treatment: [
      { text: 'STOP suspect drug',
        ref:  'Siriraj 2018, p.6' },
      { text: 'Topical steroid (mid potency) ทาเฉพาะที่',
        ref:  'Siriraj 2018, p.6' }
    ],
    stepdown: [
      { text: 'Cetirizine 10 mg PO OD ถ้าคัน',
        ref:  'Siriraj 2018, p.6' }
    ],
    workup: [],
    consult: [],
    monitor: 'self-limited · post-inflammatory pigmentation อยู่นาน · หลีกเลี่ยงยาเดิม'
  }
};


/* ─────────────────────────────────────────────────────────────
 *  ACTION SUGGESTION ENGINE
 *
 *  Input: state = {
 *    classification:  phenotype key,
 *    severity:        'mild' | 'moderate' | 'severe' (optional — auto-pick template)
 *    bsaPct:          number (optional — for MPE severity)
 *    mucosa:          boolean
 *    systemic:        boolean
 *    suspects:        result from _adrSuggestSuspects
 *  }
 *
 *  Output: {
 *    template:    template object
 *    hold:        [{ canonical, label, reason }]    — auto-generated from suspects + cross
 *    treatment:   [{ text, ref }]
 *    stepdown:    [{ text, ref }]
 *    workup:      [{ text, ref }]
 *    consult:     [{ text, ref, unavailable? }]
 *    monitor:     string
 *  }
 * ───────────────────────────────────────────────────────────── */
function _adrSuggestActions(state) {
  // Pick template
  let templateKey = state.classification;
  if (state.classification === 'mpe') {
    const bsa = Number(state.bsaPct || 0);
    const hasSystemic = !!state.systemic;
    if (bsa >= 10 || hasSystemic) templateKey = 'mpe_moderate';
    else templateKey = 'mpe_mild';
  }

  const template = ADR_MGMT_TEMPLATES[templateKey];
  if (!template) {
    return { error: 'Unknown phenotype: ' + state.classification };
  }

  // STOP NOW — drugs currently on patient (ranked suspects)
  const stopNow = [];
  const seenKeys = {};

  if (state.suspects && state.suspects.suspects) {
    state.suspects.suspects.forEach(function(s, i) {
      if (i >= 2 && s.score < 3) return;   // top 2 always; #3+ only if score > 3
      const key = s.canonical || s.drug.name.toLowerCase();
      if (seenKeys[key]) return;
      seenKeys[key] = true;
      stopNow.push({
        canonical: s.canonical,
        label:     s.kbEntry ? s.kbEntry.label : s.drug.name,
        reason:    'rank #' + s.rank + ' suspect (score ' + s.score.toFixed(1) + ')'
      });
    });
  }

  // AVOID FUTURE — cross-reactive drugs (not currently on patient)
  const avoidFuture = [];
  if (state.suspects && state.suspects.crossReactWarn) {
    state.suspects.crossReactWarn.forEach(function(cr) {
      if (seenKeys[cr.canonical]) return;
      seenKeys[cr.canonical] = true;
      avoidFuture.push({
        canonical: cr.canonical,
        label:     cr.label,
        reason:    'cross-reactive (' + cr.klass + (cr.subclass ? '/' + cr.subclass : '') + ')'
      });
    });
  }

  return {
    templateKey: templateKey,
    template:    template,
    stopNow:     stopNow,
    avoidFuture: avoidFuture,
    hold:        stopNow,                    // backward-compat alias
    treatment:   template.treatment || [],
    stepdown:    template.stepdown  || [],
    workup:      template.workup    || [],
    consult:     template.consult   || [],
    monitor:     template.monitor   || ''
  };
}


/* ─────────────────────────────────────────────────────────────
 *  COMBINED ENGINE — both suspects + actions in one call
 * ───────────────────────────────────────────────────────────── */
function _adrDecisionSupport(state) {
  const suspects = _adrSuggestSuspects(state);
  const actions  = _adrSuggestActions({
    classification: state.classification,
    bsaPct:         state.bsaPct,
    mucosa:         state.mucosa,
    systemic:       state.systemic,
    suspects:       suspects
  });
  return { suspects: suspects, actions: actions };
}


/* ─────────────────────────────────────────────────────────────
 *  EXPOSE
 * ───────────────────────────────────────────────────────────── */
if (typeof window !== 'undefined') {
  window.ADR_PHENOTYPE         = ADR_PHENOTYPE;
  window.ADR_DRUG_KB           = ADR_DRUG_KB;
  window.ADR_ALIAS_INDEX       = ADR_ALIAS_INDEX;
  window.ADR_MGMT_TEMPLATES    = ADR_MGMT_TEMPLATES;
  window._adrNormalizeDrugName = _adrNormalizeDrugName;
  window._adrSuggestSuspects   = _adrSuggestSuspects;
  window._adrSuggestActions    = _adrSuggestActions;
  window._adrDecisionSupport   = _adrDecisionSupport;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ADR_PHENOTYPE, ADR_DRUG_KB, ADR_ALIAS_INDEX, ADR_MGMT_TEMPLATES,
    _adrNormalizeDrugName, _adrSuggestSuspects, _adrSuggestActions,
    _adrDecisionSupport
  };
}
