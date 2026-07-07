# MeadowBot Service Data Validation: Fionn's Audit

**Auditor:** @Fionn Grogan, Researcher & Domain Expert
**Date:** 2026-07-07
**Scope:** `extractKeywords()` function (lines 590-614), species filter buttons (lines 282-286), category coverage, offer detection, telehealth detection, service descriptions

---

## 1. Category Count Discrepancy: 12 mapped, spec says 13

**Finding (CRITICAL):** The `five-innovators-spec.md` correctly lists 13 Meadow Vet Care categories:

> Consultations, Preventive, Nutrition, Vaccination, Microchip and ID, Dental, Surgery, Diagnostics, Grooming, Behaviour, Emergency, End-of-Life, and **Home Visits**

The `extractKeywords()` function on line 593 only maps 12:

```js
var categories=["consultation","preventive","nutrition","vaccination","microchip","dental",
                "surgery","diagnostics","grooming","behaviour","end-of-life","emergency"];
```

**"Home Visits" is missing.** The regex on line 611 maps `home.visit` to `"consultation"`, which is a reasonable proxy but flattens a distinct service category. If the Google Sheet uses "Home Visits" as a separate category value, `findServicesByCategory("home visits")` will never be called from keyword extraction and home-visit-specific services will not surface.

**Fix applied:** Added `"home visits"` to the categories array and added dedicated regex patterns for home visit queries.

---

## 2. Irish Colloquial Terms Missing from Keyword Patterns

### 2.1 "chipping" → Microchip (CRITICAL GAP)

The microchip regex on line 600 is `/microchip/i`. This matches "microchipping" (substring match) but does **NOT** match "chipping" on its own.

In Irish veterinary contexts, owners frequently ask "do you do chipping?" as shorthand for microchip implantation. This is a genuine service-discovery failure: a client types "chipping for my dog" and the keyword extractor returns zero microchip category hits.

**Fix applied:** Added `chipping` and `chip\b\n` to the microchip pattern: `/microchip|chipping|chip\b/i`

### 2.2 "jab" → Vaccination (CRITICAL GAP)

The vaccination regex on line 601 is `/vaccin/i`. This is the dominant Irish colloquial term for an injection/vaccination. A client asking "does my puppy need a jab?" or "kennel cough jab" produces zero vaccination category hits.

**Fix applied:** Added `jab`, `injection`, `shot`, `booster`, `inoculation` to the vaccination pattern.

### 2.3 Other Irish Terms

Terms like "grand", "class", "deadly", "sound", "craic" are already in `BOT_VOICE` for the LLM response voice. They do not need keyword extraction mappings -- they are conversational seasoning, not service search terms.

---

## 3. Category Keyword Mapping Gaps

### 3.1 Consultation (MAJOR GAP)

Current coverage: Only `home.visit` maps to consultation (line 611). The exact-match array includes "consultation" so typing that exact word works, but common client phrasings are missed:

| Client says | Matched? | Why |
|---|---|---|
| "check-up" | Yes | Regex maps to **preventive** (debatable) |
| "general health check" | No | "check" not "check-up", no "health check" pattern |
| "consult" | No | "consultation" not a substring of "consult"? Wait -- `t.indexOf("consultation")` fails because "consult" does not contain "consultation" |
| "exam" / "examination" | No | No pattern exists |
| "vet visit" | No | No pattern exists |
| "appointment" | No | No pattern exists |

**Fix applied:** Added `/health check|consult|exam|examination|vet visit|appointment/i` mapping to consultation.

### 3.2 Dental (MINOR GAP)

Current coverage: `/dental|teeth|scale.*polish|extraction/i` plus "dental" in exact-match array.

| Client says | Matched? | Why |
|---|---|---|
| "dentistry" | No | "dental" not a substring of "dentistry" |
| "tooth" | No | "teeth" is plural-only |

**Fix applied:** Added `dentistry` and `tooth` to dental pattern.

### 3.3 Diagnostics (MINOR GAP)

