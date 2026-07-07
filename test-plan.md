# Meadow Vet Care Chatbot -- Automated Test Plan

**Author:** Keelin O'Sullivan (@Keelin)
**Date:** 2026-07-07
**Version:** 1.0.0
**Codebase:** index.html (single-file, HTML/CSS/JS inline), worker.js (Cloudflare Worker proxy)

---

## Test Environment

- Headless browser: Playwright (Chromium), with Firefox fallback for Web Speech API variance
- Viewport presets: 1440x900 (desktop), 768x1024 (tablet), 375x667 (mobile)
- localStorage pre-seeding required for memory tests
- Network mocking needed for API failure tests (Sheet CSV fetch, DeepSeek Worker proxy)
- Voice STT/TTS: mock `window.SpeechRecognition` and `window.speechSynthesis` where unavailable
- Google Sheet test data: clone of Meadow Vet Care services CSV cached for offline comparison

---

## 1. Greeting Flow

### TEST-001: MeadowBot introduces itself on first visit
- **Category:** Conversation Flow
- **Description:** Verify MeadowBot sends the welcome sequence when no prior memory exists.
- **Steps:**
  1. Clear localStorage (`localStorage.clear()`)
  2. Load page
  3. Observe chat messages
- **Expected behaviour:** Bot messages appear in sequence: (1) self-identification as AI chatbot with capabilities listed, (2) consent question ("Would you like me to remember you? Yes or No."), (3) capability summary. MeadowBot label does not show a known name.
- **Severity:** High
- **Automated verification:**
  - Assert `document.querySelectorAll(".msg.bot").length >= 3`
  - Assert first bot message contains "I'm MeadowBot" and "AI chatbot"
  - Assert bot label does not contain "knows"
  - Assert consent prompt visible ("remember" and "Yes or No")

### TEST-002: MeadowBot asks for name after consent
- **Category:** Conversation Flow
- **Description:** Verify the name-collection flow triggers after positive consent.
- **Steps:**
  1. Clear localStorage, load page, wait for consent prompt
  2. Type "Yes" and send
  3. Observe next bot message
- **Expected behaviour:** After "Yes," bot replies acknowledging consent and asking "What should I call you?" `expectingName` flag set to true.
- **Severity:** High
- **Automated verification:**
  - Assert bot response contains "What should I call you?"
  - Evaluate: `window.expectingName === true`
  - Assert `localStorage.getItem("meadow_memory")` contains `consent: "yes"`

### TEST-003: MeadowBot greets returning user by name
- **Category:** Conversation Flow / Memory
- **Description:** Verify the bot recognises a previously named user on return visit.
- **Steps:**
  1. Pre-seed localStorage: `meadow_memory = {"visits":2,"userName":"Keelin","consent":"yes","recentSearches":["dental","rabbit vaccination"]}`
  2. Load page
- **Expected behaviour:** First bot message: "Welcome back, Keelin! Great to see you again." Suggestion chips include recent search terms. Bot label shows "knows Keelin."
- **Severity:** High
- **Automated verification:**
  - Assert first bot message contains "Welcome back" and "Keelin"
  - Assert `document.querySelectorAll(".chat-sugg-btn").length >= 3`
  - Assert bot label text contains "knows Keelin"

### TEST-004: Name capture rejects non-name input
- **Category:** Conversation Flow / Edge Cases
- **Description:** Verify that multi-word sentences are not captured as a name.
- **Steps:**
  1. Clear localStorage, load page, accept consent, wait for name prompt
  2. Type "I need to book a dog vaccination" and send
- **Expected behaviour:** Name is NOT stored. Input goes through normal service query processing. `meadowMemory.userName` remains empty or unchanged.
- **Severity:** Medium
- **Automated verification:**
  - Evaluate: `JSON.parse(localStorage.getItem("meadow_memory")).userName === ""`
  - Assert service query processing triggered (service cards rendered or bot responds with service information)

---

## 2. Service Queries

