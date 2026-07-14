var API_PROXY="https://meadow-vet-proxy.dan-m-kelly.workers.dev";

// === Key setup ===
(function(){
  if(typeof LLM_KEY==="undefined")window.LLM_KEY="";
  if(typeof LLM_URL==="undefined")window.LLM_URL="";
  if(typeof LLM_MODEL==="undefined")window.LLM_MODEL="";
})(window);

// === Google Sheet Data ===
var SHEET_CSV="https://docs.google.com/spreadsheets/d/1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4/gviz/tq?tqx=out:csv&gid=1277715587";
var allServices=[];
var filteredServices=[];
var activeSpecies=["dog","cat","rabbit","small mammal","bird"];
var offersOnly=false;
var bookableOnly=false;

// === State ===
var conv=[],gibberishCount=0,expectingName=false,expectingConsent=false,expectingHumanBot=false;
var currentQuery="",spokeLast=false,lastBotAsked=false;
function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}

// === Irish Public Holidays ===
var holidayCache=null;
function dateToYMD(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
async function fetchIrishHolidays(){
  if(holidayCache)return holidayCache;
  var thisYear=new Date().getFullYear();
  var nextYear=thisYear+1;
  try{
    var url=API_PROXY?API_PROXY+"/api/holidays":"https://date.nager.at/api/v4/Holidays/IE/"+thisYear;
    var r=await fetch(url);
    if(!r.ok)throw new Error("HTTP "+r.status);
    var thisYearHols=await r.json();
    var nextUrl=API_PROXY?API_PROXY+"/api/holidays?year="+nextYear:"https://date.nager.at/api/v4/Holidays/IE/"+nextYear;
    var r2=await fetch(nextUrl);
    var nextYearHols=r2.ok?await r2.json():[];
    holidayCache=(thisYearHols||[]).concat(nextYearHols||[]);
    return holidayCache;
  }catch(e){console.warn("[Holidays] fetch fail:",e.message);return[]}
}
function isHoliday(dateObj){
  if(!holidayCache)return null;
  var ymd=dateToYMD(dateObj);
  for(var i=0;i<holidayCache.length;i++){if(holidayCache[i].date===ymd)return holidayCache[i]}
  return null;
}
function getHolidayContext(){
  if(!holidayCache||holidayCache.length===0)return"";
  var today=new Date();var upcoming=[];
  for(var i=0;i<holidayCache.length;i++){
    var hd=new Date(holidayCache[i].date+"T00:00:00");
    if(hd>=today)upcoming.push(holidayCache[i].name+" ("+holidayCache[i].date+")");
  }
  if(upcoming.length===0)return"";
  return"Upcoming Irish public holidays: "+upcoming.slice(0,6).join(", ")+". ";
}
function isHolidayPattern(txt){
  return /open|closed|opening|holiday|bank.?holiday|public.?holiday|are you (open|closed|workin)|hours|what days|what time|when (are|do) you (open|close|work)|st(\s|\.)?\s*(patrick|brigid|stephen)/i.test(txt);
}

// === Weather ===
var weatherCache=null,weatherCacheTime=0;
var WMO_CODES={0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Depositing rime fog",51:"Light drizzle",53:"Moderate drizzle",55:"Dense drizzle",56:"Light freezing drizzle",57:"Dense freezing drizzle",61:"Slight rain",63:"Moderate rain",65:"Heavy rain",66:"Light freezing rain",67:"Heavy freezing rain",71:"Slight snowfall",73:"Moderate snowfall",75:"Heavy snowfall",77:"Snow grains",80:"Slight rain showers",81:"Moderate rain showers",82:"Violent rain showers",85:"Slight snow showers",86:"Heavy snow showers",95:"Thunderstorm",96:"Thunderstorm with slight hail",99:"Thunderstorm with heavy hail"};
function describeWeather(w){
  var t=w.current.temperature_2m;
  var at=w.current.apparent_temperature;
  var h=w.current.relative_humidity_2m;
  var ws=w.current.wind_speed_10m;
  var code=w.current.weather_code;
  var desc=WMO_CODES[code]||("Weather code "+code);
  var loc=w._location||"Dublin";
  var parts=["Current weather in "+loc+": "+desc+", "+t+"°C (feels like "+at+"°C), "+h+"% humidity, wind "+ws+" km/h."];
  if(t>=30)parts.push("Temperature is dangerously high for walking dogs. Advise against walking. Pavement can burn paws at this temperature.");
  else if(t>=25)parts.push("Temperature is high. Advise walking only in early morning or late evening. Test pavement with back of hand for 7 seconds - if too hot for you, too hot for paws.");
  else if(t>=20)parts.push("Temperature is warm but generally safe. Advise shorter walks for flat-faced breeds and carry water.");
  else if(t<=0)parts.push("Temperature is below freezing. Advise short walks, consider a coat for small or short-haired dogs.");
  if(code>=95)parts.push("Thunderstorm active. Strongly advise against walking until it passes.");
  else if(code>=51&&code<=67||code>=80&&code<=82)parts.push("Rain is falling. Advise a short walk or waiting for a break in the rain.");
  if(h>=85)parts.push("High humidity can make it harder for dogs to cool down. Take it easy.");
  return parts.join(" ");
}
function weatherAge(){return(Date.now()-weatherCacheTime)/1000}
async function fetchWeather(){
  return fetchWeatherEx("53.3498","-6.2603","Dublin");
}
async function fetchWeatherEx(lat,lon,loc){
  if(weatherCache&&weatherAge()<600&&weatherCache._lat===lat)return weatherCache;
  try{
    var url=API_PROXY?API_PROXY+"/api/weather?lat="+lat+"&lon="+lon+"&loc="+encodeURIComponent(loc||""):"https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe/Dublin";
    var r=await fetch(url);
    if(!r.ok)throw new Error("HTTP "+r.status);
    weatherCache=await r.json();
    weatherCache._location=loc||"Dublin";
    weatherCache._lat=lat;
    weatherCacheTime=Date.now();
    return weatherCache;
  }catch(e){console.warn("[Weather] fetch fail:",e.message);return null}
}
function isWeatherPattern(txt){
  return /weather|temperature|hot|warm|cold|frozen|heat|humidity|rain|raining|drizzle|snow|snowing|storm|thunder|wind|walk.*(dog|pet|puppy|pup|cat)|too hot|too cold|pavement|paws.*burn|safe.*walk|walk.*safe|is it ok|can i walk/i.test(txt);
}

// === Breed Care Guides ===
var breedGuides=null;
async function fetchBreedGuide(breed){
  if(!breed)return null;
  var bk=breed.toLowerCase().trim();
  if(!breedGuides){
    try{
      var url=API_PROXY?API_PROXY+"/api/breeds?breed="+encodeURIComponent(bk):"";
      var r=await fetch(url);
      if(r.ok)breedGuides=await r.json();
    }catch(e){console.warn("[Breeds] fetch fail:",e.message);return null}
  }
  if(breedGuides){
    for(var k in breedGuides){if(k.indexOf(bk)>-1||bk.indexOf(k)>-1)return breedGuides[k]}
  }
  return null;
}
function isBreedPattern(txt){
  return /breed|labrador|golden retriever|french bulldog|frenchie|german shepherd|border collie|dachshund|cocker spaniel|staffy|staffie|shih tzu|persian|bengal|siamese|budgie|cockatiel|ferret|guinea pig|rabbit/i.test(txt);
}

// === Location-Aware Weather ===
var userLocation="";
var geoCache={};
async function fetchGeocode(place){
  if(geoCache[place])return geoCache[place];
  try{
    var url=API_PROXY?API_PROXY+"/api/geocode?q="+encodeURIComponent(place):"https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(place)+"&count=1&format=json";
    var r=await fetch(url);
    if(!r.ok)throw new Error("HTTP "+r.status);
    var d=await r.json();
    if(d.results&&d.results.length>0){geoCache[place]=d.results[0];return d.results[0]}
    return null;
  }catch(e){console.warn("[Geo] fail:",e.message);return null}
}

// === Live Slots ===
var slotCache={};
async function fetchSlots(serviceId){
  if(slotCache[serviceId])return slotCache[serviceId];
  try{
    var url=API_PROXY?API_PROXY+"/api/slots?service_id="+encodeURIComponent(serviceId||"");
    var r=await fetch(url);