Current coverage: `/blood|urine|x.ray|ultrasound|scan|diagnos/i`

Missing: "lab work", "lab test", "biopsy".

**Fix applied:** Added `lab work|lab test|biopsy|test result` to diagnostics pattern.

---

## 4. Species Filter Button Bug

**Finding (COSMETIC BUG):** On line 284, the rabbit species filter button has the CSS class `species-dog` instead of `species-rabbit`:

```html
<button class="filter-chip species-dog active" onclick="toggleSpecies('rabbit',this)">🐇 Rabbit</button>
```

This means the rabbit button turns gold (dog colour, `#C4A44A`) when active instead of teal (rabbit colour, `#6B9E8E`). The CSS already defines `.filter-chip.species-rabbit.active` on line 127, but it's never used because no button carries the `species-rabbit` class.

The functionality is unaffected (`toggleSpecies` operates on the `data-species`/parameter, not the CSS class), but the visual feedback is wrong.

**Fix applied:** Changed `species-dog` → `species-rabbit` on the rabbit filter button.

---

## 5. Offer Detection: False Positives and Missing Patterns

### 5.1 False positive risk: "off" is too broad

Current pattern (line 597): `/offer|discount|sale|save|off|special/i`

The `off` token matches "office", "official", "off-leash", "off food", "take the day off" -- any text containing those three letters. While the hybrid LLM+keyword architecture means this is a first-stage filter not a final answer, it can pollute the service results panel with offers when the query had nothing to do with pricing.

**Fix applied:** Changed `off` to `\boff\b` (word boundary) so only standalone "off" (e.g. "50% off", "off peak") triggers offers, not "office" or "official".

### 5.2 Missing offer-related terms

| Term missing | Example query |
|---|---|
| "deal" | "any deals on neutering?" |
| "promotion" | "current promotions for new clients" |
| "reduced" | "reduced price for pensioners" |
| "cheap" | "cheapest dog vaccination" |
| "bargain" | colloquial Irish price inquiry |
| "free" | "free first consultation" |

**Fix applied:** Added `deal|promotion|reduced|cheap|bargain|free` to offer pattern.

---

## 6. Telehealth Detection

Current pattern (line 598): `/telehealth|video|remote|online consult/i`

Coverage is good but missing:
- "virtual appointment" / "virtual consult"
- "zoom call" / "video call" (already partially covered by "video")
- "online appointment" (only "online consult" is covered, not "online appointment")

**Fix applied:** Added `virtual` and `online appointment` to telehealth pattern.

---

## 7. Keyword Extraction vs. Exact-Match Category Mechanism

**Structural observation:** The `extractKeywords` function uses two mechanisms for category detection:

1. **Exact substring match** (line 595-596): Checks if each category name exists as a substring of user text. Example: `t.indexOf("dental")` -- works if user types "dental" but NOT "dentistry".

2. **Regex patterns** (lines 597-612): Broader matching for common phrasings.

**Risk:** If a regex pattern is added but the resulting category name doesn't match what the Google Sheet uses, `findServicesByCategory()` will return zero results. Example: if the sheet stores the category as `"Microchip & ID"` and the code maps to `"microchip"`, the `findServicesByCategory` function handles this because it does `S(s.category).indexOf(c) > -1` -- "microchip & id" contains "microchip". This is fragile but functional.

**Recommendation:** Long-term, maintain a canonical-to-display mapping so that keyword extraction always returns the exact category names used in the sheet. For now, the substring fallback in `findServicesByCategory` provides adequate coverage.

---

## 8. Service Descriptions and Suggestions Audit

### 8.1 Default suggestion chips (lines 270-276)

The initial discovery-panel suggestions are:

| Suggestion | Coverage |
|---|---|
| "Dog services" | Generic -- triggers species-only search, returns all dog services |
| "Microchip offers" | Good -- hits both microchip category AND offer flag |
| "Telehealth" | Good -- triggers dedicated telehealth filter path |
| "Cat dental" | Good -- species + category crossover |
| "Emergency" | Good -- triggers emergency category |
| "Grooming for dogs" | Good -- species + category crossover |

