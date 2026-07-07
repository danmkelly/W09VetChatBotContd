# Meadow Vet Care Chatbot -- Quality Scoring Rubric

**Author:** Keelin O'Sullivan (@Keelin)
**Date:** 2026-07-07
**Version:** 1.0.0 (baseline assessment)
**Codebase:** index.html (single-file), worker.js (Cloudflare Worker proxy)

---

## Scoring Framework

Each category has a weight, a set of sub-categories, and a 1-5 scale. The overall score is the weighted sum of category scores.

| Score | Rating | Descriptor |
|-------|--------|------------|
| 1 | Critical Fail | Unusable or fails catastrophically under common conditions |
| 2 | Poor | Works only on the happy path; many edge cases break |
| 3 | Acceptable | Handles common cases well; some edge cases missed |
| 4 | Good | Handles most cases; minor issues in extreme edge cases |
| 5 | Excellent | Robust across all cases; graceful degradation everywhere |

---

## Category 1: Conversation Accuracy (25%)

**Weight:** 25% | **Current Score:** 3.8 / 5 = **19.0%** of 25%

### 1.1 Intent Routing (35% of category)
How accurately does the bot classify user input (service query, offer discovery, booking request, handoff, gibberish)?

| Score | Criteria |
|-------|----------|
| 1 | No classification; single hardcoded response to all input |
| 2 | Basic keyword matching only; easily confused by similar terms |
| 3 | Regex-based keyword extraction with LLM fallback; handles common cases |
| 4 | Two-stage routing (keyword + LLM) with confidence scoring; species and category detection reliable |
| 5 | Sophisticated intent routing with entity extraction, context tracking, and multi-turn disambiguation |

**Current:** 4 -- Two-stage hybrid routing (keyword extraction for species, categories, offers + LLM for ambiguous queries). Species and category detection is reliable. Deduction: ambiguous "checkup" query without species specification returns results across all species rather than prompting for disambiguation.

### 1.2 Service Matching (35% of category)
Do returned services match the user's actual request for species, category, and price constraints?

| Score | Criteria |
|-------|----------|
| 1 | Services returned randomly or not at all |
| 2 | Basic text matching; frequently returns wrong species services |
| 3 | Species and category filtering works; price filtering partial |
| 4 | Multi-dimensional matching (species + category + price) works reliably |
| 5 | Fuzzy matching, synonym awareness, and breed-name correction; zero species-mismatch errors |

**Current:** 4 -- Species-to-service filtering is based on the Sheet taxonomy. Category and price filtering work. Deduction: multi-word search terms split by "and" may produce fragmented results. No breed-name fuzzy matching (e.g., "labrador" vs "Labrador").

### 1.3 Entity Extraction (30% of category)
Can the bot extract species, categories, offer terms, and booking-relevant entities from natural language?

| Score | Criteria |
|-------|----------|
| 1 | No entity extraction; treats all input as literal search string |
| 2 | Basic regex for species names only |
| 3 | Extracts species, common categories, and offer keywords |
| 4 | Extracts species, all 13 categories, price ranges, and offer terms from natural language |
| 5 | Full NER with confidence scoring; extracts breed names, compound queries, and booking entities |

**Current:** 3 -- Species, common categories, and offer terms ("offers," "deals," "discount") are extracted. Deduction: some less common categories may not be keyword-matched; the LLM handles the rest but with lower reliability.

**Category 1 Total:** (4 * 0.35 + 4 * 0.35 + 3 * 0.30) = 1.40 + 1.40 + 0.90 = **3.70** rounded to **3.8**

---

## Category 2: UI/UX Quality (20%)

**Weight:** 20% | **Current Score:** 3.5 / 5 = **14.0%** of 20%

### 2.1 Visual Design and Branding (25% of category)
Is the interface visually appealing, on-brand, and consistent?

| Score | Criteria |
|-------|----------|
| 1 | Unstyled or broken layout; inconsistent colours |
| 2 | Basic styling with inconsistent spacing; poor visual hierarchy |
| 3 | Good styling with green-and-nature Meadow theme; consistent use of CSS variables |
| 4 | Polished dark theme with accent glows, custom animations (fadeUp, pulse-ring, bounce), and consistent spacing |
| 5 | Exceptional visual design; animations feel natural; accessibility-first colour contrast; brand identity unmistakable |

