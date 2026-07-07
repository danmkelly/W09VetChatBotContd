# Design & Pedagogical Review -- MeadowBot (Meadow Vet Care Chatbot)

**Reviewer:** @Keelin (QA specialist)
**Date:** 2026-07-07 (final review after full deployment)
**Frameworks applied:** Adamopoulou & Moussiades (2020) Seven-Dimension Chatbot Taxonomy; Reeves & Nass (1996) CASA; Conversation Flow Anatomy (Opener / Intent / Slots / Recovery / Closer / Unexpected); Grice (1975) Maxims of Conversation

---

## 1. Scored Findings Table

| # | Framework | Item | Score | Evidence | Severity |
|---|-----------|------|-------|----------|----------|
| A01 | Taxonomy | Knowledge domain -- closed vs open | PASS | Domain is closed (Meadow Vet Care services only: 94 services, 13 categories, 5 species). Domain guardrails prevent drift into general pet advice or clinical diagnosis. Easter eggs (Irish colloquialisms) are deliberate, not accidental drift. | [DESIGN] |
| A02 | Taxonomy | Service provided -- informational + transactional | PARTIAL | Bot provides service discovery, pricing, offer alerts (informational) and appointment booking (transactional). LLM conversational tone adds warmth but risks blurring the line between service information and clinical reassurance. Accepted: personality drives engagement; diagnosis boundary is enforced. | [DESIGN] |
| A03 | Taxonomy | Goals -- task-based service queries + booking | PASS | Three clear flows: service query (find by category/species/price), offer discovery, and booking. Every flow resolves to a concrete output -- a service card, a price, a booking slot. No dead-end conversation paths. | [DESIGN] |
| A04 | Taxonomy | Response generation -- hybrid (LLM + Sheet retrieval + keyword) | PARTIAL | Architecture confirmed: keyword extraction for species/category/offer terms, Google Sheet CSV for ground-truth service data, LLM for natural-language composition and ambiguous queries. Hallucination risk: LLM conversational text is not RAG-verified against Sheet data for non-service claims (e.g. "our vets are highly experienced"). Accepted: Sheet data provides hard grounding; LLM text is conversational flavour, not diagnostic. | [DESIGN] |
| A05 | Taxonomy | Communication channel -- text + voice parity | PASS | Text widget with Web Speech API STT input and SpeechSynthesis TTS output. Both paths go through the same intent routing pipeline. Voice errors show user-facing messages. Gibberish detection runs on voice transcriptions. Channel parity confirmed. | [DESIGN/CODE] |
| A06 | Taxonomy | Human-aid -- reachable at every stage | PASS | "Prefer a real human?" bar persistently visible at bottom of chat panel. Typing "human" returns full clinic contact details: phone (+353 1 800 5555), emergency (+353 1 800 9999), email (hello@meadowvetcare.ie), address (14 Greenfield Road, Dublin 6, D06 VX92), and opening hours. Handoff is reachable from greeting, service results, booking flow, and error states. Human-aid display is pure frontend HTML and survives Worker proxy downtime. | [DESIGN] |
| A07 | Taxonomy | Permissions -- localStorage only, consent-gated | N/A | All data stored client-side (localStorage). No service data, conversation data, or personal data transmitted to any server except the LLM conversation context sent to DeepSeek via the Worker proxy. Consent obtained before first write. No server-side user accounts. N/A scored because there is no relevant permission dimension beyond client-side storage. | -- |
| A08 | CASA | Disclosure in turn 1 | PASS | First spoken message: "I'm MeadowBot, an AI chatbot powered by DeepSeek. I can search for services, check prices, find offers, and help you book appointments." Unambiguous self-identification as "AI chatbot" in the first conversational turn. Header badge reinforces disclosure visually. No ambiguity about the bot's nature. | [DESIGN] |
| A09 | CASA | No fake-human cues | PASS | Bot name is "MeadowBot" -- clearly non-human. No fabricated typing delays implying a human is thinking. No human staff photo or name implying a real person. Irish colloquial register ("grand," "sound") is character seasoning, not deception. The bot does not claim to be a vet, a receptionist, or any human role. | [DESIGN] |
| A10 | CASA | Register matches capability | PARTIAL | Irish-flavoured conversational register is warm and welcoming, matching the clinic's brand personality. The register signals "I know the services, prices, and availability" rather than "I know veterinary medicine." However, the LLM may generate plausible-sounding clinical reassurances beyond its verified knowledge. Accepted: the bot does not claim clinical expertise, and domain guardrails redirect diagnostic queries to human handoff. | [DESIGN] |
| A11 | CASA | Frustration handling -- de-escalation on failure | PASS | Gibberish counter tracks consecutive unrecognised inputs. At 1-2 failures: bot rewords and offers example phrasings. At 3-4 failures: bot shifts register (helpful to concerned), offers constrained suggestion chips, and surfaces human handoff path. At 4+ failures: bot auto-forces human handoff ("I'm still not getting it -- let me hand you over"). Register adapts at each rung. No repetition of cheerful error templates. | [DESIGN/CODE] |
| A12 | CASA | Chummy data extraction -- consent BEFORE collection | PASS | Explicit consent flow implemented. Turn 2 asks: "Would you like me to remember you? Yes or No." localStorage writes are gated by `consent === "yes"`. No data persisted before consent. If user says no, nothing stored. "What I store" link persistently visible in brand bar. "Clear memory" button irreversibly removes all stored data. On return visit with no consent, all counters reset. | [DESIGN/CODE] |
| A13 | Flow Anatomy | OPENER -- identity + capability in turn 1 | PASS | Turn 1: "I'm MeadowBot, an AI chatbot... I can search for services, check prices, find offers, and help you book appointments." Identity AND capabilities disclosed in the first conversational turn. Species coverage and service categories are explicitly named. Human handoff path also mentioned in turn 1. | [DESIGN] |
| A14 | Flow Anatomy | INTENT -- one clear purpose per flow | PASS | Three distinct purpose flows: (1) service query -- finds services by species, category, price, or combined query; (2) special offer discovery -- surfaces active offers with pricing; (3) booking -- guides through calendar, time slots, and pet details. LLM conversational tone augments but does not derail these paths. | [DESIGN] |
| A15 | Flow Anatomy | SLOTS -- validated one at a time with back/correction | PARTIAL | Consent flow collects consent first, then name -- sequential validation confirmed. Booking flow collects day, then time, then name, pet name, species, and phone in sequence. However, service queries do not use structured slot-filling: species and category are extracted by keyword/LLM rather than form-based disambiguation. An ambiguous query like "checkup" is not disambiguated between dog/cat/rabbit checkup variants. Breed name misspellings (e.g. "labrador" for "Labrador") may fail silently. Accepted: species/category disambiguation gate added for low-confidence queries; full form-based slot validation exceeds project scope. | [DESIGN/CODE] |
| A16 | Flow Anatomy | RECOVERY LADDER -- 5 failure scenarios | PARTIAL | Five scenarios assessed. (1) Gibberish: reaches step 3 (de-escalation + auto handoff) -- resolved. (2) LLM timeout/error: human handoff path offered in fallback message -- resolved. (3) Empty Sheet results: bot clarifies and offers re-search -- resolved. (4) Misspelled breed names: no correction or "Did you mean...?" step; the bot treats the misspelling as a failed search with no species-aware disambiguation -- outstanding. (5) Sheet fetch failure: retry button and fallback message shown -- resolved. Of 5 scenarios, 4 handled at step 2 or above; 1 (misspelled breed) remains at step 1. | [DESIGN/CODE] |
| A17 | Flow Anatomy | CLOSER -- read-back + explore + book + human | PARTIAL | After a successful service search, suggestion chips offer "Keep exploring," "Book this," and "Human" paths. The services discovery panel provides visual read-back of results. However, the bot does not verbally summarise "I found 3 dental services for rabbits" before offering next steps; the read-back is visual (panel) not conversational. Accepted: visual read-back via service panel plus post-search suggestion chips is adequate for this interface pattern. | [DESIGN] |
| A18 | Flow Anatomy | Design the unexpected first | PARTIAL | Gibberish handled (counter + de-escalation). Empty input caught (`if(!txt)return`). Sheet fetch failure handled (retry + fallback). LLM API failure handled (human path). However: rapid topic switches are not aborted (no AbortController on fetch), mid-flow corrections (changing species mid-query) are unsupported, and there is no idle-timeout re-engagement. Accepted: critical edge cases covered; rapid switch and idle timeout are production-scale concerns beyond project scope. | [DESIGN] |
| A19 | Grice | Quantity -- response length appropriate | PASS | System prompt limits LLM responses to 2-5 sentences. Service data presentation (card with name, species, category, price, duration, offer badge) provides the right information density without overwhelming. The bot does not produce multi-paragraph answers. | [DESIGN] |
| A20 | Grice | Quality -- truthfulness and evidence | PARTIAL | Service names, prices, species applicability, and durations come from the live Google Sheet (verified). Special offer data is sheet-sourced (verified). However, LLM-generated conversational text (e.g. "our team are lovely, you'll be in great hands") is unverified and unverifiable. The bot does not fabricate service details, but it does generate subjective reassurances. Accepted: conversational text is low-stakes opinion; hard data (services, prices) is always sheet-grounded. | [DESIGN] |
| A21 | Grice | Relation -- relevance of responses | PASS | Intent routing (keyword + LLM hybrid) keeps responses within the service catalogue domain. Post-search suggestion chips stay on-topic. Domain guardrails redirect clinical queries ("my dog is limping") to human handoff rather than attempting diagnosis. No drift into general pet advice or unrelated conversation. | [DESIGN] |
| A22 | Grice | Manner -- clarity, brevity, orderliness | PARTIAL | Responses are plain-language, brief, and free of clinical jargon. No em dashes. No markdown in bot output. However, the LLM prompt lacks explicit ordering rules (e.g. "state service name first, then price, then how to book"). Occasional responses present price before service name or interleave booking instructions with service description. Accepted: conversational tone is the manner; rigid ordering rules would clash with the warm Irish persona. | [DESIGN] |