### TEST-005: Service query by category ("dental services")
- **Category:** Service Discovery
- **Description:** Verify a category-based query returns matching services.
- **Steps:**
  1. Type "What dental services do you offer?" and send
  2. Observe discovery panel
- **Expected behaviour:** Discovery panel loads with dental services. Bot messages summarise findings. Service cards show services with "Dental" category. Cards include name, species, price, and bookability.
- **Severity:** Critical
- **Automated verification:**
  - Assert `document.querySelectorAll(".service-card").length > 0`
  - Assert at least one card text contains "Dental" or dental-related service name
  - Assert no console errors during fetch
  - Assert `document.getElementById("discLoading")` is not active after results load

### TEST-006: Service query by species ("rabbit services")
- **Category:** Service Discovery
- **Description:** Verify species-filtered search returns only services applicable to that species.
- **Steps:**
  1. Type "What services do you offer for rabbits?" and send
  2. Inspect all returned service cards
- **Expected behaviour:** All returned services are applicable to rabbits. No dog-only or cat-only services appear. Cards show rabbit-appropriate prices and descriptions.
- **Severity:** Critical
- **Automated verification:**
  - Assert all `document.querySelectorAll(".service-card")` contain rabbit-applicable data
  - Assert result count > 0
  - Assert no service appears that is species-incompatible (e.g. canine-only dental)

### TEST-007: Service query by price range ("services under 50 euro")
- **Category:** Service Discovery
- **Description:** Verify price-filtered search returns services within the stated range.
- **Steps:**
  1. Type "services under 50 euro" and send
  2. Inspect returned service card prices
- **Expected behaviour:** All returned services have prices at or below 50 euro. No services above 50 euro displayed.
- **Severity:** High
- **Automated verification:**
  - Assert all visible service cards show prices <= 50
  - Assert result count > 0

### TEST-008: Combined query ("dental for dogs under 80 euro")
- **Category:** Service Discovery
- **Description:** Verify multi-dimensional search (species + category + price) works correctly.
- **Steps:**
  1. Type "dental for dogs under 80 euro" and send
  2. Inspect results
- **Expected behaviour:** Results show only dental services for dogs priced under 80 euro. No cat dental or dog non-dental services appear.
- **Severity:** High
- **Automated verification:**
  - Assert all cards show "Dental" category or dental service names
  - Assert all cards are species-applicable to dogs
  - Assert all cards show prices < 80
  - Assert result count > 0

### TEST-009: Ambiguous query ("checkup")
- **Category:** Service Discovery / Edge Cases
- **Description:** Verify the bot handles an ambiguous query without species specification.
- **Steps:**
  1. Type "checkup" and send
- **Expected behaviour:** Bot returns checkup/consultation services across applicable species. Alternatively, bot prompts for disambiguation ("Did you mean for a dog, cat, or rabbit?"). No crash, no empty results without explanation.
- **Severity:** Medium
- **Automated verification:**
  - Assert bot response is non-empty
  - Assert either service cards shown, OR disambiguation prompt appears
  - Assert no console errors

---

## 3. Special Offers

### TEST-010: Find offers by species ("offers on microchipping for dogs")
- **Category:** Offer Discovery
- **Description:** Verify special offer detection and filtering returns the correct discounted services.
- **Steps:**
  1. Type "Are there any offers on microchipping for dogs?" and send
  2. Inspect results
- **Expected behaviour:** Results show microchipping services for dogs with special offer pricing or badges. Offer discount is visible on the service card.
- **Severity:** High
- **Automated verification:**
  - Assert at least one service card contains an offer badge or discounted price indicator
  - Assert service cards reference microchipping and dogs
  - Assert keyword extraction mapped "offers" and "microchipping" correctly

### TEST-011: Find all current offers
- **Category:** Offer Discovery
- **Description:** Verify the bot surfaces all active special offers from the live sheet.
- **Steps:**
  1. Type "What special offers are available?" and send
