// ─── LiftIQ Nutrition Conditions Library ────────────────────────────────────
//
// Evidence-based dietary guidance for 9 medical conditions.
// Each condition follows the same schema so NutritionScreen.jsx can apply
// food filters, show nutrient alerts, and generate condition-aware meal plans.
//
// Schema per condition:
// {
//   id: string
//   name: string
//   display_name: string
//   prevalence: string           — rough population prevalence for UX context
//   mechanism: string            — why diet matters for this condition
//   first_line: string           — the primary dietary approach with evidence level
//   key_protocols: string[]      — ordered list of what to do
//   foods_emphasise: FoodRule[]  — foods/patterns to eat more of
//   foods_limit: FoodRule[]      — foods to eat less of
//   foods_avoid: FoodRule[]      — foods to eliminate (strict)
//   nutrients_watch: NutrientFlag[]  — deficiencies or excesses to flag
//   supplement_evidence: Supplement[]  — nutraceuticals with actual evidence
//   exercise_interaction: string     — how training interacts with the condition
//   myths_busted: string[]           — common myths the app should NOT promote
//   app_alerts: AppAlert[]           — warnings to surface in the UI
//   medical_disclaimer: string
//   sources: string[]
// }
//
// Sources cited throughout:
// IBS: Cuffe et al. Lancet Gastroenterol Hepatol 2025; Zeraattalab-Motlagh et al. Nutr Rev 2025;
//      Jensen et al. Gastroenterol Res Pract 2025
// PCOS: Zhang et al. Front Nutr 2025; Scannell et al. Proc Nutr Soc 2025;
//       Frontiers Nutr 2025 umbrella meta-analysis (n=30,133)
// Celiac: Boatta et al. Curr Res Food Sci 2026; Ghunaim et al. Cureus 2024;
//         Zdzieblik et al. Front Sports 2025
// Lactose: StatPearls 2024; PMC nutritional management review; NIH Calcium fact sheet
// Hypothyroidism: Nutrients 2024 (PMC11314468); PMC 2025 (PMC12372124)
// Diabetes T2: ADA Standards 2024 & 2025; PMC umbrella meta-analysis 2025
// IBD/Crohn/UC: AGA 2024 CPU; ECCO Consensus J Crohns Colitis 2025; Melton et al. JGH Open 2024
// Gout: McCarty et al. Ther Adv Musculoskelet 2025; USDA Purine DB 2025; Mayo Clinic 2025
// CKD: KDIGO 2024; KDOQI 2020; NIDDK 2024
// CVD/Hypertension: AHA 2026 Scientific Statement; Italian 2025 National Guidelines;
//                   PREDIMED; DASH-Sodium trial
// MASLD/NAFLD: AGA guidelines; PMC 2025 MASLD MNT review; Frontiers Nutr 2025

// ─── CONDITION REGISTRY ────────────────────────────────────────────────────