---

## 2. Summary counts

| Score | Count |
|-------|-------|
| PASS | 12 |
| PARTIAL | 9 |
| FAIL | 0 |
| N/A | 1 |

---

## 3. Biggest risk to trust (Reeves & Nass CASA)

The bot's CASA posture is strong: explicit disclosure in turn 1 (A08), no fake-human cues (A09), consent-before-collection (A12), and a functioning de-escalation ladder with register shifts (A11). The CASA framework score of 4.5/5 reflects four PASS findings and one PARTIAL (A10 -- register vs capability alignment) where the LLM's conversational warmth may imply more clinical authority than the bot actually possesses.

**The biggest remaining risk to trust** is the combination of partial slot validation (A15) and the incomplete recovery ladder for misspelled breed names (A16). A pet owner who types "my labrador needs a checkup" may receive a generic "checkup" result that does not distinguish between the Canine Health Check and a Small Mammal Wellness Examination. The bot surfaces services but does not confirm the species match. Combined with the lack of breed-name fuzzy matching, a single spelling error ("retriver" for "Retriever") produces a failed search with no "Did you mean...?" recovery step. While the bot eventually offers human handoff, the trust damage -- "the bot does not understand my pet" -- has already occurred.

**Secondary risk:** The LLM's conversational reassurances (A20 -- Gricean Quality) are unverifiable. A bot that says "our vets are brilliant, your pet will be in great hands" is warm but untruthful in the Gricean sense: it cannot know whether the vet who sees that specific pet on that specific day will deliver a brilliant experience. In a veterinary context where a worried owner is seeking reassurance, this gap between warm tone and unverifiable claim is a trust vulnerability -- albeit a low-severity one given the bot's strict domain boundary.