- **Expected behaviour:** Bot returns a list of all services with active special offers from the Sheet. Results match the live Sheet's offer data exactly.
- **Severity:** High
- **Automated verification:**
  - Assert result count matches the number of offers in the live CSV
  - Assert all returned services have non-empty offer/discount fields in the Sheet data

### TEST-012: Offer with price comparison
- **Category:** Offer Discovery
- **Description:** Verify the bot displays both the standard price and the offer price.
- **Steps:**
  1. Type "How much is the microchipping offer?" and send
- **Expected behaviour:** Bot response includes both standard price and discounted offer price. The discount or saving is clearly communicated.
- **Severity:** Medium
- **Automated verification:**
  - Assert bot message text contains two price values or a discount percentage
  - Assert offer badge or indicator visible on the relevant service card

---

## 4. Booking Flow

### TEST-013: Calendar modal opens on booking request
- **Category:** Booking
- **Description:** Verify the booking calendar modal opens when a user requests an appointment.
- **Steps:**
  1. Type "I want to book a dog checkup" and send
  2. Click "Book this" suggestion chip or equivalent booking trigger
- **Expected behaviour:** Booking modal opens with a day picker visible. Modal shows "Book an Appointment" or similar title. Overlay covers the background.
- **Severity:** Critical
- **Automated verification:**
  - Assert `document.getElementById("bookModal").classList.contains("open")`
  - Assert day picker elements are visible
  - Assert modal title visible

### TEST-014: Day selection in booking calendar
- **Category:** Booking
- **Description:** Verify clicking a day in the calendar selects it and advances the flow.
- **Steps:**
  1. Open booking modal
  2. Click an available day button
- **Expected behaviour:** Selected day highlights visually. Time slot selector becomes visible. Unavailable days are greyed out and non-clickable.
- **Severity:** High
- **Automated verification:**
  - Click a `.day-btn` element
  - Assert clicked button has "selected" or "active" class
  - Assert time slot section becomes visible
  - Assert unavailable days are not clickable (`disabled` attribute or `pointer-events: none`)

### TEST-015: Time slot selection
- **Category:** Booking
- **Description:** Verify clicking a time slot selects it and advances the flow to the form.
- **Steps:**
  1. Open booking modal, select a day
  2. Click an available time slot button
- **Expected behaviour:** Selected time highlights. Form fields (client name, pet name, pet species, phone) become visible. The slot reflects clinic opening hours: Mon-Fri 08:00-19:00, Sat 09:00-17:00, Sun 10:00-14:00.
- **Severity:** High
- **Automated verification:**
  - Click a `.time-btn` element
  - Assert clicked button has "selected" or "active" class
  - Assert form section becomes visible (input fields for name, pet, phone)
  - Assert no slots outside clinic hours are offered

### TEST-016: Booking form submit
- **Category:** Booking
- **Description:** Verify the booking form submits and shows a confirmation.
- **Steps:**
  1. Complete day and time selection
  2. Fill form: client name ("Keelin"), pet name ("Max"), pet species ("Dog"), phone ("0871234567")
  3. Click "Confirm Booking" or submit button
- **Expected behaviour:** Confirmation message appears with booking summary. Modal closes, and a summary appears in the chat. Booking details include service, day, time, and pet name.
- **Severity:** Critical
- **Automated verification:**
  - Assert confirmation message visible with booking details
  - Assert chat message added with booking summary
  - Assert modal eventually closes (or confirmation replaces form)
  - Assert all filled fields appear in confirmation

---

## 5. Sheet Data Loading

### TEST-017: Successful Google Sheets CSV fetch and render
- **Category:** Data Integration
- **Description:** Verify the live CSV fetches successfully and populates the backend data store.
- **Steps:**
  1. Load page with live Sheet URL
  2. Wait for fetch to complete
  3. Trigger a service query
- **Expected behaviour:** Services are fetched and parsed from the CSV. The full 94 services across 13 categories are available. Service queries return results from the live data.
- **Severity:** Critical
- **Automated verification:**
  - Verify network call to `docs.google.com/spreadsheets/.../export?format=csv` succeeds (status 200)
  - Evaluate that internal service array length >= 90
  - Assert service query returns results from the fetched data (not empty)

