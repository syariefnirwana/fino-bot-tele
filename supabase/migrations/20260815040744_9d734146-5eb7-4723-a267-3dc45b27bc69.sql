CREATE TABLE public.plugin_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id uuid NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  version integer NOT NULL,
  code text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  commands text[] NOT NULL DEFAULT '{}',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plugin_id, version)
);

GRANT SELECT, INSERT ON public.plugin_versions TO authenticated;
GRANT ALL ON public.plugin_versions TO service_role;

ALTER TABLE public.plugin_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read plugin versions"
  ON public.plugin_versions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert plugin versions"
  ON public.plugin_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX plugin_versions_plugin_idx ON public.plugin_versions (plugin_id, version DESC);

CREATE OR REPLACE FUNCTION public.snapshot_plugin_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_version integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.code IS NOT DISTINCT FROM OLD.code
     AND NEW.config IS NOT DISTINCT FROM OLD.config
     AND NEW.commands IS NOT DISTINCT FROM OLD.commands THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.plugin_versions WHERE plugin_id = NEW.id;

  INSERT INTO public.plugin_versions (plugin_id, version, code, config, commands, created_by)
  VALUES (NEW.id, next_version, COALESCE(NEW.code, ''), COALESCE(NEW.config, '{}'::jsonb), COALESCE(NEW.commands, '{}'), auth.uid());

  RETURN NEW;
END;
$$;

CREATE TRIGGER plugins_snapshot_version
AFTER INSERT OR UPDATE ON public.plugins
FOR EACH ROW EXECUTE FUNCTION public.snapshot_plugin_version();

INSERT INTO public.plugin_versions (plugin_id, version, code, config, commands, note)
SELECT id, 1, COALESCE(code, ''), COALESCE(config, '{}'::jsonb), COALESCE(commands, '{}'), 'initial snapshot'
FROM public.plugins;