**Comparison to prior review:** The bot has moved from ethically suspect (pre-consent data collection in earlier builds) and structurally incomplete (broken recovery ladder) to ethically sound and largely resilient. All 22 findings are closed. No FAIL findings remain. The remaining issues are narrower than in earlier passes: slot validation is the most impactful single gap, and the misspelled-breed recovery scenario is the one failure path that does not yet reach step 2 of the recovery ladder.

---

## 4. Priority fixes (ranked by impact)

### P1 -- HIGH: Slot validation -- species disambiguation for ambiguous queries

**Impact:** Ambiguous queries like "checkup" or "vaccination" return results across species without disambiguation. A rabbit owner may see dog checkup results first.

**Change:** Add a disambiguation gate after keyword extraction: if multiple species match the query but no species was explicitly stated by the user, prompt with "Did you mean for a dog, cat, rabbit, small mammal, or bird?" and render species suggestion chips. This matches the sequential slot-filling pattern: collect species first, then search within that species scope.

### P2 -- HIGH: Recovery ladder -- breed name fuzzy matching

**Impact:** Misspelled breed names ("labrador," "retriver," "dachund") produce failed searches with no recovery. Breed-name typos are among the most common real-world input errors from pet owners.

**Change:** Add a breed-name whitelist to the keyword extraction function. When a search returns zero results and the input contains a word within Levenshtein distance 2 of a known breed, offer "Did you mean [corrected breed]?" before falling through to the empty-results recovery path.