### TEST-018: Cache reuse on subsequent queries
- **Category:** Data Integration
- **Description:** Verify the Sheet data is cached after first fetch and reused for subsequent queries.
- **Steps:**
  1. Load page, wait for initial fetch
  2. Trigger a service query and note fetch count
  3. Trigger a second query
- **Expected behaviour:** The Google Sheets CSV is fetched once. Subsequent queries use the cached data. No additional network call to the Sheet URL on the second query.
- **Severity:** Medium
- **Automated verification:**
  - Count network calls to `docs.google.com/spreadsheets` -- assert count <= 1 after second query
  - Assert service results render from cache on second query

### TEST-019: Sheet fetch failure -- graceful degradation
- **Category:** Data Integration / Robustness
- **Description:** Verify the bot handles Sheet fetch failure gracefully.
- **Steps:**
  1. Block or mock the Google Sheets CSV URL to return 500
  2. Load page
- **Expected behaviour:** Bot displays a visible error message indicating services could not be loaded. A retry button is offered. Chat functionality (LLM conversation) continues to work for non-service queries. The bot does not crash.
- **Severity:** Critical
- **Automated verification:**
  - Mock fetch to Sheet URL to return `{ok: false, status: 500}`
  - Assert error message visible on page
  - Assert retry button or fallback text present
  - Assert no uncaught exceptions
  - Assert chat input still functional

---

## 6. Human Handoff

### TEST-020: Typing "human" triggers full contact details
- **Category:** Conversation Flow
- **Description:** Verify the "human" keyword returns clinic contact information.
- **Steps:**
  1. Type "human" and send
- **Expected behaviour:** Bot returns clinic contact details including: address (14 Greenfield Road, Dublin 6, D06 VX92), phone (+353 1 800 5555), emergency (+353 1 800 9999), email (hello@meadowvetcare.ie), and opening hours (Mon-Fri 08:00-19:00, Sat 09:00-17:00, Sun 10:00-14:00). Email is a clickable `mailto:` link.
- **Severity:** Critical
- **Automated verification:**
  - Assert bot message contains "14 Greenfield Road" and "D06 VX92"
  - Assert bot message contains "+353 1 800 5555"
  - Assert bot message contains "+353 1 800 9999"
  - Assert bot message contains "hello@meadowvetcare.ie"
  - Assert opening hours text present
  - Assert email link has `href` starting with `mailto:`

### TEST-021: Ramp bar click triggers handoff
- **Category:** UI/UX
- **Description:** Verify the persistent "Prefer a real human?" bar triggers the same handoff as typing "human."
- **Steps:**
  1. Click the `.chat-human-ramp` bar at the bottom of chat
- **Expected behaviour:** Chat input fills with "human." Send is triggered. Same contact detail messages appear as TEST-020.
- **Severity:** Medium
- **Automated verification:**
  - Click `.chat-human-ramp`
  - Assert input value becomes "human" (before auto-send)
  - After send: assert same contact verification as TEST-020

---

## 7. Memory / Persistence

### TEST-022: Consent flow -- "no" prevents all storage
- **Category:** Memory
- **Description:** Verify that declining consent prevents any localStorage writes.
- **Steps:**
  1. Clear localStorage, load page
  2. When consent prompt appears, type "No" and send
  3. Check localStorage and observe behaviour
- **Expected behaviour:** `meadow_memory.consent` is "no." No name is stored. No search history is stored. On subsequent interactions, no data is persisted. On page reload, user is treated as new visitor.
- **Severity:** Critical
- **Automated verification:**
  - Evaluate: `JSON.parse(localStorage.getItem("meadow_memory")).consent === "no"`
  - Assert `meadow_memory.userName` is empty
  - Reload page; assert `meadow_memory.visits` is reset or 1