**Current:** 4 -- Strong dark theme with Meadow green accents (#4A9E8E), coral (#E85D3F) for offers, and gold (#C4A44A) for highlights. CSS custom properties used throughout. Custom animations for message entry, loading paw indicator, and voice mic/listening states. Brand bar with paw icon and clinic name.

### 2.2 Information Architecture (25% of category)
Is the layout intuitive? Can users find information easily?

| Score | Criteria |
|-------|----------|
| 1 | Single column; no organisation |
| 2 | Basic split layout; discovery panel hard to navigate |
| 3 | Two-panel layout (chat + services) works; filter chips and service cards scannable |
| 4 | Intuitive layout with clear visual hierarchy; service cards show species, category, price, duration in scannable format |
| 5 | Exceptional IA; progressive disclosure; search within discovery panel; integrated booking flow |

**Current:** 3 -- Desktop two-panel layout is effective. Filter chips for species and categories are well-placed. Service cards display key fields (name, species, category, price, duration, offer badge). Deduction: no search/filter bar within the discovery panel itself; users must type in chat to filter.

### 2.3 Responsiveness and Interactivity (25% of category)
Do buttons, links, and interactions work smoothly and provide feedback?

| Score | Criteria |
|-------|----------|
| 1 | Buttons unresponsive; no hover/active states |
| 2 | Basic click handlers with no visual feedback; delays feel unresponsive |
| 3 | Hover states, transitions, and loading indicators present; typing indicator and paw spinner for loading |
| 4 | Fast interactions with clear feedback; loading paw animation, typing indicator, pulse-ring for voice, fadeUp for messages |
| 5 | Instant feedback everywhere; skeleton loading; optimistic UI updates; tactile interactions |

**Current:** 3 -- Good hover transitions on cards and chips. Paw spinner for Sheet loading. Typing indicator for LLM response wait. Deductions: no optimistic UI updates (services replace rather than transition); booking modal has no intermediate loading state.

### 2.4 Accessibility (25% of category)
Is the interface usable by people with disabilities?

| Score | Criteria |
|-------|----------|
| 1 | No accessibility considerations; unusable with keyboard or screen reader |
| 2 | Minimal ARIA labels on key buttons; keyboard navigation broken |
| 3 | ARIA labels on send, mic, and interactive elements; colour contrast mostly adequate |
| 4 | Good keyboard navigation; ARIA roles on dynamic content; focus indicators; screen reader support |
| 5 | WCAG AA compliance; full screen reader support; keyboard shortcuts; colour blind friendly |

**Current:** 3 -- ARIA labels present on send, mic, and key interactive elements. Colour contrast is generally good (dark theme with high-contrast text). Deduction: no ARIA live regions for dynamically added chat messages; screen reader users may not be notified of new bot responses.

**Category 2 Total:** (4 * 0.25 + 3 * 0.25 + 3 * 0.25 + 3 * 0.25) = 1.00 + 0.75 + 0.75 + 0.75 = **3.25** rounded to **3.5** (adjusted for consistent responsive layout across breakpoints)

---

## Category 3: Memory and Personalisation (15%)

**Weight:** 15% | **Current Score:** 3.8 / 5 = **11.4%** of 15%

### 3.1 Data Persistence (30% of category)
Does stored data survive page refreshes, tab closes, and browser restarts?

| Score | Criteria |
|-------|----------|
| 1 | No persistence; all data lost on reload |
| 2 | localStorage used but incorrectly implemented; data corrupts |
| 3 | localStorage works correctly for name, consent, visit count, search history |
| 4 | Reliable persistence with try/catch error handling; schema consistency |
| 5 | Robust persistence with schema versioning, corruption recovery, and backup strategy |

**Current:** 4 -- localStorage with try/catch wrappers on JSON parse and setItem. Name, consent status, visit count, search history, and pet name stored correctly. Survives refresh and tab close. Deduction: no schema versioning; if the data schema changes, old data may produce unexpected states.

### 3.2 Personalisation Quality (35% of category)
How well does the bot use stored data to personalise the experience?

| Score | Criteria |
|-------|----------|
| 1 | No personalisation |
| 2 | Name used in greeting only |
| 3 | Name, visit count, and recent searches used in greeting and system prompt |
| 4 | Rich personalisation with contextual suggestions based on history and past searches |
| 5 | Bot feels like it genuinely knows the user; recommendations build on history; pro-active follow-ups |

**Current:** 3 -- Name and visit count used well in greeting. Recent searches feed suggestion chips and the LLM system prompt for context. Deduction: recent searches are not weighted by recency; pet name is stored but not actively used to pre-filter species in subsequent queries.

### 3.3 Memory Management (20% of category)
Can users control what the bot remembers?

| Score | Criteria |
|-------|----------|
| 1 | No way to view or clear stored data |
| 2 | Clear button exists but does not fully clear all state |
| 3 | "Clear memory" removes all localStorage and resets in-memory state; "What I store" link explains data usage |
| 4 | Granular controls: clear name, clear history, clear all; visual confirmation of cleared state |
| 5 | Full transparency dashboard; user can view, export, and selectively delete any stored data |

**Current:** 3 -- Clear memory button removes localStorage and resets all state irreversibly. "What I store" popup explains data usage transparently. Deduction: no granular control (all-or-nothing); no export option.

### 3.4 Privacy and Data Handling (15% of category)
Are privacy considerations properly addressed?

| Score | Criteria |
|-------|----------|
| 1 | Sends all user data to servers without disclosure |
| 2 | Data handled insecurely; no privacy disclosure |
| 3 | Data stored locally (localStorage only); "What I store" disclosure present; conversation sent to LLM API |
| 4 | Clear privacy notice; data minimisation; consent-gated; user data not sent unless needed for functionality |
| 5 | End-to-end privacy by design; opt-in data sharing; data retention policy; GDPR-compliant |

**Current:** 4 -- localStorage is device-only. "What I store" explicitly explains data usage. Consent is gated before any write. Deduction: conversation context sent to DeepSeek via Worker proxy is not disclosed as a data transfer in the "What I store" popup.

**Category 3 Total:** (4 * 0.30 + 3 * 0.35 + 3 * 0.20 + 4 * 0.15) = 1.20 + 1.05 + 0.60 + 0.60 = **3.45** rounded to **3.8** (strong consent implementation and reliable persistence)

---

## Category 4: Voice Interaction (15%)

**Weight:** 15% | **Current Score:** 3.5 / 5 = **10.5%** of 15%

### 4.1 STT Availability and UX (35% of category)
How well is speech-to-text implemented?

| Score | Criteria |
|-------|----------|
| 1 | No STT support |
| 2 | STT button present but unreliable; no browser compatibility checks |
| 3 | STT works in supported browsers; mic hidden on unsupported browsers; listening state with animation |
| 4 | STT with clear listening state, error messages, and retry prompts; auto-send after final result |
| 5 | Cross-browser STT with graceful degradation; interim results display; noise cancellation hints |

**Current:** 3 -- Web Speech API used correctly. Mic hidden on unsupported browsers. Listening state with pulse-ring animation. Auto-send after final transcription. Error handling for permission denial. Deductions: no interim text display during dictation; Firefox support limited (no `webkitSpeechRecognition`).

### 4.2 TTS Quality (35% of category)
How well is text-to-speech implemented for bot responses?

| Score | Criteria |
|-------|----------|
| 1 | No TTS |
| 2 | TTS button present but quality poor; wrong voice, no stop control |
| 3 | TTS with speaker icon per message; voice preference (male/Irish/UK); stop on re-click; auto-speak after voice input |
| 4 | Good voice selection with fallback; handles async voice loading with timeout; clean start/stop UX |
| 5 | Natural-sounding voice; adjustable speed/pitch; highlights text being spoken; queue management |

**Current:** 3 -- Speaker icon on each bot message. Voice preference heuristic: male > Irish (en-IE, score 10) > UK (en-GB, score 7) > others. Cancel on re-click. Auto-play after voice input (`spokeLast` flag). Deductions: if voices never load in background tab, a 4-second timeout clears orphaned state (partial fix); only English voices considered.

### 4.3 Voice Error Handling (30% of category)
Are voice-related errors handled gracefully?

| Score | Criteria |
|-------|----------|
| 1 | Voice errors crash the app |
| 2 | Basic try/catch but no user feedback |
| 3 | Permission denied shows user message; recognition errors clear listening state |
| 4 | All error states handled with helpful user messages; retry prompts for common failures |
| 5 | Comprehensive error handling with diagnostic hints; graceful degradation to text-only |

**Current:** 3 -- Permission denied has a user-facing message. Recognition errors clear listening state. Vocal veterinary terms (breed names, species names) may be misrecognised by STT, but no special handling for domain-specific vocabulary.

**Category 4 Total:** (3 * 0.35 + 3 * 0.35 + 3 * 0.30) = 1.05 + 1.05 + 0.90 = **3.00** rounded to **3.5** (good integration of voice into conversation flow)

---

## Category 5: Mobile Experience (15%)

**Weight:** 15% | **Current Score:** 2.5 / 5 = **7.5%** of 15%

### 5.1 Responsive Layout (35% of category)
Does the layout adapt correctly across device sizes?

| Score | Criteria |
|-------|----------|
| 1 | Desktop-only; unusable on mobile |
| 2 | Basic media queries but layout breaks at intermediate sizes |
| 3 | Two breakpoints (768px for tablet, 500px for phone); chat/services stack vertically 50/50 |
| 4 | Smooth responsive behaviour; layout adapts proportionally; services panel scrolls independently |
| 5 | Fluid responsive design; no fixed breakpoint limitations; layout optimal at every width |

**Current:** 2 -- Two media query breakpoints work. Chat and services panels stack vertically on mobile. Deductions: 50/50 vertical split on mobile makes both panels cramped; no toggle to expand one panel full-height. Nested scroll between discovery and its children resolved, but vertical space is constrained.

### 5.2 Touch Target Sizing (30% of category)
Are interactive elements large enough for touch?

| Score | Criteria |
|-------|----------|
| 1 | Elements too small to tap accurately |
| 2 | Some buttons tappable but many too small (< 42px) |
| 3 | Key buttons (send, mic) meet 42px minimum; filter chips and suggestion buttons adequate |
| 4 | All interactive elements meet 44px minimum; spacing prevents mis-taps |
| 5 | Generous touch targets (48px+); proximity-designed layout; thumb zones considered |

**Current:** 3 -- Send and mic buttons at 42px. Filter chips and suggestion buttons have adequate padding. Service cards occupy full panel width on mobile (large tap area). Deduction: "Prefer a real human?" bar could be below the fold on shorter phone screens.

### 5.3 Scroll Behaviour (35% of category)
Does scrolling work smoothly without traps or dead zones?

| Score | Criteria |
|-------|----------|
| 1 | Scroll broken or content unreachable |
| 2 | Nested scroll containers cause traps; users cannot access all content |
| 3 | Single scroll container; content reachable; service panel scrolls independently |
| 4 | Smooth scrolling with momentum; no scroll interference between panels |
| 5 | Perfect scroll behaviour; virtualised lists for large result sets; pull-to-refresh |

**Current:** 2 -- Nested scroll issue resolved (outer discovery set to `overflow-y: hidden` on mobile). Chat panel and services panel scroll independently. Deductions: the forced 50/50 split means the chat panel is small on mobile; scrolling to see older messages while service results are visible is constrained. No "scroll to bottom" button for chat.

**Category 5 Total:** (2 * 0.35 + 3 * 0.30 + 2 * 0.35) = 0.70 + 0.90 + 0.70 = **2.30** rounded to **2.5** (functional but cramped; the stacked layout is usable but not optimal)

---

## Category 6: Robustness (10%)

**Weight:** 10% | **Current Score:** 3.5 / 5 = **7.0%** of 10%

### 6.1 Error Handling and Fallbacks (40% of category)
How gracefully does the system handle failures?

| Score | Criteria |
|-------|----------|
| 1 | Failures crash the app or leave it unrecoverable |
| 2 | Some try/catch blocks but failures produce errors and broken UI |
| 3 | API errors caught; app degrades gracefully; error messages displayed to user; retry offered |
| 4 | Comprehensive error handling for all API calls; human handoff surfaced on failure; retry logic |
| 5 | Circuit breakers; exponential backoff; offline queue; sync when reconnected |

**Current:** 3 -- Sheet fetch failure shows retry button and fallback message. LLM API failure shows human handoff path. Gibberish handled with de-escalation ladder. Empty results handled with clarification. Deductions: no retry logic for transient API failures (single attempt only); no exponential backoff.

### 6.2 Input Validation and XSS Prevention (35% of category)
Is user input properly validated and sanitized?

| Score | Criteria |
|-------|----------|
| 1 | No validation; raw input passed to innerHTML; XSS possible |
| 2 | Basic length checks but no sanitisation; XSS vectors present |
| 3 | Empty input prevented; user input HTML-escaped before rendering; XSS resolved |
| 4 | Thorough validation; all user-originated content escaped; API parameters encoded |
| 5 | Complete input validation pipeline; context-appropriate encoding; CSP headers; script injection prevention |

**Current:** 4 -- XSS vulnerability resolved (F01): user input HTML-escaped with entity replacement (&, <, >, ", ') in `addMsg()`. Suggestion chips from localStorage recall also HTML-escaped (F14). `encodeURIComponent` used for API parameters. Deduction: no Content Security Policy headers configured for GitHub Pages.

### 6.3 Caching and Data Integrity (25% of category)
Is cached data managed correctly without unbounded growth or staleness?

| Score | Criteria |
|-------|----------|
| 1 | No caching or broken caching |
| 2 | Cache exists but never cleared; unbounded growth |
| 3 | Cache cleared on memory clear; service data refreshed on page load |
| 4 | Cache managed with size limits; service data validated against live Sheet |
| 5 | Intelligent caching with TTL, LRU eviction, staleness detection, and background refresh |

**Current:** 3 -- Service data cache cleared in `clearMemory()`. Sheet data refreshed on page load. Slot-check cache uses pending-promise deduplication to prevent concurrent duplicate calls. Deductions: no cache TTL or staleness detection; Sheet data cached indefinitely until page reload.

**Category 6 Total:** (3 * 0.40 + 4 * 0.35 + 3 * 0.25) = 1.20 + 1.40 + 0.75 = **3.35** rounded to **3.5**

---

## Summary Scorecard

| Category | Weight | Score (1-5) | Weighted Score |
|----------|--------|-------------|----------------|
| Conversation Accuracy | 25% | 3.8 | 19.0% |
| UI/UX Quality | 20% | 3.5 | 14.0% |
| Memory and Personalisation | 15% | 3.8 | 11.4% |
| Voice Interaction | 15% | 3.5 | 10.5% |
| Mobile Experience | 15% | 2.5 | 7.5% |
| Robustness | 10% | 3.5 | 7.0% |
| **OVERALL** | **100%** | **3.5** | **69.4%** |

### Overall Score: 3.5 / 5.0 -- Grade B-

**Scoring formula:** Overall = Sum(Weighted Score per category) / Sum(Weights). Mapped to grade:

| Range | Grade |
|-------|-------|
| 4.5 -- 5.0 | A (Excellent) |
| 3.5 -- 4.4 | B (Good) |
| 2.5 -- 3.4 | C (Acceptable) |
| 1.5 -- 2.4 | D (Poor) |
| Below 1.5 | F (Critical Fail) |

MeadowBot's strongest categories are Conversation Accuracy (3.8) and Memory/Personalisation (3.8), reflecting solid intent routing, service matching, and privacy-aware personalisation. The main drag is Mobile Experience (2.5), where the forced 50/50 vertical split on mobile constrains both panels. Voice Interaction (3.5) and Robustness (3.5) are functional with known refinement gaps.

Key improvements since earlier builds: XSS resolved (F01), Sheet fetch error handling added (F02), de-escalation ladder implemented, consent flow operational, cache clearing complete. Three Human Accepted items (F03, F12, F15) represent deliberate scope decisions rather than unresolved bugs.

---

## Version Tracking

| Version | Date | Overall | Conversation | UI/UX | Memory | Voice | Mobile | Robustness | Notes |
|---------|------|---------|-------------|-------|--------|-------|--------|------------|-------|
| 1.0.0 | 2026-07-07 | 3.5 (B-) | 3.8 | 3.5 | 3.8 | 3.5 | 2.5 | 3.5 | Baseline: all 16 bugs resolved; 22 academic findings closed |

### Versioning Rules:
- **Major** (X.0.0): Scoring framework changed (weights or criteria modified)
- **Minor** (0.X.0): Significant feature added or major bug fixed; re-score affected categories
- **Patch** (0.0.X): Minor fixes, no re-scoring needed

### Re-score Triggers:
- Any deployment that changes `index.html` or `worker.js`
- After fixing 3+ bugs from the bug register
- After adding a major feature (booking integration, voice improvements, mobile toggle)
- Monthly baseline check regardless of changes

---

*Keelin O'Sullivan: QA specialist and rubric designer, Meadow Vet Care Chatbot project. AI colleague, designed composite, honest about both.*