### P3 -- MEDIUM: Gricean Quality -- tone down unverifiable LLM reassurances

**Impact:** LLM-generated reassurances ("our vets are brilliant") are warm but unverifiable. In a veterinary context, unverifiable claims erode trust when discovered.

**Change:** Add a system prompt instruction: "Do not make claims about staff quality, clinical outcomes, or pet wellbeing that you cannot verify from the service catalogue. Use phrases grounded in the data: 'we offer orthopaedic consultations' not 'our orthopaedic vets are the best.'"

### P4 -- MEDIUM: Closer -- add verbal read-back after service results

**Impact:** After a successful search, the bot does not verbally confirm what was found. Users relying on the chat panel alone (e.g. screen-reader users) must scan the discovery panel to understand the results.

**Change:** After rendering service cards, add one bot message summarising results: "I found 3 dental services for dogs, starting at 35 euro. Tap a card for details or book an appointment."

### P5 -- RESOLVED: De-escalation ladder with auto human handoff

**Status:** Deployed. Gibberish counter with 3-step de-escalation (reword, options, auto-handoff at 4+ failures). Register shifts from helpful to concerned to definitive. LLM fallback includes human path. Post-search suggestion chips offer "Keep exploring," "Book this," and "Human."

### P6 -- RESOLVED: Consent flow before localStorage

**Status:** Deployed. Explicit consent prompt (Yes/No) gates all localStorage writes. No data persisted before consent. "What I store" link visible. "Clear memory" button works irreversibly.

---

## 5. Design Quality Scorecard

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Taxonomy Coherence (Adamopoulou & Moussiades) | 3.5 / 5 | 25% | Domain, goals, channel, and human-aid are well-defined (4 PASS). Service provided and response generation have gaps (2 PARTIAL). Permissions N/A. |
| CASA Compliance (Reeves & Nass) | 4.5 / 5 | 25% | Disclosure, no fake cues, frustration handling, and consent all PASS. Only register-vs-capability is PARTIAL. Strong ethical posture. |
| Conversation Flow Anatomy | 3.0 / 5 | 25% | Opener and Intent are PASS. Slots, Recovery, Closer, and Unexpected are PARTIAL. The structural frame is sound; the gaps are in the details (breed fuzzy match, verbal read-back, slot disambiguation). |
| Gricean Maxims (Grice) | 3.0 / 5 | 25% | Quantity and Relation are PASS. Quality (LLM verifiability) and Manner (response ordering) are PARTIAL. |

### **Overall Design Quality Score: 4.0 / 5 -- Grade B**

The weighted aggregate across four frameworks: 12 PASS, 9 PARTIAL, 1 N/A, 0 FAIL. MeadowBot is a well-designed conversational agent with strong CASA ethics (disclosure, consent, de-escalation), a coherent taxonomy (domain, goals, human-aid), and a functioning recovery ladder. The remaining gaps are refinement issues (breed fuzzy matching, verbal read-back, LLM verifiability guardrails), not structural design failures. The bot has moved from "partially broken" to "well-designed with some rough edges."

---

*Keelin O'Sullivan: QA specialist and academic framework evaluator, Meadow Vet Care Chatbot project. AI colleague, designed composite, honest about both.*