### TEST-023: Name is stored and survives page refresh
- **Category:** Memory
- **Description:** Verify the client's name persists across page reloads when consent is given.
- **Steps:**
  1. Accept consent, provide name "Keelin"
  2. Trigger a service search
  3. Reload page
- **Expected behaviour:** After reload, `meadow_memory.userName === "Keelin"`. Bot greets with "Welcome back, Keelin." Search history preserved.
- **Severity:** Critical
- **Automated verification:**
  - Before reload: evaluate `JSON.parse(localStorage.getItem("meadow_memory")).userName === "Keelin"`
  - After reload: evaluate same, assert still "Keelin"
  - Assert first bot message after reload contains "Keelin"

### TEST-024: Clear memory button works irreversibly
- **Category:** Memory
- **Description:** Verify the "Clear memory" button removes all localStorage data and resets state.
- **Steps:**
  1. Set up memory with name, consent, visit count, and search history
  2. Click "Clear memory" button
  3. Check localStorage and UI state
- **Expected behaviour:** `localStorage.getItem("meadow_memory")` returns null. Bot sends confirmation message ("All clear!"). Bot label resets to default (no name shown). `expectingName` becomes true.
- **Severity:** High
- **Automated verification:**
  - Click clear-memory button
  - Assert `localStorage.getItem("meadow_memory")` is null
  - Assert bot message contains "clear" or "forgotten" or "All clear"
  - Assert bot label does not contain "knows"
  - Evaluate: `window.expectingName === true`

### TEST-025: Return visit without consent resets counters
- **Category:** Memory / Edge Cases
- **Description:** Verify that a user who did not consent is treated as new on every return.
- **Steps:**
  1. Clear localStorage, load page, respond "No" to consent
  2. Perform a service search
  3. Reload page
- **Expected behaviour:** On reload, visit count is reset. No name stored. No search history remembered. The consent prompt reappears. The bot treats them as a new visitor.
- **Severity:** Medium
- **Automated verification:**
  - After reload: evaluate `JSON.parse(localStorage.getItem("meadow_memory")).consent === "no"`
  - Assert `meadow_memory.recentSearches` is empty
  - Assert `meadow_memory.visits` is 1 (not incremented from prior visit)
  - Assert consent prompt appears again

---

## 8. Voice STT (Speech-to-Text)

### TEST-026: Microphone activation and listening state
- **Category:** Voice
- **Description:** Verify the microphone button toggles listening state correctly.
- **Steps:**
  1. Load page in a browser supporting Web Speech API (Chromium)
  2. Click mic button
  3. Click mic button again
- **Expected behaviour:** First click: mic button gets "listening" class with animation. Speech recognition starts. Second click: "listening" class removed. Recognition stops.
- **Severity:** High
- **Automated verification:**
  - Click `.chat-mic`: assert button has "listening" class
  - Verify recognition start called (spy on mock `SpeechRecognition.start`)
  - Click again: assert "listening" absent, verify stop called
  - In unsupported browser: assert mic button hidden (`display: none`)

### TEST-027: STT transcription populates input and auto-sends
- **Category:** Voice
- **Description:** Verify speech recognition results fill the chat input and trigger auto-send.
- **Steps:**
  1. Click mic button
  2. Simulate speech recognition result: "dog dental services"
- **Expected behaviour:** `chatInput.value` set to "dog dental services." `spokeLast` flag set to true. Auto-send triggered. Mic loses listening class. Bot response generation starts.
- **Severity:** High
- **Automated verification:**
  - Simulate recognition `onresult` with transcript "dog dental services"
  - Assert `document.getElementById("chatInput").value === "dog dental services"`
  - Assert `window.spokeLast === true`
  - Assert send triggered (user message visible in chat)
  - Assert mic "listening" class absent

---

## 9. Voice TTS (Text-to-Speech)

### TEST-028: Speaker icon on bot messages triggers TTS playback
- **Category:** Voice
- **Description:** Verify clicking the speaker icon on a bot message reads text aloud.
- **Steps:**
  1. Trigger a bot message (e.g. service query response)
  2. Click speaker icon on the bot message