export const CONDITIONS = {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. IBS — Irritable Bowel Syndrome
  // ═══════════════════════════════════════════════════════════════════════════
  ibs: {
    id: 'ibs',
    name: 'IBS',
    display_name: 'Irritable Bowel Syndrome (IBS)',
    prevalence: '5–15% of adults globally',
    mechanism: 'IBS involves gut-brain axis dysregulation, visceral hypersensitivity, and altered motility. Fermentable carbohydrates (FODMAPs) draw water into the bowel and ferment in the colon, producing gas and triggering symptoms in sensitised individuals.',
    first_line: 'Low FODMAP diet — ranked first across 28 RCTs (n=2,338) for global IBS symptom relief. RR of symptoms not improving: 0.51 vs habitual diet (Cuffe et al. Lancet Gastroenterol Hepatol 2025). A simplified low FOS+GOS diet (subset of FODMAP) shows equivalent efficacy and is easier to follow (Jensen et al. 2025).',
    key_protocols: [
      'Phase 1 (2–6 weeks): Restrict all high-FODMAP foods — the elimination phase',
      'Phase 2: Systematic reintroduction of one FODMAP subgroup at a time to identify personal triggers',
      'Phase 3: Personalisation — liberalise diet keeping only confirmed triggers restricted',
      'Common triggers: wheat, onion, garlic, pulses/legumes, milk — flag these first',
      'Low FOS+GOS diet (avoiding wheat, onion, garlic, legumes only) may be tried before full FODMAP for adherence',
      'Probiotics show moderate additional benefit — RR 4.04 for abdominal pain relief',
    ],
    foods_emphasise: [
      { food: 'Low-FODMAP fruits', examples: 'Bananas (unripe), blueberries, grapes, oranges, kiwi, pineapple, strawberries', reason: 'Low fermentable content' },
      { food: 'Low-FODMAP vegetables', examples: 'Carrots, cucumber, capsicum, eggplant, lettuce, potato, tomato, zucchini', reason: 'Low fermentable content' },
      { food: 'Rice and oats (certified GF if needed)', examples: 'White rice, rolled oats (check serving size)', reason: 'Low FODMAP grains' },
      { food: 'Plain proteins', examples: 'Eggs, fish, chicken, beef, tofu (firm)', reason: 'FODMAP-free protein sources' },
      { food: 'Lactose-free dairy', examples: 'Lactose-free milk, hard cheese (cheddar, parmesan), butter', reason: 'Dairy without the lactose FODMAP load' },
      { food: 'Soluble fibre', examples: 'Oats, psyllium husk, carrots', reason: 'Improves IBS symptoms — evidence for fibre supplementation' },
      { food: 'Mediterranean diet pattern', examples: 'Whole foods, olive oil, fish, vegetables', reason: 'Shows promise as alternative to FODMAP (pilot RCT 2025)' },
    ],
    foods_limit: [
      { food: 'Wheat products', reason: 'High fructans (FOS) — most common IBS trigger', serving_guide: 'Max 1 slice sourdough spelt bread per sitting' },
      { food: 'Onion and garlic', reason: 'Highest fructan content of all vegetables — even small amounts trigger symptoms in most IBS patients', serving_guide: 'Use garlic-infused oil instead (fructans are water-soluble, not fat-soluble)' },
      { food: 'Legumes/pulses', reason: 'High GOS (galacto-oligosaccharides)', serving_guide: 'Canned and rinsed lentils in small amounts may be tolerated' },
      { food: 'Lactose-containing dairy', reason: 'Lactose is a FODMAP', serving_guide: 'Switch to lactose-free alternatives or hard cheese' },
      { food: 'High-fructose fruits', reason: 'Excess fructose absorption issues', serving_guide: 'Mango, apple, pear, cherry — limit or avoid' },
      { food: 'Polyol foods', reason: 'Sugar alcohols cause osmotic effect', serving_guide: 'Stone fruits (peach, plum, apricot), cauliflower, mushrooms, sugar-free products with sorbitol/mannitol' },
      { food: 'Alcohol', reason: 'Gut irritant, alters motility', serving_guide: 'Limit; beer and rum are highest FODMAP' },
    ],
    foods_avoid: [
      { food: 'Garlic and onion in large amounts', reason: 'Most consistent IBS trigger in clinical trials — even small amounts problematic for many' },
      { food: 'Sugar-free products with polyols', reason: 'Sorbitol, mannitol, xylitol cause osmotic diarrhoea' },
    ],
    nutrients_watch: [
      { nutrient: 'Fibre', risk: 'Low during FODMAP restriction — many fibre-rich foods are high-FODMAP', action: 'Supplement with psyllium husk; maintain low-FODMAP fibre sources' },
      { nutrient: 'Calcium', risk: 'Reduced if avoiding dairy', action: 'Use lactose-free dairy or fortified alternatives' },
      { nutrient: 'B vitamins', risk: 'Reduced if avoiding wheat products', action: 'Rice, oats, meat, eggs provide adequate B vitamins on low FODMAP' },
      { nutrient: 'Prebiotic intake', risk: 'Low FODMAP diet significantly reduces prebiotic substrates for gut bacteria', action: 'Gradually reintroduce tolerated prebiotic foods in phase 3; consider probiotic supplementation' },
    ],
    supplement_evidence: [
      { supplement: 'Probiotics', evidence: 'Moderate — RR 4.04 for abdominal pain. Multi-strain formulas more effective. Effect is strain-specific', grade: 'B' },
      { supplement: 'Peppermint oil (enteric-coated)', evidence: 'Reduces global IBS symptoms and pain — modest effect, low risk', grade: 'B' },
      { supplement: 'Psyllium husk (soluble fibre)', evidence: 'Improves global IBS symptoms', grade: 'B' },
      { supplement: 'Vitamin D3', evidence: 'May reduce IBS symptom severity — limited evidence', grade: 'C' },
    ],
    exercise_interaction: 'Regular moderate exercise improves gut motility and reduces IBS symptom severity. Intense exercise can temporarily worsen symptoms due to gut blood flow reduction — time meals 2–3 hours before training.',
    myths_busted: [
      'Gluten causes IBS — false. Fructans in wheat are the likely culprit, not gluten itself. True non-coeliac gluten sensitivity is rare.',
      'You need to avoid all high-FODMAP foods forever — false. The reintroduction phase determines personal triggers. Most people can reintroduce many foods.',
      'IBS is a psychological problem — false. It is a real physiological condition involving gut-brain axis dysfunction.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'logging_garlic_or_onion', message: 'Onion and garlic are the highest-FODMAP foods and a common IBS trigger. Consider garlic-infused olive oil as a substitute.' },
      { type: 'info', trigger: 'logging_wheat', message: 'Wheat is high in fructans. If your IBS is poorly controlled, limiting wheat may help more than avoiding gluten.' },
      { type: 'info', trigger: 'phase_1_complete', message: 'After 6 weeks on low FODMAP, begin systematic reintroduction — you may tolerate more foods than you think.' },
    ],
    medical_disclaimer: 'Low FODMAP diet should ideally be supervised by a dietitian. Self-implementation without guidance may lead to unnecessary dietary restriction and nutritional inadequacy. This guidance is educational, not a medical treatment plan.',
    sources: ['Cuffe et al. Lancet Gastroenterol Hepatol 2025', 'Jensen et al. Gastroenterol Res Pract 2025', 'Zeraattalab-Motlagh et al. Nutr Rev 2025', 'Wilson & Whelan J Gastroenterol Hepatol 2017'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PCOS — Polycystic Ovary Syndrome
  // ═══════════════════════════════════════════════════════════════════════════
  pcos: {
    id: 'pcos',
    name: 'PCOS',
    display_name: 'Polycystic Ovary Syndrome (PCOS)',
    prevalence: '5–15% of reproductive-age women; 50–75% have insulin resistance',
    mechanism: 'PCOS involves insulin resistance, compensatory hyperinsulinemia, and excess androgens. Hyperinsulinism cooperates with LH to upregulate androgen production, driving core PCOS features. Diet directly impacts insulin sensitivity, which modulates androgen levels and reproductive function.',
    first_line: 'Low glycaemic index diet with adequate fibre — most consistent evidence across RCTs. Mediterranean diet is the best-studied comprehensive pattern. Low-carbohydrate diets (<45% energy) significantly reduce BMI and increase SHBG, reducing hyperandrogenism (Zhang meta-analysis n=327). Carbohydrate QUALITY matters more than quantity.',
    key_protocols: [
      '5–10% body weight loss (if overweight) improves insulin sensitivity and testosterone levels significantly',
      'Prioritise low glycaemic index carbohydrates — legumes, whole grains, non-starchy vegetables',
      'High dietary fibre — target 25–30g/day minimum (most women with PCOS consume well below this)',
      'Anti-inflammatory dietary pattern — omega-3 rich fish, olive oil, colourful vegetables',
      'Avoid refined carbohydrates and sugar-sweetened beverages completely',
      'Eat smaller, more frequent meals to maintain blood sugar stability (every 3–4 hours)',
      'Do NOT recommend intermittent fasting — blood sugar instability risk in insulin-resistant patients',
    ],
    foods_emphasise: [
      { food: 'Legumes', examples: 'Lentils, chickpeas, black beans, kidney beans', reason: 'High fibre, low GI, improve insulin sensitivity (Kazemi 2018)' },
      { food: 'Non-starchy vegetables', examples: 'Leafy greens, broccoli, capsicum, cucumber, tomatoes', reason: 'Low GI, high fibre, anti-inflammatory' },
      { food: 'Whole grains', examples: 'Oats, quinoa, barley, brown rice, buckwheat', reason: 'Low GI vs refined grains; fibre improves insulin sensitivity' },
      { food: 'Omega-3 rich fish', examples: 'Salmon, sardines, mackerel, trout', reason: 'Anti-inflammatory; omega-3 supplementation reduces androgen markers' },
      { food: 'Healthy fats', examples: 'Extra-virgin olive oil, avocado, walnuts, almonds', reason: 'Mediterranean diet pattern; reduces inflammation and insulin resistance' },
      { food: 'Whole fruit', examples: 'Berries, apples, pears — fibre slows glucose absorption', reason: 'Lower GI than juice; polyphenols anti-inflammatory' },
      { food: 'Lean proteins', examples: 'Fish, chicken, eggs, Greek yogurt, legumes', reason: 'Protein at each meal blunts postprandial glucose rise' },
    ],
    foods_limit: [
      { food: 'Refined carbohydrates', reason: 'High GI spikes insulin — worsens hyperinsulinemia and androgen production', examples: 'White bread, white rice, pastries, crackers, most cereals' },
      { food: 'Sugar-sweetened beverages', reason: 'Liquid fructose bypasses satiety signals and spikes insulin dramatically', examples: 'Soda, juice, energy drinks, sweetened coffee drinks' },
      { food: 'Excess dairy', reason: 'Dairy products (especially starchy foods combined with dairy) trigger higher postprandial insulin release', serving_guide: 'Low-fat dairy in moderation; fermented dairy (yogurt) better tolerated' },
      { food: 'Highly processed foods', reason: 'High in refined carbs, unhealthy fats, and additives that worsen inflammation and insulin resistance', examples: 'Fast food, chips, packaged snacks, instant noodles' },
      { food: 'Red and processed meat', reason: 'Saturated fat worsens insulin resistance; associated with higher androgen levels', serving_guide: 'Occasional lean red meat acceptable; processed meat to be minimised' },
    ],
    foods_avoid: [
      { food: 'Sugar-sweetened beverages (including fruit juice)', reason: 'Most rapid route to worsening hyperinsulinemia — no fibre to slow absorption' },
      { food: 'Trans fats', reason: 'Found in some fried foods, partially hydrogenated oils — worsen inflammation and insulin sensitivity' },
    ],
    nutrients_watch: [
      { nutrient: 'Myo-inositol', risk: 'Low in typical Western diet; significantly improves insulin sensitivity in PCOS', action: 'Consider supplementation — HOMA-IR SMD -0.81 across RCTs; 2000–4000mg/day studied' },
      { nutrient: 'Vitamin D', risk: 'Deficiency common in PCOS; linked to insulin resistance and androgen levels', action: 'Test serum levels; supplement if deficient — 1000–2000 IU/day' },
      { nutrient: 'Omega-3 fatty acids', risk: 'Most people consume inadequate omega-3; deficiency worsens inflammation', action: '2–3g EPA+DHA from fish or supplement daily' },
      { nutrient: 'Magnesium', risk: 'Deficiency common; associated with insulin resistance', action: 'Food-first (dark chocolate, nuts, legumes, leafy greens) then consider supplementation' },
      { nutrient: 'Iron', risk: 'Heavy menstrual bleeding common in PCOS — iron deficiency risk', action: 'Check ferritin levels; red meat, spinach, legumes in diet; supplement if deficient' },
      { nutrient: 'Fibre', risk: 'Women with PCOS consume significantly less fibre than controls (SMD -0.32)', action: 'Target 25–30g daily minimum from legumes, whole grains, vegetables, fruit' },
    ],
    supplement_evidence: [
      { supplement: 'Myo-inositol', evidence: 'Strongest evidence for PCOS — significantly improves HOMA-IR (SMD -0.81), SHBG, menstrual regularity. Dose: 2000–4000mg/day', grade: 'A' },
      { supplement: 'Omega-3 fatty acids (EPA+DHA)', evidence: 'Reduces triglycerides, inflammation markers, free androgen index in PCOS', grade: 'B' },
      { supplement: 'Vitamin D', evidence: 'Benefits when deficient — mixed results in replete individuals', grade: 'B' },
      { supplement: 'Magnesium', evidence: 'May improve insulin sensitivity and psychological symptoms; further research needed', grade: 'C' },
      { supplement: 'Berberine', evidence: 'Emerging — improves glycaemic markers but not yet recognised in clinical guidelines', grade: 'C' },
    ],
    exercise_interaction: 'Resistance training is particularly effective for PCOS — improves insulin sensitivity, reduces androgen levels, and improves body composition more than aerobic exercise alone. Combine both. Target 150+ minutes per week.',
    myths_busted: [
      'You must avoid all carbohydrates — false. Carbohydrate quality matters more than quantity. Low-GI carbs are beneficial.',
      'Intermittent fasting is good for PCOS — not supported and potentially harmful due to blood sugar instability risk. Evenly spaced meals are better.',
      'PCOS only affects overweight women — false. Lean PCOS exists; insulin resistance occurs regardless of BMI.',
      'Soy is harmful for PCOS due to phytoestrogens — evidence does not support this concern at normal dietary intake levels.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'logging_sugary_drink', message: 'Sugar-sweetened beverages spike insulin rapidly and can worsen PCOS symptoms. Try water, herbal tea, or sparkling water.' },
      { type: 'info', trigger: 'low_fibre_day', message: 'Your fibre intake is below 20g today. Women with PCOS often consume too little fibre — it significantly improves insulin sensitivity.' },
      { type: 'info', trigger: 'condition_selected', message: 'For PCOS: focus on low-GI carbs, plenty of fibre, and consistent meal timing every 3–4 hours. Avoid meal-skipping.' },
    ],
    medical_disclaimer: 'PCOS is a complex hormonal condition. Dietary changes can significantly improve symptoms but are not a replacement for medical management. Consult your doctor about insulin sensitisers (e.g. metformin) if dietary approaches alone are insufficient.',
    sources: ['Zhang et al. Front Nutr 2025 meta-analysis n=327', 'Scannell et al. Proc Nutr Soc 2025', 'Frontiers Nutr 2025 umbrella meta-analysis n=30,133', 'Johns Hopkins Medicine PCOS Diet', 'Muhammed Saeed J Health Popul Nutr 2025'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CELIAC — Coeliac Disease / Gluten Intolerance
  // ═══════════════════════════════════════════════════════════════════════════
  celiac: {
    id: 'celiac',
    name: 'Celiac',
    display_name: 'Coeliac Disease / Gluten Intolerance',
    prevalence: 'Coeliac disease ~1% of population; non-coeliac gluten sensitivity is more common but harder to quantify',
    mechanism: 'In coeliac disease, gluten triggers an autoimmune response that damages intestinal villi, impairing nutrient absorption. Even trace amounts of gluten cause mucosal inflammation. This directly impacts energy availability, micronutrient absorption, muscle synthesis, and recovery — especially relevant for athletes.',
    first_line: 'Strict lifelong gluten-free diet (GFD) is the ONLY evidence-based treatment for coeliac disease. Not optional, not partial — complete gluten elimination is required for mucosal healing and symptom resolution (Ghunaim et al. Cureus 2024). GFD for non-coeliac athletes shows NO performance benefit (Zdzieblik et al. Front Sports 2025) — do not promote GFD without diagnosis.',
    key_protocols: [
      'Eliminate all wheat, barley, rye, and triticale completely',
      'Oats: only certified gluten-free oats (regular oats are heavily cross-contaminated)',
      'Read every label — gluten hides in sauces, soups, marinades, medication coatings',
      'Address nutritional deficiencies — GFD products are nutritionally inferior to gluten-containing equivalents',
      'Focus on naturally gluten-free whole foods rather than processed GF substitutes',
      'Athlete with coeliac: higher risk of fatigue, injury, poor recovery if poorly managed',
    ],
    foods_emphasise: [
      { food: 'Naturally GF grains and pseudocereals', examples: 'Rice, quinoa, buckwheat, millet, teff, amaranth, sorghum', reason: 'Provide carbohydrate and protein without gluten; nutritionally superior to processed GF products' },
      { food: 'Certified GF oats', examples: 'Rolled oats labelled gluten-free', reason: 'Oats are tolerated by most coeliac patients if certified GF; good fibre source' },
      { food: 'Naturally GF proteins', examples: 'Eggs, meat, fish, poultry, legumes, tofu', reason: 'Gluten-free by nature; critical for muscle protein synthesis' },
      { food: 'Potatoes and root vegetables', examples: 'Potato, sweet potato, cassava, yam', reason: 'Excellent naturally GF carbohydrate sources' },
      { food: 'Legumes', examples: 'Lentils, chickpeas, black beans', reason: 'Provide protein and fibre often lacking in GFD' },
      { food: 'Dairy and fortified alternatives', examples: 'Milk, yogurt, cheese, fortified plant milks', reason: 'Calcium and vitamin D — critical nutrients often deficient in coeliac' },
      { food: 'Iron-rich foods', examples: 'Red meat, liver (occasionally), dark leafy greens, fortified GF cereals', reason: 'Iron deficiency/anaemia is the most common coeliac complication in athletes' },
    ],
    foods_limit: [
      { food: 'Processed GF substitute products', reason: 'GF bread, pasta, baked goods have higher GI, more saturated fat, lower protein, fibre, and micronutrients vs gluten-containing equivalents', serving_guide: 'Occasional use acceptable; whole-food alternatives preferred for athletes' },
      { food: 'Alcohol (beer especially)', reason: 'Most beer contains gluten from barley — acute gut damage; choose GF alternatives', serving_guide: 'GF beer, wine, spirits distilled from GF sources are safe' },
    ],
    foods_avoid: [
      { food: 'Wheat (all forms)', reason: 'Absolute contraindication. Includes spelt, kamut, semolina, durum, farro, freekeh, wheatgerm', examples: 'Bread, pasta, crackers, most cereals, couscous, bulgur' },
      { food: 'Barley', reason: 'Contains hordein (gluten protein)', examples: 'Barley water, most beer, malt vinegar, some whiskeys' },
      { food: 'Rye', reason: 'Contains secalin (gluten protein)', examples: 'Rye bread, some crispbreads' },
      { food: 'Cross-contaminated products', reason: 'Even trace contamination causes gut damage in coeliac disease', examples: 'Regular oats, chips cooked in shared oil, shared kitchen equipment, bulk-bin grains' },
    ],
    nutrients_watch: [
      { nutrient: 'Iron', risk: 'Most common deficiency in coeliac — anaemia causes fatigue and impaired performance', action: 'Check ferritin levels; prioritise iron-rich foods; supplement if deficient (with doctor guidance)' },
      { nutrient: 'Calcium', risk: 'Impaired absorption from damaged villi; critical for bone health', action: 'Dairy products (GF), fortified plant milks, sardines with bones, white beans; target 1000–1200mg/day' },
      { nutrient: 'Vitamin D', risk: 'Malabsorption common; deficiency worsens bone density and immune function', action: 'Test serum 25-OH-D; supplement to maintain >50 nmol/L; sun exposure' },
      { nutrient: 'B vitamins (B1, B2, B3, B6, B9, B12)', risk: 'GFD typically lower in B vitamins than gluten-containing diet; absorption impaired by damaged villi', action: 'Prioritise naturally GF whole grains (quinoa, teff); consider B-complex supplement initially' },
      { nutrient: 'Zinc', risk: 'Deficiency common; impairs immune function, wound healing, and testosterone in athletes', action: 'Red meat, pumpkin seeds, oysters (GF), legumes' },
      { nutrient: 'Magnesium', risk: 'Deficiency common in coeliac', action: 'Dark chocolate, nuts, seeds, leafy greens — all naturally GF' },
      { nutrient: 'Fibre', risk: 'GFD typically low in fibre vs standard diet', action: 'Prioritise vegetables, legumes, naturally GF whole grains, psyllium' },
    ],
    supplement_evidence: [
      { supplement: 'Probiotics (multi-strain)', evidence: 'Promising — reduces GI symptoms, partially restores microbiota diversity. Bifidobacterium + Lactobacillus combination studied (Laterza et al. 2025)', grade: 'B' },
      { supplement: 'Iron', evidence: 'Essential when deficient — correct under medical supervision; excess iron is harmful', grade: 'A (when deficient)' },
      { supplement: 'Vitamin D', evidence: 'Essential when deficient — which is common in coeliac', grade: 'A (when deficient)' },
    ],
    exercise_interaction: 'Athletes with poorly managed coeliac disease have decreased physical capacity, recurrent fatigue, and higher injury risk. Once strict GFD is established and deficiencies corrected, athletic performance normalises. Monitor iron and vitamin D closely around training blocks.',
    myths_busted: [
      'Gluten-free diet improves athletic performance in non-coeliac athletes — false. Zdzieblik et al. 2025 RCT: GFD shows no performance benefit without coeliac diagnosis, and may cause nutritional deficiencies.',
      'A little gluten occasionally is fine for coeliac disease — false. Trace amounts cause ongoing mucosal damage even without symptoms.',
      'GF products are healthier than regular products — false. Processed GF products are nutritionally inferior to their gluten-containing equivalents.',
    ],
    app_alerts: [
      { type: 'critical', trigger: 'logging_gluten_ingredient', message: 'This ingredient contains gluten and is not safe for coeliac disease. Choose a gluten-free alternative.' },
      { type: 'warning', trigger: 'low_iron', message: 'Iron is the most common deficiency in coeliac disease and the leading cause of fatigue in athletes. Check your ferritin levels.' },
      { type: 'info', trigger: 'logging_regular_oats', message: 'Regular oats are often cross-contaminated with gluten. Only certified gluten-free oats are safe for coeliac disease.' },
    ],
    medical_disclaimer: 'Coeliac disease requires a formal medical diagnosis before starting a GFD. Beginning GFD before testing makes diagnosis impossible. If you suspect coeliac disease, see your doctor BEFORE changing your diet.',
    sources: ['Boatta et al. Curr Res Food Sci 2026', 'Ghunaim et al. Cureus 2024', 'Zdzieblik et al. Front Sports 2025', 'Laterza et al. 2025 (probiotics)'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LACTOSE — Lactose Intolerance
  // ═══════════════════════════════════════════════════════════════════════════
  lactose: {
    id: 'lactose',
    name: 'Lactose Intolerance',
    display_name: 'Lactose Intolerance',
    prevalence: '~70% of adults globally have reduced lactase expression; symptoms vary widely by ethnicity and dose',
    mechanism: 'Reduced lactase enzyme production means lactose (milk sugar) reaches the colon undigested, where gut bacteria ferment it producing gas, bloating, and osmotic diarrhoea. Unlike coeliac disease, lactose does not cause gut damage — it only causes symptoms. Most people can tolerate moderate amounts.',
    first_line: 'Most lactose-intolerant individuals can tolerate 12g lactose in a single dose (1 cup low-fat milk) with food, with minimal symptoms. Complete dairy elimination is NOT recommended as it creates unnecessary nutritional risk. Lactose-free dairy retains identical nutrient content. Yogurt is well tolerated due to bacterial lactase.',
    key_protocols: [
      'Do NOT eliminate all dairy without objective diagnosis — self-reported lactose intolerance is frequently inaccurate',
      'Spread dairy intake throughout the day in small portions rather than large single servings',
      'Consume dairy with food — slows transit, reduces symptoms',
      'Hard cheeses (cheddar, parmesan, Swiss) contain minimal lactose — usually well tolerated',
      'Yogurt bacteria produce beta-galactosidase — most lactose-intolerant people tolerate yogurt well',
      'Lactase enzyme supplements available — take just before eating dairy',
      'If avoiding dairy: ensure calcium and vitamin D from alternative sources',
    ],
    foods_emphasise: [
      { food: 'Lactose-free dairy', examples: 'Lactose-free milk, Lactofree cheese', reason: 'Same calcium and protein as regular dairy, without the lactose' },
      { food: 'Hard cheeses', examples: 'Cheddar, parmesan, Swiss, Gruyere, pecorino', reason: 'Very low lactose content; generally well tolerated' },
      { food: 'Yogurt with live cultures', examples: 'Greek yogurt, natural yogurt', reason: 'Live bacteria partially digest lactose — most LI people tolerate well' },
      { food: 'Non-dairy calcium sources', examples: 'Fortified soy milk, fortified oat milk, canned sardines/salmon with bones, white beans (191mg/cup), almonds, broccoli', reason: 'Maintains calcium intake without dairy' },
      { food: 'Fortified plant milks', examples: 'Fortified soy milk (best nutritional profile among plant milks), fortified oat milk', reason: 'Calcium and vitamin D fortified; soy milk has comparable protein to dairy' },
      { food: 'Leafy greens (certain)', examples: 'Bok choy, kale, broccoli, Chinese cabbage', reason: 'Absorbable calcium; note spinach and chard are high in oxalate which limits calcium absorption' },
    ],
    foods_limit: [
      { food: 'Large portions of regular milk', reason: 'Highest lactose content — symptoms dose-dependent', serving_guide: 'Max 1 cup (12g lactose) in single sitting with food; spread throughout day' },
      { food: 'Ice cream and soft cheeses', reason: 'Moderate-high lactose', serving_guide: 'Small portions; combine with other foods' },
      { food: 'Whey protein supplements', reason: 'May contain significant lactose — check label for lactose content', serving_guide: 'Choose lactose-free or plant-based protein if symptomatic' },
    ],
    foods_avoid: [
      { food: 'Avoiding all dairy without trying alternatives first', reason: 'Unnecessary nutritional risk. Lactose-free dairy, hard cheese, and yogurt are usually well tolerated and prevent calcium deficiency' },
    ],
    nutrients_watch: [
      { nutrient: 'Calcium', risk: 'Primary risk of avoiding dairy — insufficient calcium leads to low bone mineral density and osteoporosis risk', action: 'Target 1000–1200mg/day from lactose-free dairy, fortified alternatives, or supplements; dairy contributes 72% of calcium in typical Western diet' },
      { nutrient: 'Vitamin D', risk: 'Most dietary vitamin D comes from fortified milk; many adults already inadequate', action: 'Choose vitamin D-fortified foods; supplement 1000–2000 IU if not getting adequate sun exposure' },
      { nutrient: 'Protein', risk: 'Dairy is a high-quality protein source; removing it reduces total protein and key amino acids', action: 'Replace with other complete protein sources — eggs, meat, fish, soy, legumes' },
      { nutrient: 'Riboflavin (B2)', risk: 'Dairy is a major dietary source; GFD already lowers B vitamin intake', action: 'Eggs, meat, fortified plant milks provide riboflavin' },
      { nutrient: 'Phosphorus and magnesium', risk: 'Also present in dairy at meaningful levels', action: 'Nuts, seeds, legumes, whole grains provide phosphorus and magnesium' },
    ],
    supplement_evidence: [
      { supplement: 'Lactase enzyme supplements', evidence: 'Effective for symptom management — take just before consuming dairy', grade: 'A' },
      { supplement: 'Probiotics (Lactobacillus acidophilus DDS-1)', evidence: 'May reduce lactose intolerance symptoms', grade: 'B' },
      { supplement: 'Calcium (if dietary inadequate)', evidence: 'Essential when dairy is significantly restricted', grade: 'A (when deficient)' },
      { supplement: 'Vitamin D', evidence: 'Essential when dietary sources are inadequate', grade: 'A (when deficient)' },
    ],
    exercise_interaction: 'Dairy provides high-quality protein (whey and casein) valuable for muscle protein synthesis and recovery. If avoiding dairy, ensure adequate protein from alternative sources. Calcium is important for bone health — stress fracture risk increases with deficiency in athletes.',
    myths_busted: [
      'All dairy must be avoided — false. Most people can tolerate 12g lactose per serving (1 cup milk) with meals. Hard cheese and yogurt are usually well tolerated.',
      'Plant milks are nutritionally equivalent to dairy milk — false. Only fortified soy milk has comparable protein. Most plant milks are nutritionally inferior without fortification.',
      'Lactose intolerance causes permanent gut damage like coeliac disease — false. Lactose intolerance causes reversible symptoms only, not intestinal damage.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'low_calcium', message: 'Your calcium intake is low today. Calcium deficiency is the main nutritional risk of avoiding dairy. Try lactose-free milk, hard cheese, or fortified soy milk.' },
      { type: 'info', trigger: 'logging_yogurt', message: 'Yogurt contains live bacteria that help digest lactose — most people with lactose intolerance can eat yogurt without symptoms.' },
    ],
    medical_disclaimer: 'Self-diagnosed lactose intolerance is often incorrect. Symptoms may have other causes (IBS, celiac disease, SIBO). Objective diagnosis before significantly restricting dairy is recommended.',
    sources: ['StatPearls Lactose Intolerance 2024', 'PMC Nutritional management of LI (PMC7318541)', 'NIH Calcium Fact Sheet 2024', 'MDPI Lactose Intolerance Bone Health'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. HYPOTHYROIDISM — Hypothyroidism / Hashimoto's Thyroiditis
  // ═══════════════════════════════════════════════════════════════════════════
  hypothyroidism: {
    id: 'hypothyroidism',
    name: 'Hypothyroidism',
    display_name: 'Hypothyroidism / Hashimoto\'s Thyroiditis',
    prevalence: 'Hypothyroidism ~5% of adults; Hashimoto\'s is the most common autoimmune disease and leading cause of hypothyroidism',
    mechanism: 'Thyroid hormones regulate metabolism, energy production, cardiovascular function, and body composition. Iodine, selenium, iron, and zinc are essential for thyroid hormone synthesis and activation. Nutrition directly modulates thyroid autoantibody levels and thyroid function through the diet-gut-thyroid axis.',
    first_line: 'Mediterranean diet is the best-studied dietary pattern for Hashimoto\'s — reduces thyroid autoantibodies, supports thyroid function, and lowers cardiovascular risk (PMC12372124, 2025). Focus on micronutrient adequacy: iodine, selenium, iron, zinc, vitamins D, B12, and A.',
    key_protocols: [
      'Do not take levothyroxine with food — take on empty stomach, 30–60 minutes before eating',
      'Take calcium or iron supplements 4+ hours AFTER levothyroxine — they impair absorption',
      'Ensure adequate (not excessive) iodine — both deficiency AND excess cause thyroid dysfunction',
      'Selenium supplementation reduces TPO antibodies in Hashimoto\'s — most studied supplement',
      'Cruciferous vegetables are NOT a significant concern at normal dietary intake — only raw in very large quantities with iodine deficiency',
      'Soy may mildly interfere with levothyroxine absorption — take medication at least 4 hours before soy-heavy meals',
      'Gluten restriction only beneficial if patient has concurrent coeliac or confirmed NCGS',
    ],
    foods_emphasise: [
      { food: 'Selenium-rich foods', examples: 'Brazil nuts (1–2/day = adequate selenium), tuna, sardines, eggs, sunflower seeds, chicken', reason: 'Selenium reduces TPO antibodies in Hashimoto\'s; supports T4 to T3 conversion' },
      { food: 'Iodine-containing foods', examples: 'Seafood, seaweed (moderate amounts), dairy, eggs, iodised salt', reason: 'Iodine is essential for thyroid hormone synthesis — both deficiency and excess are harmful' },
      { food: 'Iron-rich foods', examples: 'Red meat, liver (occasional), dark leafy greens, legumes, fortified cereals', reason: 'Iron deficiency impairs thyroid hormone production; anaemia mimics hypothyroid fatigue' },
      { food: 'Zinc-rich foods', examples: 'Oysters, beef, pumpkin seeds, chickpeas, cashews', reason: 'Zinc is required for thyroid hormone synthesis and conversion' },
      { food: 'Vitamin D sources', examples: 'Fatty fish, egg yolks, fortified foods; sunshine', reason: 'Vitamin D deficiency is common in Hashimoto\'s; linked to higher autoantibody levels' },
      { food: 'Vitamin B12 sources', examples: 'Meat, fish, dairy, eggs; supplement for vegetarians/vegans', reason: 'B12 deficiency commonly coexists with Hashimoto\'s due to associated autoimmune gastritis' },
      { food: 'Anti-inflammatory foods', examples: 'Olive oil, fatty fish, berries, leafy greens, nuts', reason: 'Mediterranean pattern reduces thyroid autoantibodies and cardiovascular risk' },
    ],
    foods_limit: [
      { food: 'Excessive iodine supplements', reason: 'Excess iodine worsens autoimmune thyroiditis and can trigger hypothyroidism — do not supplement without testing', serving_guide: 'Get iodine from food, not high-dose supplements' },
      { food: 'Raw cruciferous vegetables in very large amounts', reason: 'Goitrogens can theoretically impair iodine uptake, but only relevant with iodine deficiency and very high intake', serving_guide: 'Normal dietary amounts are safe and healthy. Cooking reduces goitrogen activity.' },
      { food: 'Soy foods around medication time', reason: 'Soy may mildly reduce levothyroxine absorption', serving_guide: 'Fine to eat soy at other times — just not within 4 hours of medication' },
      { food: 'Coffee around medication time', reason: 'Coffee reduces levothyroxine absorption', serving_guide: 'Wait 60 minutes after medication before coffee' },
    ],
    foods_avoid: [
      { food: 'Taking levothyroxine with food, calcium, iron, or coffee', reason: 'Critical drug-nutrient interaction — impairs medication effectiveness and leads to undertreated hypothyroidism' },
    ],
    nutrients_watch: [
      { nutrient: 'Selenium', risk: 'Deficiency worsens Hashimoto\'s; excess is toxic', action: 'Food-first (1–2 Brazil nuts/day); supplementation 100–200mcg/day studied in Hashimoto\'s — confirm with doctor' },
      { nutrient: 'Iodine', risk: 'Both deficiency (impairs synthesis) and excess (triggers autoimmunity) are problematic', action: 'Ensure adequacy from food; avoid high-dose iodine supplements' },
      { nutrient: 'Iron', risk: 'Deficiency impairs thyroid hormone synthesis — creates fatigue that mirrors hypothyroid symptoms', action: 'Check serum ferritin; correct deficiency before assuming symptoms are thyroid-related' },
      { nutrient: 'Vitamin D', risk: 'Deficiency common in Hashimoto\'s; linked to higher antibody levels', action: 'Test serum 25-OH-D; supplement to maintain 50–100 nmol/L' },
      { nutrient: 'Vitamin B12', risk: 'Common autoimmune gastritis in Hashimoto\'s patients reduces B12 absorption', action: 'Test serum B12; supplement if deficient — injection may be needed with pernicious anaemia' },
      { nutrient: 'Magnesium', risk: 'Deficiency associated with thyroid dysfunction and cardiovascular risk', action: 'Dark chocolate, nuts, legumes, leafy greens' },
    ],
    supplement_evidence: [
      { supplement: 'Selenium (selenomethionine)', evidence: 'Best evidence for Hashimoto\'s — reduces TPO antibodies in multiple RCTs. Dose: 100–200mcg/day. Discuss with doctor.', grade: 'B' },
      { supplement: 'Vitamin D', evidence: 'Benefits when deficient (common in Hashimoto\'s)', grade: 'B' },
      { supplement: 'Iron', evidence: 'Essential when deficient', grade: 'A (when deficient)' },
      { supplement: 'Zinc', evidence: 'Supports thyroid hormone synthesis and conversion; deficiency common', grade: 'B' },
    ],
    exercise_interaction: 'Exercise improves metabolism, body composition, and mood — all often impaired in hypothyroidism. Resistance training helps counteract the muscle loss and metabolic slowdown associated with undertreated hypothyroidism. Ensure thyroid is adequately treated (TSH in range) before expecting normal training adaptations.',
    myths_busted: [
      'Cruciferous vegetables cause hypothyroidism — false at normal dietary intake. Only problematic in very large raw quantities combined with iodine deficiency.',
      'Gluten causes Hashimoto\'s — no direct evidence unless the patient has concurrent coeliac disease. Routine gluten elimination without diagnosis is not supported.',
      'Iodine supplements help hypothyroidism — false and potentially harmful. Excess iodine worsens Hashimoto\'s. Food sources are adequate.',
      'You cannot exercise with hypothyroidism — false. Exercise is beneficial. If poorly tolerated, the thyroid medication dose likely needs adjustment.',
    ],
    app_alerts: [
      { type: 'critical', trigger: 'condition_selected', message: 'Important: Take levothyroxine on an empty stomach, 30–60 min before eating. Take calcium or iron supplements at least 4 hours after medication.' },
      { type: 'warning', trigger: 'logging_calcium_or_iron_supplement', message: 'If you take levothyroxine, take calcium and iron supplements at least 4 hours after your medication to prevent absorption interference.' },
      { type: 'info', trigger: 'logging_coffee', message: 'Coffee can reduce levothyroxine absorption. Wait at least 60 minutes after taking medication before your first coffee.' },
    ],
    medical_disclaimer: 'Hypothyroidism requires medical management with levothyroxine or other medications. Dietary changes support thyroid health but do not replace medication. Never adjust medication dose without your doctor\'s guidance.',
    sources: ['Nutrients 2024 PMC11314468', 'PMC 2025 PMC12372124', 'PubMed 35952387 Thyroid Diet Alternative', 'PMC9223845 Hashimoto microelements'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. DIABETES T2 — Type 2 Diabetes Mellitus
  // ═══════════════════════════════════════════════════════════════════════════
  diabetes_t2: {
    id: 'diabetes_t2',
    name: 'Type 2 Diabetes',
    display_name: 'Type 2 Diabetes (T2D)',
    prevalence: 'Affects >537 million adults globally; projected 1.3 billion by 2050',
    mechanism: 'T2D involves insulin resistance and progressive beta-cell dysfunction, leading to hyperglycaemia. Postprandial glucose excursions drive HbA1c elevation and long-term complications. Diet is the primary lever: carbohydrate type and quality, meal timing, and fibre intake directly determine postprandial glucose response.',
    first_line: 'No single superior diet — Mediterranean, DASH, low-carbohydrate, and low-GI all demonstrate benefit in ADA Standards 2024 & 2025. Focus on high-quality, minimally processed, high-fibre carbohydrates. Low-carbohydrate diets (<130g/day) improve glycaemic control and may induce T2D remission in some patients. Carbohydrate CONSISTENCY matters for insulin users.',
    key_protocols: [
      'Fibre target: minimum 14g per 1000 kcal consumed — most T2D patients fall far short',
      'Carbohydrate consistency: similar timing and amounts per meal if on fixed insulin — erratic carb intake causes glucose swings',
      'Prioritise low-GI carbohydrates over low-carbohydrate if calorie restriction is not desired',
      'Post-meal walking (even 10–15 minutes) significantly reduces postprandial glucose — recommend after every meal',
      'Eliminate sugar-sweetened beverages — highest GI, most rapidly worsen glycaemic control',
      'Resistance training improves glycaemic control more than aerobic exercise alone (ADA 2025)',
      'Weight loss of 5–10% significantly improves insulin sensitivity and HbA1c',
    ],
    foods_emphasise: [
      { food: 'Non-starchy vegetables', examples: 'All leafy greens, broccoli, cauliflower, capsicum, cucumber, zucchini, mushrooms', reason: 'Low GI, high fibre, negligible glucose impact — eat freely at most meals' },
      { food: 'Legumes', examples: 'Lentils, chickpeas, black beans, kidney beans, edamame', reason: 'Lowest GI carbohydrates; high protein and fibre; significantly improve postprandial glucose' },
      { food: 'Whole grains', examples: 'Oats (steel-cut or rolled), barley, quinoa, whole wheat bread, brown rice', reason: 'Lower GI than refined; more fibre and protein; reduce insulin spikes vs refined equivalents' },
      { food: 'Nuts and seeds', examples: 'Almonds, walnuts, chia seeds, flaxseeds, sunflower seeds', reason: 'High healthy fats, protein, fibre; low GI; improve lipid profile' },
      { food: 'Fatty fish', examples: 'Salmon, sardines, mackerel, trout', reason: 'Anti-inflammatory omega-3; does not spike glucose; replaces higher-GI foods' },
      { food: 'Whole fruits', examples: 'Berries (best), apples, pears, oranges — fibre slows glucose absorption', reason: 'Choose over juice; berries have lowest GI of common fruits' },
      { food: 'Vinegar and fermented foods', examples: 'Apple cider vinegar, yogurt, kimchi, pickles', reason: 'Acetic acid reduces postprandial glucose — small but consistent effect' },
    ],
    foods_limit: [
      { food: 'Refined carbohydrates', reason: 'High GI — cause rapid postprandial glucose spikes', examples: 'White bread, white rice, regular pasta, most cereals, crackers, pretzels' },
      { food: 'Starchy vegetables in large portions', reason: 'Moderate GI; portion-size matters significantly', examples: 'White potato (high GI), corn — reduce portion size; prefer sweet potato' },
      { food: 'Fruit juice', reason: 'No fibre, concentrated fructose — GI similar to sugar water despite being "natural"', serving_guide: 'Whole fruit only; juice eliminated or very small portion with meal' },
      { food: 'Saturated fat sources', reason: 'Worsen insulin resistance; increase cardiovascular risk (already elevated in T2D)', examples: 'Fatty red meat, full-fat dairy, butter in excess, coconut oil' },
      { food: 'Alcohol', reason: 'Risk of hypoglycaemia especially on insulin/sulfonylureas; empty calories; disrupts glucose control', serving_guide: 'If consumed: with food, moderate amounts, monitor glucose closely' },
    ],
    foods_avoid: [
      { food: 'Sugar-sweetened beverages', reason: 'Fastest route to worsening glycaemic control — liquid sugar bypasses satiety, spikes glucose and insulin rapidly', examples: 'Soda, juice, energy drinks, sweet tea, flavoured coffees' },
      { food: 'Ultra-processed foods', reason: 'High GI, low fibre, low nutrient density — directly worsen insulin resistance and displace healthier options', examples: 'Fast food, packaged snack foods, instant noodles, most breakfast cereals' },
    ],
    nutrients_watch: [
      { nutrient: 'Fibre', risk: 'Most T2D patients severely under-consume — typical intake is ~16g vs 14g/1000kcal minimum', action: 'Prioritise legumes, vegetables, oats, chia seeds; consider psyllium husk supplement' },
      { nutrient: 'Magnesium', risk: 'Deficiency common in T2D; impairs insulin signalling', action: 'Leafy greens, nuts, seeds, legumes, dark chocolate' },
      { nutrient: 'Vitamin B12', risk: 'Metformin depletes B12 over time — B12 deficiency mimics diabetic neuropathy', action: 'Test B12 annually if on metformin; supplement if deficient' },
      { nutrient: 'Vitamin D', risk: 'Deficiency associated with insulin resistance and T2D risk', action: 'Test and supplement if deficient; fatty fish, eggs, fortified foods, sun exposure' },
      { nutrient: 'Protein', risk: 'Adequate protein (1.0–1.5g/kg/day) blunts postprandial glucose and preserves muscle', action: 'Include protein at every meal; helps slow gastric emptying and reduce glucose excursions' },
    ],
    supplement_evidence: [
      { supplement: 'Magnesium', evidence: 'May improve insulin sensitivity when deficient; common deficiency in T2D', grade: 'B' },
      { supplement: 'Vitamin D', evidence: 'Benefits when deficient; mixed evidence in replete individuals', grade: 'B (when deficient)' },
      { supplement: 'Berberine', evidence: 'Glucose-lowering effect comparable to metformin in small RCTs; growing evidence base', grade: 'B' },
      { supplement: 'Vitamin B12', evidence: 'Essential if on metformin long-term — supplement to prevent deficiency', grade: 'A (for metformin users)' },
    ],
    exercise_interaction: 'Exercise is a first-line treatment for T2D. Post-meal walks of even 10–15 minutes significantly reduce postprandial glucose. Resistance training is specifically highlighted by ADA for glycaemic benefits. For insulin users: monitor glucose before and after exercise; carbohydrate needs vary. Hypoglycaemia risk during exercise if on certain medications.',
    myths_busted: [
      'All carbohydrates are equally bad — false. Legumes and oats have dramatically lower GI than white bread; quality matters enormously.',
      'People with diabetes cannot eat fruit — false. Whole fruit with fibre is beneficial. Fruit JUICE is the problem.',
      'Artificial sweeteners are freely safe for T2D — evidence is mixed; some may still stimulate insulin response. Prefer whole-food solutions.',
      'Low-carb diet is the only approach — false. Mediterranean, DASH, and low-GI diets also show significant benefit. The best diet is one the patient will maintain long-term.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'logging_sugary_drink', message: 'Sugar-sweetened drinks cause rapid glucose spikes and are the single most important thing to eliminate for blood sugar control.' },
      { type: 'info', trigger: 'training_logged', message: 'A 10–15 minute walk after your meal significantly reduces post-meal blood sugar. Try to move after eating.' },
      { type: 'warning', trigger: 'low_fibre', message: 'Your fibre intake is low today. Fibre is the most powerful dietary tool for blood sugar control — target at least 14g per 1000 calories.' },
      { type: 'info', trigger: 'metformin_noted', message: 'Long-term metformin use depletes vitamin B12. Have your B12 levels checked annually and consider supplementation.' },
    ],
    medical_disclaimer: 'T2D management should be supervised by a healthcare provider. Dietary changes that significantly reduce blood glucose may require medication adjustments (especially insulin). Never change medication without medical guidance.',
    sources: ['ADA Standards of Care 2024 & 2025', 'Frontiers Nutr glycaemic index meta-analysis 2025', 'PMC T2D low-carb systematic review 2025', 'PMC12476234'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. IBD — Inflammatory Bowel Disease (Crohn's & Ulcerative Colitis)
  // ═══════════════════════════════════════════════════════════════════════════
  ibd: {
    id: 'ibd',
    name: 'IBD',
    display_name: 'Inflammatory Bowel Disease (Crohn\'s / Ulcerative Colitis)',
    prevalence: 'Affects ~10 million people worldwide; incidence rising globally',
    mechanism: 'IBD involves dysregulated immune responses in the gut, causing chronic inflammation and mucosal damage. Malnutrition affects up to 75% of Crohn\'s patients and 25% of UC patients due to reduced intake, malabsorption, increased losses, and altered metabolism. Diet modulates gut microbiota, intestinal inflammation, and mucosal healing.',
    first_line: 'Mediterranean diet for all patients in remission (AGA 2024 — strong recommendation). No single diet consistently reduces flare rates in adults. During active disease: low-residue, softer-textured foods. Low red and processed meat may reduce UC flares. Plant-based, high-fibre, low animal protein diets show consistent benefit for UC.',
    key_protocols: [
      'REMISSION: Mediterranean diet — diverse fruits, vegetables, whole grains, lean proteins, olive oil, low ultra-processed foods',
      'ACTIVE FLARE: Low-residue diet — soft, low-fibre foods to reduce bowel irritation; well-cooked vegetables, white rice, eggs, fish',
      'Stricturing Crohn\'s: Blend, cook, and puree plant foods rather than avoiding them entirely — fibre still important for wound healing',
      'Screen and correct micronutrient deficiencies proactively — particularly iron, vitamin D, B12',
      'Avoid ultra-processed foods and excessive red/processed meat — consistent association with IBD flares',
      'Adequate protein (1.2–1.5g/kg) is important for mucosal healing and muscle preservation',
    ],
    foods_emphasise: [
      { food: 'Cooked fruits and vegetables (remission)', examples: 'Well-cooked carrots, zucchini, peeled potatoes, ripe banana, canned peaches', reason: 'Fibre and nutrients without harsh texture during transition from flare' },
      { food: 'Oily fish', examples: 'Salmon, sardines, mackerel, trout', reason: 'Anti-inflammatory omega-3; reduces bowel inflammation markers' },
      { food: 'Lean proteins', examples: 'Chicken, fish, eggs, tofu, smooth nut butters', reason: 'Essential for mucosal repair and muscle maintenance; easy to digest' },
      { food: 'Low-fibre grains during flares', examples: 'White rice, refined pasta, white bread, cream of wheat', reason: 'Low residue during active disease reduces bowel irritation' },
      { food: 'Probiotic-rich foods', examples: 'Yogurt with live cultures, kefir (if tolerated)', reason: 'Support gut microbiota; generally well tolerated in IBD' },
      { food: 'Olive oil', examples: 'Extra-virgin olive oil as primary fat', reason: 'Mediterranean diet foundation; anti-inflammatory polyphenols' },
    ],
    foods_limit: [
      { food: 'Red and processed meat', reason: 'Consistently associated with UC flare risk in observational studies; high sulphide production in colon drives colonic inflammation', serving_guide: 'Lean red meat occasionally; processed meat (bacon, sausage, deli meat) to minimise' },
      { food: 'Raw high-fibre foods during flares', reason: 'Increases bowel residue and may worsen symptoms during active disease', serving_guide: 'Cook and puree; return to raw as tolerated during remission' },
      { food: 'Spicy foods', reason: 'May irritate already-inflamed mucosa during flares — individual variation', serving_guide: 'Re-introduce during remission to test tolerance' },
      { food: 'Fatty/fried foods', reason: 'Impair fat absorption (especially in Crohn\'s affecting small intestine); worsen diarrhoea', serving_guide: 'Low-fat cooking methods preferred' },
      { food: 'Alcohol', reason: 'Gut irritant; alters microbiota; may trigger flares', serving_guide: 'Avoid during flares; limit during remission' },
      { food: 'Ultra-processed foods', reason: 'Consistently associated with IBD development and worsening; emulsifiers may disrupt gut barrier', examples: 'Fast food, packaged snack foods, processed meats, margarine' },
    ],
    foods_avoid: [
      { food: 'Foods with intestinal obstruction risk (stricturing Crohn\'s)', reason: 'Raw fibrous vegetables, seeds, popcorn, whole nuts can cause obstruction in strictured bowel', serving_guide: 'Cook all plant foods to soft; avoid seeds, skins, hulls; puree high-fibre foods' },
    ],
    nutrients_watch: [
      { nutrient: 'Iron', risk: 'Chronic blood loss (especially UC), malabsorption, and restricted intake create iron deficiency — most common deficiency in IBD', action: 'Check ferritin and haemoglobin regularly; IV iron preferred if severe; oral iron often poorly tolerated' },
      { nutrient: 'Vitamin D', risk: 'Deficiency extremely common in IBD; linked to disease activity and worse outcomes', action: 'Test serum 25-OH-D; supplement to maintain >50 nmol/L; 1000–2000 IU/day minimum' },
      { nutrient: 'Vitamin B12', risk: 'Terminal ileum (Crohn\'s) is site of B12 absorption; resection or inflammation impairs absorption significantly', action: 'Monitor B12 levels; B12 injection may be required if terminal ileum affected' },
      { nutrient: 'Zinc', risk: 'Increased intestinal losses; deficiency impairs wound healing and mucosal repair', action: 'Meat, pumpkin seeds, chickpeas, cashews — supplement if deficient' },
      { nutrient: 'Calcium', risk: 'Corticosteroid use depletes bone mineral density; malabsorption; reduced dairy intake', action: 'Target 1000–1200mg/day; vitamin D essential for absorption' },
      { nutrient: 'Folate (B9)', risk: 'Methotrexate (used in Crohn\'s) depletes folate; malabsorption', action: 'Folic acid supplementation if on methotrexate; green vegetables, legumes' },
      { nutrient: 'Protein', risk: 'Increased requirements due to inflammation, mucosal healing, and potential malabsorption', action: 'Target 1.2–1.5g/kg/day; high-quality lean proteins at every meal' },
    ],
    supplement_evidence: [
      { supplement: 'Vitamin D', evidence: 'Deficiency linked to worse IBD outcomes; supplement to correct', grade: 'B' },
      { supplement: 'Iron (IV preferred)', evidence: 'IV iron better tolerated than oral in IBD; oral iron may worsen gut inflammation', grade: 'A (for deficiency)' },
      { supplement: 'Omega-3 fatty acids', evidence: 'NOT recommended for maintaining remission (ECCO 2025, EL1) despite anti-inflammatory properties — clinical trial data does not support routine use', grade: 'Not recommended for IBD-specific maintenance' },
      { supplement: 'Probiotics', evidence: 'Limited evidence in Crohn\'s; some benefit in UC and pouchitis. Strain-specific — VSL#3 has most evidence for UC', grade: 'B for UC; C for Crohn\'s' },
    ],
    exercise_interaction: 'Exercise is beneficial during remission — reduces systemic inflammation, improves fatigue, supports bone density, and helps manage stress which is an IBD trigger. During active flares: gentle activity (walking, yoga) preferred over high-intensity exercise which may worsen symptoms via gut blood flow diversion.',
    myths_busted: [
      'High-fibre foods always worsen IBD — false. During remission, dietary fibre is beneficial and should be encouraged. During active flares, soft low-fibre foods are preferred, but this is temporary.',
      'You need to follow a strict elimination diet permanently — false. In remission, the Mediterranean diet (diverse and balanced) is recommended. Individual trigger foods may exist.',
      'Probiotics cure IBD — false. Evidence is modest and strain-specific; they do not replace medical treatment.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'logging_processed_meat', message: 'Processed meat (bacon, sausages, deli meat) is consistently associated with UC flare risk. Consider lean chicken or fish instead.' },
      { type: 'info', trigger: 'flare_mode', message: 'During a flare: focus on low-residue foods (white rice, cooked carrots, eggs, fish). Avoid raw vegetables and high-fibre foods until symptoms settle.' },
      { type: 'warning', trigger: 'low_iron', message: 'Iron deficiency is extremely common in IBD due to chronic gut bleeding and malabsorption. Talk to your doctor about checking ferritin levels.' },
    ],
    medical_disclaimer: 'IBD requires ongoing medical management. Dietary changes complement but do not replace medical therapy. Malnutrition in IBD should be assessed and managed by a gastroenterologist and specialist dietitian.',
    sources: ['AGA CPU 2024', 'ECCO Consensus J Crohns Colitis 2025', 'Melton et al. JGH Open 2024'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. GOUT — Gout / Hyperuricaemia
  // ═══════════════════════════════════════════════════════════════════════════
  gout: {
    id: 'gout',
    name: 'Gout',
    display_name: 'Gout / Hyperuricaemia',
    prevalence: '~4% of US adults (9.2 million); more common in men; rising globally',
    mechanism: 'Gout is caused by monosodium urate crystal deposition in joints from hyperuricaemia (elevated blood uric acid). Purines are metabolised to uric acid — high-purine foods and fructose increase uric acid production. Alcohol and certain medications reduce renal uric acid excretion. Diet alone typically reduces uric acid by <1 mg/dL — usually insufficient as monotherapy, but reduces flare frequency.',
    first_line: 'Low-purine diet combined with DASH or Mediterranean diet pattern. Avoid high-purine animal foods, alcohol (especially beer), and high-fructose foods. Hydration is critical. Weight loss if overweight. Note: dietary factors have a small-to-moderate effect on uric acid and are best combined with urate-lowering medication for clinical gout.',
    key_protocols: [
      'Hydrate — 5–8 glasses of water per day reduces uric acid and gout symptoms',
      'Avoid alcohol during flares; limit between flares (beer is worst — highest purine + blocks uric acid excretion)',
      'Eliminate organ meats and high-purine seafood',
      'Eliminate high-fructose corn syrup containing foods and beverages',
      'Weight loss (>7kg) significantly reduces uric acid in overweight patients',
      'Coffee (daily, without sugar) reduces uric acid — safe to continue or start',
      'Low-fat dairy may reduce uric acid — can include yogurt, skim milk',
    ],
    foods_emphasise: [
      { food: 'Water', examples: 'Plain water; 8+ glasses/day', reason: 'Hydration promotes urinary uric acid excretion; reduces crystal formation risk' },
      { food: 'Low-fat dairy', examples: 'Skim milk, low-fat yogurt, low-fat cheese', reason: 'Reduces uric acid levels; promotes urinary uric acid excretion; anti-inflammatory proteins in dairy' },
      { food: 'Vegetables (most)', examples: 'All non-starchy vegetables; some higher-purine vegetables like asparagus are still acceptable', reason: 'Vegetable purines do NOT increase gout risk as animal-source purines do' },
      { food: 'Whole grains', examples: 'Brown rice, barley, quinoa, whole wheat bread, oats', reason: 'Low-purine; part of DASH/Mediterranean patterns that reduce uric acid' },
      { food: 'Coffee', examples: 'Regular coffee (without sugar)', reason: 'Daily coffee intake associated with reduced uric acid levels — different acid type to uric acid' },
      { food: 'Cherries', examples: 'Fresh cherries, tart cherry juice', reason: 'Anti-inflammatory properties; some evidence for reducing gout flare frequency' },
      { food: 'Complex carbohydrates', examples: 'Potato, sweet potato, legumes (in moderation)', reason: 'Low-purine; filling without raising uric acid' },
      { food: 'Lean proteins', examples: 'Chicken breast, eggs, low-fat dairy, legumes', reason: 'Lower purine than red meat and seafood; maintain protein without uric acid burden' },
    ],
    foods_limit: [
      { food: 'Red meat', reason: 'High purine content — moderate amounts acceptable', serving_guide: 'Max 85–115g serving, 3–4 times per week; prefer lean cuts' },
      { food: 'Certain seafood', reason: 'High purine content — anchovies, sardines, herring, mussels, scallops, codfish highest', serving_guide: 'Lower-purine fish (salmon, tuna) in moderation acceptable' },
      { food: 'Alcohol', reason: 'Increases uric acid production AND reduces renal excretion — especially beer', serving_guide: 'Avoid during flares; max 1 drink/day between flares; wine less problematic than beer or spirits' },
      { food: 'Fructose-containing foods', reason: 'Fructose metabolism generates uric acid; high-fructose corn syrup particularly harmful', serving_guide: 'Limit fruit juice, sodas, sweetened cereals, commercial baked goods with HFCS' },
    ],
    foods_avoid: [
      { food: 'Organ meats', reason: 'Extremely high purine content — liver, kidney, sweetbreads, brain, tripe', examples: 'Liver pate, kidney pie, sweetbreads' },
      { food: 'High-fructose corn syrup products', reason: 'Concentrated fructose directly increases uric acid synthesis via purine pathway', examples: 'Most commercial sodas, some cereals, commercial sauces and dressings — check labels' },
      { food: 'Beer during flares', reason: 'Beer contains purines from barley AND alcohol which blocks uric acid excretion — worst combination for gout' },
    ],
    nutrients_watch: [
      { nutrient: 'Hydration', risk: 'Dehydration concentrates uric acid and increases crystallisation risk', action: 'Minimum 2–3 litres water/day; more with exercise or heat' },
      { nutrient: 'Vitamin C', risk: 'Previously thought to reduce uric acid — current evidence does not support supplementation for gout specifically', action: 'Maintain adequate dietary vitamin C from fruit and vegetables; supplementation not recommended for gout per 2025 update' },
      { nutrient: 'Protein', risk: 'High protein intake from animal sources increases purine load; however adequate protein is still needed', action: 'Meet protein needs from mixed sources — include eggs, dairy, plant proteins alongside moderate lean meat and fish' },
    ],
    supplement_evidence: [
      { supplement: 'Tart cherry extract', evidence: 'Anti-inflammatory; some evidence for reducing gout flare frequency — evidence still emerging', grade: 'C' },
      { supplement: 'Vitamin C', evidence: 'Previously promoted for gout — recent evidence (2025) does not support effectiveness for gout-specific outcomes', grade: 'D (not recommended for gout)' },
    ],
    exercise_interaction: 'Exercise helps with weight loss which is one of the most effective lifestyle interventions for uric acid reduction. High vegetable consumption and regular exercise are associated with better quality of life in gout (Korean J Intern Med 2024). Avoid dehydration during exercise — critical for gout management.',
    myths_busted: [
      'All seafood is forbidden — false. Lower-purine fish (salmon, tuna in moderate amounts) can be included. It is the highest-purine shellfish and anchovies that are most problematic.',
      'Vegetable purines increase gout risk — false. Studies consistently show that high-purine vegetables (asparagus, mushrooms, spinach) do NOT increase gout risk as animal-source purines do.',
      'Vitamin C cures gout — not supported by current evidence. Earlier studies were promising but 2025 reviews found no significant clinical benefit.',
      'Diet alone can manage gout without medication — usually false. Diet typically reduces uric acid by <1 mg/dL — usually insufficient to reach therapeutic target of <6 mg/dL. Urate-lowering therapy (allopurinol, febuxostat) is usually required.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'logging_alcohol_beer', message: 'Beer is the highest-risk alcohol for gout flares — it both increases uric acid production and reduces kidney excretion. Avoid especially during or after a flare.' },
      { type: 'warning', trigger: 'logging_organ_meats', message: 'Organ meats (liver, kidney) have extremely high purine content and should be avoided in gout.' },
      { type: 'info', trigger: 'low_hydration', message: 'Staying well hydrated is one of the most effective daily habits for gout management — aim for 8+ glasses of water.' },
    ],
    medical_disclaimer: 'Dietary changes for gout reduce flare frequency and complement medication but rarely eliminate the need for urate-lowering therapy. If you have recurrent gout, discuss allopurinol or other urate-lowering agents with your doctor.',
    sources: ['McCarty et al. Ther Adv Musculoskelet 2025', 'USDA Purine Database 2025', 'Mayo Clinic Gout Diet 2025', 'Gout Systematic Review J Health Popul Nutr 2025'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. CKD — Chronic Kidney Disease
  // ═══════════════════════════════════════════════════════════════════════════
  ckd: {
    id: 'ckd',
    name: 'CKD',
    display_name: 'Chronic Kidney Disease (CKD)',
    prevalence: 'Affects ~10–15% of adults globally; major cause of cardiovascular disease and mortality',
    mechanism: 'Damaged kidneys cannot filter waste products, regulate electrolytes (potassium, phosphorus, sodium), or remove excess fluid effectively. Dietary management directly determines electrolyte balance, acid-base balance, and progression rate. High protein intake in CKD generates nitrogen waste; high phosphorus impairs bone health and cardiovascular function; hyperkalemia causes cardiac arrhythmias.',
    first_line: 'Plant-based, diverse diet favoured over animal-based proteins (KDIGO 2024). Protein: 0.8g/kg/day for CKD G3–G5 (not dialysis). Avoid high protein >1.3g/kg/day. Sodium <2g/day. Potassium and phosphorus management individualised based on labs — NOT blanket restriction. Mediterranean diet improves lipid profile (KDOQI 2020).',
    key_protocols: [
      'Protein: 0.8g/kg/day for CKD G3–G5 NOT on dialysis (higher than previously recommended)',
      'DIALYSIS patients need HIGHER protein: 1.2–1.5g/kg/day to compensate for treatment losses',
      'Sodium: <2000mg/day for most CKD patients with hypertension',
      'Potassium: individualised — only restrict if persistent hyperkalemia; many patients do not need restriction',
      'Phosphorus: individualised — plant-based phosphorus less bioavailable than animal/additive phosphorus',
      'Favour plant-based protein over animal protein where possible',
      'Cooking method matters for potassium: boiling and draining vegetables significantly reduces potassium content',
    ],
    foods_emphasise: [
      { food: 'Plant-based proteins', examples: 'Tofu, tempeh, legumes (within potassium tolerance), eggs', reason: 'Plant phosphorus has lower bioavailability; plant protein may slow CKD progression vs animal protein' },
      { food: 'Low-potassium fruits', examples: 'Apples, berries, grapes, pears, pineapple, watermelon (small portions)', reason: 'Safe fruit choices when potassium restriction is needed' },
      { food: 'Low-potassium vegetables', examples: 'Cabbage, cauliflower, green beans, onion, cucumber, lettuce', reason: 'Safe vegetables when potassium restricted; boiling and draining reduces potassium further' },
      { food: 'White rice, pasta, bread', examples: 'Refined grains lower in phosphorus and potassium than whole grains', reason: 'When phosphorus and potassium restriction needed; whole grains preferred for patients without restriction needs' },
      { food: 'Eggs (whites especially)', examples: 'Egg whites are low phosphorus, high quality protein', reason: 'High biological value protein without the phosphorus of egg yolk' },
      { food: 'Olive oil and canola oil', examples: 'For cooking and dressing', reason: 'Healthy fats without potassium, phosphorus, or sodium concerns' },
    ],
    foods_limit: [
      { food: 'High-phosphorus foods', reason: 'Phosphate accumulation causes vascular calcification and bone disease in CKD', examples: 'Dairy (high phosphorus), processed cheese, dark sodas (phosphoric acid additive), beer, nuts and seeds (in excess)', serving_guide: 'Phosphorus additives in processed foods are most bioavailable — check labels for phosphate additives' },
      { food: 'High-potassium foods (if hyperkalemia)', reason: 'Hyperkalemia causes cardiac arrhythmias — life-threatening', examples: 'Bananas, oranges, avocado, potatoes (unless boiled and drained), tomato, apricots, beans (if potassium restricted)' },
      { food: 'High-sodium processed foods', reason: 'Sodium worsens hypertension and fluid retention in CKD', examples: 'Canned soups, processed meats, fast food, ready meals, soy sauce, pickled foods' },
      { food: 'Excessive animal protein', reason: 'High protein load increases nitrogen waste, acidosis, and may accelerate CKD progression', serving_guide: 'For CKD G3–G5 (not dialysis): limit animal protein; distribute protein across meals' },
    ],
    foods_avoid: [
      { food: 'Potassium-based salt substitutes (if hyperkalemia)', reason: 'Salt substitutes use potassium chloride — dangerous for CKD patients with elevated potassium', examples: 'Lo-Salt, NuSalt, No Salt brand — check labels of ANY reduced-sodium products' },
      { food: 'Phosphate additive-containing processed foods', reason: 'Phosphate additives (inorganic phosphorus) are nearly 100% bioavailable — far more dangerous than plant or even animal food phosphorus', examples: 'Processed cheese, dark colas, many fast foods, processed meats' },
    ],
    nutrients_watch: [
      { nutrient: 'Potassium', risk: 'Hyperkalemia causes cardiac arrhythmias; however, NOT all CKD patients need restriction — individualise based on serum potassium levels', action: 'Check serum potassium; restrict only if persistently elevated. For normal potassium: maintain fruit/vegetable intake for fibre and alkalinising effects' },
      { nutrient: 'Phosphorus', risk: 'Accumulation causes vascular calcification and secondary hyperparathyroidism', action: 'Prioritise plant sources; avoid phosphate additives; calcium-based phosphate binders prescribed by doctor' },
      { nutrient: 'Protein', risk: 'Both too much (generates waste, accelerates progression) and too little (malnutrition) are harmful', action: 'Individualise to CKD stage: 0.8g/kg for non-dialysis G3–G5; 1.2–1.5g/kg for dialysis' },
      { nutrient: 'Vitamin D', risk: 'Kidney is primary activation site for vitamin D; deficiency common in CKD', action: 'Active vitamin D (calcitriol) prescribed by doctor; dietary vitamin D from fortified foods and fatty fish' },
      { nutrient: 'Iron', risk: 'Anaemia of CKD is common — combination of reduced EPO production and functional iron deficiency', action: 'Monitor Hb and ferritin; iron supplementation and/or EPO therapy prescribed by doctor' },
      { nutrient: 'Calcium', risk: 'Complex in CKD — may need restriction with high phosphorus; may need supplementation with low calcium', action: 'Individualise based on calcium and phosphorus labs; follow nephrology guidance' },
    ],
    supplement_evidence: [
      { supplement: 'Active vitamin D (calcitriol)', evidence: 'Prescribed by nephrologist for secondary hyperparathyroidism in CKD', grade: 'A (prescription only)' },
      { supplement: 'Iron', evidence: 'For anaemia of CKD — oral or IV depending on severity; under medical supervision', grade: 'A (when deficient, medical guidance)' },
      { supplement: 'Oral nutritional supplements (renal-specific)', evidence: 'Renal-specific ONS (e.g., Nepro) with controlled electrolytes for dialysis patients at nutritional risk', grade: 'B (dialysis patients)' },
    ],
    exercise_interaction: 'Exercise is beneficial and safe in CKD — improves cardiovascular function, muscle mass (counteracts sarcopenia), and quality of life. Resistance training preserves muscle mass and metabolic function. Avoid excessive dehydration during exercise — impairs kidney perfusion. Protein needs after exercise may be slightly higher but remain within CKD protein limits.',
    myths_busted: [
      'All CKD patients must restrict potassium — false. KDIGO 2024 recommends AGAINST routine potassium restriction in CKD without persistent hyperkalemia. Restriction removes beneficial fibre-rich fruits and vegetables.',
      'Plant foods are high phosphorus and dangerous in CKD — false. Plant phosphorus is bound to phytate and only ~50% bioavailable vs near 100% for phosphate additives in processed foods. Plant-based diets are generally encouraged.',
      'High protein is needed to maintain muscle with kidney disease — partially false. Dialysis patients DO need higher protein. Non-dialysis CKD G3–G5 patients should NOT exceed 0.8g/kg/day.',
      'CKD patients cannot exercise — false. Exercise is beneficial and should be encouraged, adapted to the patient\'s fitness level.',
    ],
    app_alerts: [
      { type: 'critical', trigger: 'logging_potassium_salt_substitute', message: 'Potassium-based salt substitutes (Lo-Salt, NuSalt) are dangerous for CKD patients with elevated potassium. Avoid these products.' },
      { type: 'warning', trigger: 'high_protein_day', message: 'For CKD (non-dialysis), high protein intake accelerates kidney decline. Keep protein at 0.8g/kg/day unless you are on dialysis (which requires more).' },
      { type: 'warning', trigger: 'logging_phosphate_additive', message: 'Phosphate additives in processed foods are nearly fully absorbed and are particularly harmful for CKD. Check labels for "phosphate" ingredients.' },
    ],
    medical_disclaimer: 'CKD nutrition is highly individualised based on GFR stage, lab values (potassium, phosphorus, calcium), and whether you are on dialysis. Always work with a renal dietitian. Do not self-adjust protein, potassium, or phosphorus without medical guidance.',
    sources: ['KDIGO 2024 CKD Guidelines', 'KDOQI 2020 Nutrition Guidelines', 'NIDDK Healthy Eating for CKD 2024', 'PMC12523900 Plant-Based Diets CKD 2025'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. CVD — Cardiovascular Disease / Hypertension / High Cholesterol
  // ═══════════════════════════════════════════════════════════════════════════
  cvd: {
    id: 'cvd',
    name: 'CVD',
    display_name: 'Cardiovascular Disease / Hypertension / High Cholesterol',
    prevalence: 'CVD is the leading cause of mortality globally; hypertension affects ~1.3 billion adults',
    mechanism: 'Diet influences cardiovascular risk through multiple pathways: LDL cholesterol, blood pressure, systemic inflammation, insulin resistance, endothelial function, and body weight. Saturated fat raises LDL. Sodium raises blood pressure. Processed foods drive inflammation. Anti-inflammatory dietary patterns (Mediterranean, DASH) reduce event risk across multiple pathways simultaneously.',
    first_line: 'Mediterranean diet — strongest and most comprehensive evidence for CVD prevention and secondary risk reduction. DASH diet — most evidence for blood pressure reduction specifically. Both patterns emphasise whole foods, healthy fats, fibre, and minimal processed foods. AHA 2026 Scientific Statement: poor diet quality is the strongest modifiable CVD risk factor.',
    key_protocols: [
      'Adopt Mediterranean or DASH dietary pattern as primary framework',
      'Sodium: <2000mg/day for most; <1500mg/day for high cardiovascular risk (AHA target)',
      'Saturated fat: replace with unsaturated fats (olive oil, nuts, fatty fish) — most evidence-based dietary change for LDL reduction',
      'Eliminate trans fats completely — partially hydrogenated oils',
      'Increase omega-3 intake — 2–3 servings fatty fish per week minimum',
      'Increase soluble fibre — oats, barley, legumes, psyllium — reduces LDL cholesterol',
      'Avoid sugar-sweetened beverages and added sugars — raise triglycerides and systemic inflammation',
      'Plant sterols (from margarine, fortified foods) reduce LDL by 5–15% — clinically significant adjunct',
    ],
    foods_emphasise: [
      { food: 'Extra-virgin olive oil', examples: 'As primary cooking and dressing fat', reason: 'PREDIMED trial: 50% lower risk of PAD, reduced stroke, AF risk. Anti-inflammatory polyphenols and monounsaturated fats.' },
      { food: 'Fatty fish', examples: 'Salmon, sardines, mackerel, herring, trout', reason: 'Omega-3 fatty acids reduce triglycerides, inflammation, and arrhythmia risk. Minimum 2 servings/week (AHA).' },
      { food: 'Nuts', examples: 'Almonds, walnuts (highest omega-3), pistachios, hazelnuts', reason: 'Reduce LDL cholesterol; anti-inflammatory; associated with reduced cardiovascular events in PREDIMED' },
      { food: 'Legumes', examples: 'Lentils, chickpeas, black beans, kidney beans', reason: 'Soluble fibre reduces LDL; plant protein replaces higher-saturated-fat animal proteins' },
      { food: 'Oats and barley', examples: 'Rolled oats, oat bran, pearl barley', reason: 'Beta-glucan soluble fibre — FDA-approved heart health claim; reduces LDL cholesterol clinically' },
      { food: 'Colourful vegetables and fruits', examples: 'Leafy greens, tomatoes, berries, citrus, cruciferous vegetables', reason: 'Potassium (blood pressure), polyphenols (inflammation), fibre (LDL), folate (homocysteine)' },
      { food: 'Whole grains', examples: 'Whole wheat, brown rice, quinoa, whole rye bread', reason: 'Fibre, B vitamins, minerals; reduce CVD risk vs refined grain alternatives' },
      { food: 'Low-fat dairy or fermented dairy', examples: 'Yogurt, low-fat milk, kefir', reason: 'Provides calcium and protein; fermented dairy associated with reduced CVD events' },
    ],
    foods_limit: [
      { food: 'Saturated fat sources', reason: 'Raises LDL cholesterol — the most direct dietary driver of atherosclerosis', examples: 'Red meat fat, full-fat dairy, butter, lard, coconut oil, palm oil, processed meat', serving_guide: 'Replace with unsaturated fats (olive oil, nuts) rather than refined carbohydrates' },
      { food: 'Sodium/salt', reason: 'Raises blood pressure — even small reductions have significant population-level impact', examples: 'Table salt, processed foods, canned goods, restaurant food, deli meats', serving_guide: 'Cook from scratch; use herbs, spices, citrus to flavour instead of salt' },
      { food: 'Red meat', reason: 'High saturated fat and haem iron; associated with increased CVD events', serving_guide: 'Max 2–3 servings/week of lean cuts; minimise processed red meat' },
      { food: 'Refined carbohydrates and added sugar', reason: 'Raise triglycerides, cause insulin spikes, promote inflammation and weight gain', examples: 'White bread, white rice, most breakfast cereals, pastries, sugar in drinks' },
      { food: 'Alcohol', reason: 'Raises blood pressure and triglycerides even in moderate amounts; no safe level for CVD prevention per current evidence (AHA 2026)', serving_guide: 'Minimise or eliminate; if consumed, maximum 1 drink/day (women) or 2 (men)' },
    ],
    foods_avoid: [
      { food: 'Trans fats / partially hydrogenated oils', reason: 'Raise LDL AND lower HDL simultaneously — most harmful dietary fat for cardiovascular health', examples: 'Some commercial baked goods, margarine (check label), some fried fast foods — look for "partially hydrogenated" on ingredient list' },
      { food: 'Ultra-processed foods', reason: 'High in sodium, saturated fat, added sugar, and additives — independently associated with CVD mortality', examples: 'Packaged snacks, fast food, processed meats, commercial baked goods, most ready meals' },
      { food: 'Sugar-sweetened beverages', reason: 'Raise triglycerides, promote inflammation, contribute to obesity — major modifiable CVD risk factor', examples: 'Soda, juice, energy drinks, sweetened coffees and teas' },
    ],
    nutrients_watch: [
      { nutrient: 'Omega-3 (EPA+DHA)', risk: 'Most people consume far below the 2 servings/week fatty fish target', action: 'Increase fatty fish; consider EPA+DHA supplement 1–2g/day if not eating adequate fish' },
      { nutrient: 'Soluble fibre', risk: 'Most people consume far below the 10–25g soluble fibre/day associated with LDL reduction', action: 'Oats, psyllium, legumes, barley — each meal should include a fibre source' },
      { nutrient: 'Potassium', risk: 'Low potassium worsens blood pressure; most people consume well below recommended 3500–4700mg/day', action: 'Fruits, vegetables, legumes, dairy — every additional serving of fruit/vegetable reduces BP' },
      { nutrient: 'Magnesium', risk: 'Deficiency associated with hypertension and arrhythmia risk', action: 'Dark leafy greens, nuts, seeds, dark chocolate, legumes' },
      { nutrient: 'Vitamin K2', risk: 'May prevent arterial calcification — limited but growing evidence', action: 'Fermented foods (natto, aged cheese), some data on supplementation — discuss with doctor' },
    ],
    supplement_evidence: [
      { supplement: 'Omega-3 (EPA+DHA)', evidence: 'Reduces triglycerides (high-dose); reduces cardiovascular events (specific populations). 1–4g/day depending on indication', grade: 'A' },
      { supplement: 'Plant sterols/stanols', evidence: 'Reduces LDL by 5–15% at 2g/day. Added to fortified margarine, dairy products', grade: 'A' },
      { supplement: 'Psyllium husk', evidence: 'Soluble fibre reduces LDL cholesterol by ~5–7%; also lowers blood pressure', grade: 'A' },
      { supplement: 'Coenzyme Q10', evidence: 'May improve statin side effects and mild blood pressure benefit — limited evidence', grade: 'C' },
    ],
    exercise_interaction: 'Exercise is first-line treatment alongside diet for CVD risk. Resistance training improves metabolic markers including HDL and glycaemic control. Aerobic exercise lowers resting blood pressure (5–8 mmHg) and LDL. LiftIQ resistance programs align with AHA 2024 recommendations for cardiovascular health.',
    myths_busted: [
      'Dietary cholesterol causes heart disease — oversimplified. Saturated fat raises LDL more than dietary cholesterol for most people. Eggs in moderation are now accepted (up to 6–7/week) for most people.',
      'Coconut oil is heart-healthy — false. Coconut oil is very high in saturated fat and raises LDL cholesterol. Not supported by evidence despite popular claims.',
      'A glass of wine per day is heart-healthy — outdated. AHA 2026 Statement: no safe level of alcohol for cardiovascular prevention. Earlier observational data was confounded.',
      'Low-fat diets are the best for heart health — false. The type of fat matters. Replacing saturated fat with unsaturated fat (olive oil, nuts) is beneficial. Replacing saturated fat with refined carbs is NOT beneficial.',
    ],
    app_alerts: [
      { type: 'warning', trigger: 'high_sodium_day', message: 'Your sodium intake is high today. For cardiovascular health, target less than 2000mg/day. Check processed food labels — sodium hides everywhere.' },
      { type: 'info', trigger: 'logging_oats', message: 'Great choice! Beta-glucan in oats is one of the most evidence-based dietary cholesterol-lowering tools. Aim for 3g beta-glucan/day (about 1.5 cups oats).' },
      { type: 'warning', trigger: 'low_omega3', message: 'You haven\'t logged any fatty fish this week. Aim for 2+ servings of salmon, sardines, or mackerel weekly for heart health.' },
    ],
    medical_disclaimer: 'Dietary management for CVD complements but does not replace medical therapy (statins, antihypertensives, anticoagulants). Never stop or reduce cardiovascular medications without your doctor\'s guidance.',
    sources: ['AHA 2026 Scientific Statement (Circulation)', 'Italian 2025 National Mediterranean Diet Guidelines', 'PREDIMED trial', 'DASH-Sodium trial', 'Oxford Academic Cardiovasc Res 2024'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. MASLD — Metabolic Dysfunction-Associated Steatotic Liver Disease
  //     (formerly NAFLD — Non-Alcoholic Fatty Liver Disease)
  // ═══════════════════════════════════════════════════════════════════════════
  masld: {
    id: 'masld',
    name: 'MASLD/NAFLD',
    display_name: 'Metabolic Liver Disease (MASLD/NAFLD)',
    prevalence: '~30% of adults globally; 25% have MASLD; rising with obesity and T2D rates',
    mechanism: 'MASLD involves fat accumulation in the liver due to metabolic dysfunction (obesity, insulin resistance, dyslipidaemia, hypertension). Excess dietary fructose and saturated fat drive hepatic de novo lipogenesis. Weight loss directly reduces liver fat. Mediterranean diet reduces liver steatosis even without weight loss through anti-inflammatory and insulin-sensitising mechanisms.',
    first_line: 'Mediterranean diet — recommended by AGA, EASL, and Mayo Clinic as primary dietary approach for MASLD. Weight loss of 5–10% of body weight significantly reduces liver steatosis; ≥7% may resolve NASH; ≥10% improves fibrosis. Eliminate fructose (especially HFCS) and alcohol. Low-carbohydrate and ketogenic diets show evidence for reducing liver fat.',
    key_protocols: [
      '5% body weight loss reduces liver steatosis significantly',
      '7% body weight loss may resolve MASH (the inflammatory form)',
      '10% body weight loss can regress fibrosis',
      'Target: 500–1000 kcal/day deficit from baseline; hypocaloric diet 1200–1500 kcal/day',
      'Completely eliminate alcohol — even moderate drinking worsens MASLD',
      'Eliminate commercially produced fructose (HFCS) — most significant dietary driver of de novo lipogenesis',
      'Mediterranean diet provides benefits even without weight loss — reduces liver inflammation',
      'Resistance training + aerobic exercise combination is most effective for MASLD',
    ],
    foods_emphasise: [
      { food: 'Extra-virgin olive oil', examples: 'As primary fat for cooking and dressing', reason: 'Mediterranean diet cornerstone; polyphenols reduce hepatic inflammation; reduces liver fat' },
      { food: 'Fatty fish', examples: 'Salmon, sardines, mackerel, trout', reason: 'Omega-3 fatty acids reduce liver enzyme levels and hepatic fat' },
      { food: 'Coffee (regular, unsweetened)', examples: 'Black coffee, espresso', reason: 'Consistently associated with reduced liver steatosis, fibrosis, and cirrhosis risk. Polyphenols protective.' },
      { food: 'Colourful vegetables', examples: 'Leafy greens, tomatoes, broccoli, capsicum, carrots', reason: 'Low-calorie, anti-inflammatory, fibre-rich; support weight loss without nutrient compromise' },
      { food: 'Whole fruit (not juice)', examples: 'Berries especially — high polyphenols, lower GI', reason: 'Whole fruit fibre slows fructose absorption unlike juice; polyphenols protect liver' },
      { food: 'Legumes', examples: 'Lentils, chickpeas, black beans', reason: 'High fibre, protein, low GI — support weight loss and glycaemic control; beneficial for liver health' },
      { food: 'Walnuts', examples: 'Small handful daily', reason: 'High omega-3 and polyphenols; specifically studied for MASLD — reduces liver inflammation' },
      { food: 'Green tea', examples: 'Unsweetened green tea', reason: 'EGCG catechins reduce liver fat and inflammation in MASLD studies' },
    ],
    foods_limit: [
      { food: 'Saturated fat sources', reason: 'Promotes hepatic de novo lipogenesis and inflammation', examples: 'Red and processed meat, full-fat dairy, butter, coconut oil, fried foods', serving_guide: 'Minimise red meat to 2–3 servings/week maximum; replace with fish and plant protein' },
      { food: 'Refined carbohydrates', reason: 'High GI carbohydrates drive hepatic insulin resistance and fat accumulation', examples: 'White bread, white rice, regular pasta, most breakfast cereals', serving_guide: 'Switch to whole grain alternatives at every meal' },
      { food: 'Fruit juice', reason: 'Concentrated fructose without fibre — directly drives hepatic de novo lipogenesis', serving_guide: 'Eliminate or strict maximum 100ml with meal only; whole fruit preferred' },
    ],
    foods_avoid: [
      { food: 'Alcohol', reason: 'Even moderate drinking significantly worsens MASLD — AGA specifically recommends restriction or elimination', examples: 'All alcoholic beverages — beer, wine, spirits' },
      { food: 'High-fructose corn syrup products', reason: 'Commercially produced fructose bypasses hepatic insulin signalling and directly drives liver fat accumulation', examples: 'Most commercial sodas, many commercial sauces, cereals, baked goods — check labels' },
      { food: 'Ultra-processed foods', reason: 'Associated with MASLD development and progression (Nutrients 2025); high in HFCS, saturated fat, additives', examples: 'Fast food, packaged snacks, ready meals, commercial baked goods' },
    ],
    nutrients_watch: [
      { nutrient: 'Vitamin E', risk: 'Oxidative stress is a driver of MASH; vitamin E is listed in EASL guidelines as antioxidant treatment', action: 'EASL guideline: vitamin E 800 IU/day reduces steatosis — discuss with hepatologist; concern about long-term high-dose use' },
      { nutrient: 'Omega-3 (EPA+DHA)', risk: 'Most people consume below recommended levels; EPA+DHA reduce liver enzyme levels in MASLD', action: '2–4g EPA+DHA/day from fatty fish and/or supplementation — may reduce liver fat' },
      { nutrient: 'Choline', risk: 'Choline deficiency can cause fatty liver; often insufficient in plant-heavy diets', action: 'Eggs (rich in choline), lean meat, fish; particularly important if low animal food intake' },
      { nutrient: 'Folic acid', risk: 'Deficiency may worsen MASLD severity; MTHFR variants common', action: 'Leafy greens, legumes, fortified foods; supplement if dietary intake poor' },
    ],
    supplement_evidence: [
      { supplement: 'Vitamin E (800 IU/day)', evidence: 'EASL guideline recommendation for NASH without diabetes — reduces steatosis. Long-term use concerns exist.', grade: 'B' },
      { supplement: 'Omega-3 fatty acids', evidence: 'Reduces liver enzyme levels; growing evidence for reducing hepatic fat', grade: 'B' },
      { supplement: 'Silymarin (milk thistle)', evidence: 'May reduce liver fibrosis — emerging evidence', grade: 'C' },
      { supplement: 'Vitamin D', evidence: 'Deficiency common in MASLD; correction may reduce inflammation', grade: 'C' },
    ],
    exercise_interaction: 'Exercise is co-primary treatment alongside diet — the combination is significantly more effective than either alone. 150–300 minutes moderate-intensity aerobic exercise per week targeted. Resistance training independently reduces liver fat and improves insulin sensitivity. Even without weight loss, exercise alone reduces liver steatosis.',
    myths_busted: [
      'Only obese people get MASLD — false. Lean MASLD (lean NAFLD) exists; insulin resistance occurs at any BMI. Lean patients also benefit from dietary changes and weight loss targets of 3–5%.',
      'You need to completely avoid all fats — false. Healthy fats (olive oil, fish, nuts) are protective. Saturated fat and commercially-produced fructose are the main dietary culprits.',
      'A glass of wine is fine with MASLD — false. AGA guidelines specifically recommend alcohol restriction or elimination for all MASLD patients.',
    ],
    app_alerts: [
      { type: 'critical', trigger: 'logging_alcohol', message: 'Alcohol significantly worsens metabolic liver disease (MASLD/NAFLD). AGA guidelines recommend restriction or elimination for all MASLD patients.' },
      { type: 'warning', trigger: 'logging_fruit_juice', message: 'Fruit juice is high in fructose without fibre and is a major driver of liver fat accumulation. Switch to whole fruit.' },
      { type: 'info', trigger: 'logging_coffee', message: 'Coffee is one of the most liver-protective beverages — associated with reduced steatosis and fibrosis risk in MASLD. Black, unsweetened coffee counts.' },
    ],
    medical_disclaimer: 'MASLD severity ranges from simple steatosis to MASH with fibrosis. Resmetirom (Rezdiffra) is now FDA-approved for MASH with F2–F3 fibrosis. A hepatologist should assess severity and guide treatment. Dietary changes are essential for all stages.',
    sources: ['AGA MASLD Diet Guidelines', 'Mayo Clinic MASLD Diet 2025', 'PMC MASLD MNT Review 2025 (PMC11724794)', 'ECCO-EASL 2025', 'Frontiers Nutr MASLD Evidence Summary 2025'],
  },
};

// ─── HELPER EXPORTS ───────────────────────────────────────────────────────────

// All condition IDs for the UI selector
export const CONDITION_LIST = Object.values(CONDITIONS).map(c => ({
  id: c.id,
  name: c.name,
  display_name: c.display_name,
  prevalence: c.prevalence,
}));

// Get foods to flag for a given set of active conditions
export function getFoodFlags(conditionIds = []) {
  const flags = { avoid: [], limit: [], emphasise: [] };
  conditionIds.forEach(id => {
    const condition = CONDITIONS[id];
    if (!condition) return;
    condition.foods_avoid?.forEach(f => flags.avoid.push({ ...f, condition: condition.name }));
    condition.foods_limit?.forEach(f => flags.limit.push({ ...f, condition: condition.name }));
    condition.foods_emphasise?.forEach(f => flags.emphasise.push({ ...f, condition: condition.name }));
  });
  return flags;
}

// Get nutrient alerts for a given set of active conditions
export function getNutrientAlerts(conditionIds = []) {
  return conditionIds.flatMap(id => {
    const condition = CONDITIONS[id];
    if (!condition) return [];
    return (condition.nutrients_watch || []).map(n => ({
      ...n,
      condition: condition.name,
    }));
  });
}

// Get app alerts for a given condition set and a trigger event
export function getAppAlerts(conditionIds = [], trigger = '') {
  return conditionIds.flatMap(id => {
    const condition = CONDITIONS[id];
    if (!condition) return [];
    return (condition.app_alerts || [])
      .filter(a => a.trigger === trigger || trigger === '')
      .map(a => ({ ...a, condition: condition.name }));
  });
}
