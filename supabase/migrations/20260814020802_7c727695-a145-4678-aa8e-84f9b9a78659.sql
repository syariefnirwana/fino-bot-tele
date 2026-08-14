ALTER TABLE public.plugins
  ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_updated_at timestamptz;

UPDATE public.plugins SET code = $js$// /calc — pure logic, no external service.
const expr = ctx.args.trim();
if (!expr) return "Usage: /calc 12 * (3 + 4)";
if (!/^[0-9+\-*/%.() ]+$/.test(expr)) return "Only numbers and + - * / % ( ) are allowed.";
const value = evaluate(expr);
if (typeof value !== "number" || !isFinite(value)) return "That is not a valid expression.";
return "`" + expr + "` = *" + value + "*";
$js$, code_updated_at = now() WHERE key = 'calc' AND code = '';

UPDATE public.plugins SET code = $js$// /weather — external API + per-plugin config.
const city = ctx.args.trim() || String(ctx.config.default_city || "Jakarta");
const geo = await fetchJson("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city));
const place = geo && geo.results && geo.results[0];
if (!place) return "Could not find *" + city + "*.";
const wx = await fetchJson("https://api.open-meteo.com/v1/forecast?latitude=" + place.latitude + "&longitude=" + place.longitude + "&current=temperature_2m,wind_speed_10m");
if (!wx || !wx.current) return "Weather service is unavailable right now.";
return "*" + place.name + ", " + place.country + "*\ntemp: " + wx.current.temperature_2m + "°C\nwind: " + wx.current.wind_speed_10m + " km/h";
$js$, code_updated_at = now() WHERE key = 'weather' AND code = '';