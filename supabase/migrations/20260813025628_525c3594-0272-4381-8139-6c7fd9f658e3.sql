INSERT INTO public.plugins (key, name, description, category, commands, enabled, scope, required_role, config, dependencies, is_core)
VALUES
 ('calc','Calculator','Evaluate a simple math expression, e.g. /calc 12 * (3 + 4)','utility', ARRAY['/calc'], true, 'all', 'user', '{}'::jsonb, ARRAY[]::text[], false),
 ('weather','Weather','Current weather for a city. Uses config.default_city when no city is given.','utility', ARRAY['/weather','/w'], true, 'all', 'user', '{"default_city":"Jakarta"}'::jsonb, ARRAY[]::text[], false)
ON CONFLICT (key) DO NOTHING;