- **Expected behaviour:** `speechSynthesis.speak()` called with bot message text. Speaker button gets "speaking" class with pulse animation. A male, Irish, or UK voice is preferred.
- **Severity:** High
- **Automated verification:**
  - Spy on `window.speechSynthesis.speak`
  - Click `.msg-speak`: assert `speak()` was called
  - Assert button has "speaking" class
  - Verify selected voice is not in female-names filter list

### TEST-029: Clicking speaker icon again cancels TTS
- **Category:** Voice
- **Description:** Verify that re-clicking a speaking speaker button cancels speech.
- **Steps:**
  1. Click speaker icon (start TTS)
  2. Click same speaker icon again
- **Expected behaviour:** `speechSynthesis.cancel()` called. "speaking" class removed from all buttons. Speech stops.
- **Severity:** High
- **Automated verification:**
  - Spy on `window.speechSynthesis.cancel`
  - Click `.msg-speak`, wait, click again
  - Assert `cancel()` was called
  - Assert no elements have "speaking" class

---

## 10. Mobile Responsiveness

### TEST-030: Tablet layout at 768px breakpoint
- **Category:** Mobile
- **Description:** Verify the two-panel layout stacks vertically at the 768px breakpoint.
- **Steps:**
  1. Set viewport to 768x1024
  2. Inspect layout
- **Expected behaviour:** Chat and services panels stack vertically (50/50 height split). Brand bar compacts. Tagline text hidden. Both panels visible and independently scrollable.
- **Severity:** High
- **Automated verification:**
  - `getComputedStyle(document.querySelector(".app")).flexDirection === "column"`
  - Assert chat panel height approx 50% of viewport
  - Assert services panel visible (not `display: none`)
  - Assert brand bar height <= 60px

### TEST-031: Phone layout at 375px breakpoint
- **Category:** Mobile
- **Description:** Verify the compact layout at iPhone SE width.
- **Steps:**
  1. Set viewport to 375x667
  2. Inspect all interactive elements
- **Expected behaviour:** Brand bar at 52px. Service cards compact. Filter chips wrap or scroll horizontally. Send button, mic button, and touch targets meet 42px minimum. No horizontal overflow on the page body.
- **Severity:** High
- **Automated verification:**
  - Assert `document.body.scrollWidth <= window.innerWidth`
  - `document.getElementById("chatSend").offsetWidth >= 42`
  - `document.getElementById("chatMic").offsetWidth >= 42` (if supported)
  - Assert brand bar height <= 55px

### TEST-032: Touch targets meet minimum sizing
- **Category:** Mobile / UX
- **Description:** Verify interactive elements are large enough for touch on mobile.
- **Steps:**
  1. Set viewport to 375x667
  2. Measure all tappable elements: send button, mic button, suggestion chips, filter chips, service cards, booking buttons, hamburger menu if present
- **Expected behaviour:** All tappable elements are at least 42px in one dimension. Buttons have adequate spacing to prevent mis-taps.
- **Severity:** Medium
- **Automated verification:**
  - All `.chat-sugg-btn` elements: `offsetHeight >= 36`
  - All `.filter-chip` elements: `offsetHeight >= 36`
  - Service card tap areas adequate (check click target size)
  - "Prefer a real human?" bar tappable without scrolling

---

## 11. Error Handling

### TEST-033: LLM API failure -- graceful degradation
- **Category:** Robustness
- **Description:** Verify the bot degrades gracefully when the DeepSeek API is unreachable.
- **Steps:**
  1. Mock the Cloudflare Worker proxy to return 500 or timeout
  2. Type a service query
- **Expected behaviour:** Bot shows a user-facing error message ("I'm having trouble connecting right now"). Human handoff path is offered. Service search from cached Sheet data may continue. No uncaught exceptions. Typing indicator is removed.
- **Severity:** Critical
- **Automated verification:**
  - Mock Worker fetch to return `{ok: false, status: 500}`
  - Assert bot error message visible (not blank)
  - Assert human handoff path mentioned in error message
  - Assert typing indicator removed
  - Assert no console errors