**Assessment:** The six suggestion chips cover 5 of 13 categories directly (Microchip, Telehealth, Dental, Emergency, Grooming) and provide species entry points (Dog, Cat). Missing coverage for: Consultation, Preventive, Nutrition, Vaccination, Surgery, Diagnostics, Behaviour, End-of-life, Home Visits. This is acceptable for initial suggestions -- the purpose is to demonstrate the search capability, not exhaust the catalogue.

### 8.2 Auto-suggestions after search (line 871)

```js
setTimeout(function(){addSugg(["Keep exploring","Book an appointment","Human"])},3000);
```

These are generic follow-ups. The "Book an appointment" chip does not trigger any booking flow -- it just sends "Book an appointment" as a chat message, which the keyword extractor won't parse usefully. The LLM may handle it, but a better approach would be to surface a category-specific booking suggestion based on the last search.

### 8.3 Service card rendering (lines 537-557)

The service card template includes:
- Service ID
- Service name with species emoji
- Species + category
- Price in EUR
- Duration
- Slot availability (or walk-in / no-slots status)
- Description (expandable)
- Book button (expandable)
- Special offer badge

**Assessment:** Comprehensive. All the data columns from the Google Sheet are rendered. Species icons are correctly mapped. Offer badges are prominent. The expand/collapse pattern is functional.

---

## 9. `findServicesByCategory` Function Robustness (lines 578-581)

```js
function findServicesByCategory(cat){
  var c=S(cat);
  return allServices.filter(function(s){return S(s.category)===c||S(s.category).indexOf(c)>-1});
}
```

**Observation:** This function returns ALL services matching the category, without regard to active species filters. The calling code (lines 827-833) then intersects with species results. This is correct behaviour -- the function itself should not filter by species; the caller handles the intersection.

**Potential issue:** If a category name from keyword extraction is a very short substring (e.g. "id"), it could match unintended categories. Currently all category names are sufficiently distinct that this is not a risk.

---

## 10. Domain Boundary Enforcement

Per Fionn's core belief #4: "Domain closure is a feature, not a limitation."

The `BOT_VOICE` (line 617) includes: "Never diagnose medical conditions." The LLM is instructed to stay within scope. However, the keyword extractor does not have a "medical question" detector to prevent the LLM from receiving clinical queries.

This is NOT a bug: the architecture intentionally routes ALL queries through the LLM, and the LLM's system prompt handles the domain boundary. The keyword extractor's job is service discovery, not domain gating.

---

## Summary of Fixes Applied to index.html

| # | Issue | Severity | Line(s) | Fix |
|---|---|---|---|---|
| 1 | Rabbit button has `species-dog` class, should be `species-rabbit` | Low | 284 | CSS class corrected |
| 2 | Missing "Home Visits" as 13th category | High | 593 | Added to categories array |
| 3 | "chipping" not detected as microchip | High | 600 | Added `chipping`, `chip\b` to microchip regex |
| 4 | "jab", "injection", "shot", "booster" not detected as vaccination | High | 601 | Added Irish/UK colloquial vaccination terms |
| 5 | "health check", "consult", "exam" not detected as consultation | High | 611 | Added consultation query patterns |
| 6 | "dentistry", "tooth" not detected as dental | Medium | 604 | Added missing dental terms |
| 7 | "lab work", "lab test", "biopsy" not detected as diagnostics | Medium | 609 | Added diagnostic terms |
| 8 | "off" matches "office"/"official" (false positive risk) | Medium | 597 | Changed to `\boff\b` word boundary |
| 9 | Missing "deal", "promotion", "reduced", "free" in offer detection | Medium | 597 | Added offer-related terms |
| 10 | Missing "virtual", "online appointment" in telehealth | Low | 598 | Added telehealth terms |

---

*Fionn Grogan: Veterinary services domain expert. Catalogue-grounded. Species-first.*
