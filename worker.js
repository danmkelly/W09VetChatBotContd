/**
 * Meadow Vet Care API Proxy - Cloudflare Worker
 *
 * Endpoints:
 *   GET  /api/health       - Health check
 *   POST /api/llm          - Proxy to DeepSeek chat completions
 *   GET  /api/holidays     - Irish public holidays (Nager.Date)
 *   GET  /api/weather      - Live weather (Open-Meteo, location-aware)
 *   GET  /api/geocode      - Location name -> lat/lon (Open-Meteo)
 *   GET  /api/slots        - Simulated live appointment slot counts
 *   GET  /api/breeds       - Breed-specific care information
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const USER_AGENT = "MeadowVetProxy/2.0 (Cloudflare Worker)";

function json(data, status, extraHeaders) {
  const h = new Headers({ "Content-Type": "application/json" });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => h.set(k, v));
  if (extraHeaders) Object.entries(extraHeaders).forEach(([k, v]) => h.set(k, v));
  return new Response(JSON.stringify(data), { status, headers: h });
}

// Breed-specific care guides
const BREED_GUIDES = {
  "labrador": { issues: "Hip/elbow dysplasia, obesity, ear infections", heat: "Moderate risk - watch for overheating in summer. Avoid midday walks above 25C.", tips: "Joint supplements recommended from age 5. Keep weight in check - Labs are prone to obesity.", walkAdvice: "2x 30-60 min walks daily. Swimming is excellent low-impact exercise." },
  "golden retriever": { issues: "Hip dysplasia, cancer, skin allergies", heat: "Moderate risk - thick coat can cause overheating. Brush regularly in summer.", tips: "Regular grooming reduces skin issues. Prone to ear infections - keep ears dry.", walkAdvice: "2x 30-60 min walks daily. Excellent swimmers - water exercise is ideal." },
  "french bulldog": { issues: "Brachycephalic syndrome, IVDD, skin fold infections", heat: "HIGH risk - cannot cool effectively. Do NOT walk above 22C. Flat-faced breeds overheat rapidly.", tips: "Keep facial folds clean and dry. Use harness not collar. Monitor breathing during any exercise.", walkAdvice: "2x 10-15 min gentle walks. Indoor play in warm weather. Never walk midday in summer." },
  "german shepherd": { issues: "Hip/elbow dysplasia, degenerative myelopathy, bloat", heat: "Moderate-high risk - dense double coat. Brush regularly, provide shade and water.", tips: "Joint care from puppy age. Feed 2-3 small meals to reduce bloat risk. Mental stimulation as important as physical.", walkAdvice: "2x 45-60 min walks plus training sessions. Avoid intense exercise right after meals." },
  "border collie": { issues: "Collie eye anomaly, epilepsy, hip dysplasia", heat: "Moderate risk - high energy means they may over-exert. Watch for exhaustion.", tips: "Mental stimulation essential - puzzle toys, agility, herding games. Under-stimulated Collies develop behavioural issues.", walkAdvice: "2x 60 min active walks plus off-lead running. Working breed needs significant daily exercise." },
  "dachshund": { issues: "IVDD (intervertebral disc disease), obesity, dental disease", heat: "Low-moderate risk. Short coat helps but small body can overheat.", tips: "CRITICAL: avoid stairs and jumping to protect spine. Use ramps for furniture. Weight management is essential for spinal health.", walkAdvice: "2x 15-20 min walks. No high-impact activities. Swimming is excellent for spinal health." },
  "cocker spaniel": { issues: "Ear infections, eye problems, hip dysplasia", heat: "Moderate risk - dense coat. Regular grooming essential.", tips: "Check and clean ears weekly - spaniels are prone to infections. Regular professional grooming every 6-8 weeks.", walkAdvice: "2x 30-45 min walks. Enjoy retrieving games and scent work." },
  "staffordshire bull terrier": { issues: "Skin allergies, hip dysplasia, cataracts", heat: "Low-moderate risk. Short coat but high muscle mass generates heat.", tips: "Watch for skin allergies - common in the breed. Strong chewers - provide durable toys.", walkAdvice: "2x 30-45 min walks. Strong pullers - use front-clip harness." },
  "shih tzu": { issues: "Brachycephalic issues, eye problems, dental disease", heat: "HIGH risk - flat-faced. Keep cool, avoid heat. Groom regularly.", tips: "Daily eye cleaning. Regular professional grooming every 4-6 weeks. Dental care essential.", walkAdvice: "2x 15-20 min gentle walks. Indoor play in warm weather." },
  "persian": { issues: "Brachycephalic issues, polycystic kidney disease, dental disease", heat: "HIGH risk - flat-faced cat. Keep indoors with air circulation on hot days.", tips: "Daily eye cleaning and grooming. Monitor water intake for kidney health.", walkAdvice: "Indoor cat - provide climbing trees and puzzle feeders for exercise." },
  "bengal": { issues: "Hypertrophic cardiomyopathy, progressive retinal atrophy", heat: "Low risk - short coat. Very active breed.", tips: "High energy - needs significant daily play and climbing structures. Prone to dental issues.", walkAdvice: "Indoor with supervised outdoor access. Harness training recommended for safe outdoor exploration." },
  "siamese": { issues: "Respiratory issues, dental disease, amyloidosis", heat: "Low risk - short coat.", tips: "Very vocal breed - changes in vocalisation can indicate health issues. Prone to separation anxiety.", walkAdvice: "Indoor cat - interactive play sessions 2-3x daily." },
  "shorthair": { issues: "Generally healthy, can have dental and weight issues", heat: "Low risk.", tips: "Regular dental care. Indoor cats need environmental enrichment.", walkAdvice: "Indoor with supervised outdoor time if desired." },
  "rabbit": { issues: "Dental disease, GI stasis, fly strike", heat: "HIGH risk - rabbits cannot sweat. Keep below 25C at all times in summer.", tips: "Unlimited hay essential for dental and digestive health. Annual vaccinations for myxomatosis and VHD.", walkAdvice: "Minimum 4 hours free-roam daily. Secure garden time supervised." },
  "guinea pig": { issues: "Dental disease, vitamin C deficiency, respiratory infections", heat: "Moderate risk - sensitive to temperature changes.", tips: "Daily vitamin C supplementation. Regular nail trims. Need companion guinea pig for wellbeing.", walkAdvice: "Indoor housing with daily floor time in safe enclosure." },
  "budgie": { issues: "Respiratory disease, tumours, scaly face mites", heat: "Moderate risk - sensitive to drafts and sudden temperature changes.", tips: "Regular cage cleaning essential. Avoid Teflon/non-stick cookware fumes - toxic to birds. Annual health checks.", walkAdvice: "Daily out-of-cage flight time in bird-proofed room." },
  "cockatiel": { issues: "Respiratory disease, fatty liver, egg binding (females)", heat: "Moderate risk - sensitive to drafts.", tips: "Balanced diet with pellets, not just seeds. Regular wing/nail trims. Social interaction daily.", walkAdvice: "Daily out-of-cage time - minimum 2 hours." },
  "ferret": { issues: "Adrenal disease, insulinoma, lymphoma", heat: "HIGH risk - cannot tolerate heat above 26C. Cool environment essential.", tips: "Annual vaccinations for distemper. Regular dental checks. Need several hours out-of-cage daily.", walkAdvice: "Indoor with supervised exploration. Harness walks possible in cool weather." }
};

// Slot simulation helper
function generateSlots(serviceId) {
  const now = new Date();
  const seed = (serviceId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const slots = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const dow = d.getDay();
    const isClosed = dow === 0; // Sunday
    const pseudoRandom = ((seed * (i + 1) * 17 + dow * 31) % 100) / 100;
    const available = isClosed ? 0 : Math.max(0, Math.round((dow === 6 ? 3 : 8) * (0.3 + pseudoRandom * 0.7)));
    const total = isClosed ? 0 : (dow === 6 ? 4 : 10);
    slots.push({ date: dateStr, available, total, isSaturday: dow === 6, isSunday: dow === 0 });
  }
  return slots;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/api/health") {
        return json({
          status: "ok",
          llm_configured: !!env.LLM_KEY,
          timestamp: new Date().toISOString(),
        }, 200, { "Cache-Control": "public, max-age=60" });
      }

      if (url.pathname === "/api/llm") {
        if (!env.LLM_KEY) return json({ error: "LLM_KEY not configured" }, 503);
        let body;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
        const upstream = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.LLM_KEY}`, "User-Agent": USER_AGENT },
          body: JSON.stringify(body),
        });
        const rh = new Headers(upstream.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => rh.set(k, v));
        return new Response(upstream.body, { status: upstream.status, headers: rh });
      }

      if (url.pathname === "/api/holidays") {
        const year = url.searchParams.get("year") || new Date().getUTCFullYear().toString();
        const holidayUrl = `https://date.nager.at/api/v4/Holidays/IE/${year}`;
        const cache = caches.default;
        let cached = await cache.match(holidayUrl);
        if (cached) return cached;
        const upstream = await fetch(holidayUrl, { headers: { "User-Agent": USER_AGENT } });
        if (upstream.ok) {
          const resp = new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
          Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v));
          ctx.waitUntil(cache.put(holidayUrl, resp.clone()));
          return resp;
        }
        return json({ error: "Failed to fetch holidays" }, 502);
      }

      if (url.pathname === "/api/weather") {
        const lat = url.searchParams.get("lat") || "53.3498";
        const lon = url.searchParams.get("lon") || "-6.2603";
        const loc = url.searchParams.get("loc") || "Dublin";
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe/Dublin`;
        const cache = caches.default;
        let cached = await cache.match(weatherUrl);
        if (cached) return cached;
        const upstream = await fetch(weatherUrl, { headers: { "User-Agent": USER_AGENT } });
        if (upstream.ok) {
          const data = await upstream.json();
          data._location = loc;
          data._lat = lat;
          data._lon = lon;
          const resp = new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });
          Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v));
          ctx.waitUntil(cache.put(weatherUrl, resp.clone()));
          return resp;
        }
        return json({ error: "Failed to fetch weather" }, 502);
      }

      if (url.pathname === "/api/geocode") {
        const q = url.searchParams.get("q") || "";
        if (!q) return json({ error: "Missing 'q' parameter" }, 400);
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=3&language=en&format=json`;
        const upstream = await fetch(geoUrl, { headers: { "User-Agent": USER_AGENT } });
        if (upstream.ok) {
          const data = await upstream.json();
          const resp = new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
          Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v));
          return resp;
        }
        return json({ error: "Geocoding failed" }, 502);
      }

      if (url.pathname === "/api/slots") {
        const serviceId = url.searchParams.get("service_id") || "";
        const slots = generateSlots(serviceId);
        return json({ service_id: serviceId, slots, _note: "Simulated live slot data - replace with practice management API in production" }, 200, { "Cache-Control": "public, max-age=300" });
      }

      if (url.pathname === "/api/breeds") {
        const breed = (url.searchParams.get("breed") || "").toLowerCase().trim();
        const result = {};
        if (breed) {
          for (const [key, guide] of Object.entries(BREED_GUIDES)) {
            if (key.includes(breed) || breed.includes(key)) {
              result[key] = guide;
            }
          }
        }
        if (Object.keys(result).length === 0) {
          result._message = "No specific breed guide found. General advice: ensure your pet has regular checkups, vaccinations, dental care, and a balanced diet. Contact the clinic for breed-specific advice.";
        }
        return json(result, 200, { "Cache-Control": "public, max-age=86400" });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Internal server error" }, 500);
    }
  },
};