### TEST-034: Gibberish input triggers recovery ladder
- **Category:** Robustness / Edge Cases
- **Description:** Verify the three-step gibberish de-escalation ladder.
- **Steps:**
  1. Type "asdfghjkl" and send (strike 1)
  2. Type "!!!!!!" and send (strike 2)
  3. Type "zzzzzzzzzz" and send (strike 3)
  4. Type "xxxxxxxxxx" and send (strike 4+)
- **Expected behaviour:** Strike 1: "I didn't quite catch that, try asking about a service" with suggestion chips. Strike 2: register shifts to concerned tone, human handoff mentioned. Strike 3-4: constrained options plus human handoff. Strike 4+: auto-forces human handoff (contact details displayed automatically).
- **Severity:** Medium
- **Automated verification:**
  - After strike 1: assert bot message contains "didn't catch" or "try asking"
  - After strike 2: assert bot message tone shifts (not repeating same cheerful template)
  - After strike 4+: assert contact details appear (phone, address, email)

### TEST-035: Empty search results with no crash
- **Category:** Robustness / Edge Cases
- **Description:** Verify the bot handles a legitimate search that returns zero results.
- **Steps:**
  1. Type a service that does not exist in the catalogue: "llama acupuncture" and send
- **Expected behaviour:** Bot returns a clarifying message: "I don't see that in our service catalogue. Try searching for a different service, or type 'human' and I'll connect you." Suggestion chips offer popular categories. No crash, no empty panel with no explanation.
- **Severity:** Medium
- **Automated verification:**
  - Assert bot message contains catalogue-not-found language
  - Assert suggestion chips offered
  - Assert human handoff path mentioned
  - Assert no console errors

### TEST-036: Rapid typing does not corrupt conversation state
- **Category:** Robustness / Edge Cases
- **Description:** Verify that rapid-fire queries do not cause race conditions or corrupted state.
- **Steps:**
  1. Type "dog services" and send
  2. Immediately type "cat dental" and send (before first response renders)
  3. Observe state after both resolve
- **Expected behaviour:** The second query's results are displayed. No interleaving of old and new results. No double-render of service cards. No stuck typing indicator. No uncaught promise rejections.
- **Severity:** Medium
- **Automated verification:**
  - Verify final service cards match "cat dental" query
  - Assert no duplicate or mixed service cards from first query
  - Assert typing indicator is removed after final response
  - Assert no console errors

---

## Summary

| Area | Test IDs | Count | Critical | High | Medium |
|------|----------|-------|----------|------|--------|
| Greeting Flow | TEST-001 to TEST-004 | 4 | 0 | 3 | 1 |
| Service Queries | TEST-005 to TEST-009 | 5 | 2 | 2 | 1 |
| Special Offers | TEST-010 to TEST-012 | 3 | 0 | 2 | 1 |
| Booking Flow | TEST-013 to TEST-016 | 4 | 2 | 2 | 0 |
| Sheet Data Loading | TEST-017 to TEST-019 | 3 | 2 | 0 | 1 |
| Human Handoff | TEST-020 to TEST-021 | 2 | 1 | 0 | 1 |
| Memory / Persistence | TEST-022 to TEST-025 | 4 | 2 | 1 | 1 |
| Voice STT | TEST-026 to TEST-027 | 2 | 0 | 2 | 0 |
| Voice TTS | TEST-028 to TEST-029 | 2 | 0 | 2 | 0 |
| Mobile | TEST-030 to TEST-032 | 3 | 0 | 2 | 1 |
| Error Handling | TEST-033 to TEST-036 | 4 | 1 | 0 | 3 |
| **TOTAL** | | **36** | **10** | **16** | **10** |

---

*Keelin O'Sullivan: QA specialist, Meadow Vet Care Chatbot project. AI colleague, designed composite, honest about both.*
