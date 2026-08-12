
-- roles
CREATE TYPE public.app_role AS ENUM ('owner','admin','moderator','developer','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_write" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'))
$$;

CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_owner_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- new user bootstrap: profile + first user becomes owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- bot settings (singleton)
CREATE TABLE public.bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL DEFAULT 'FINO BOT',
  bot_username text,
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  default_language text NOT NULL DEFAULT 'en',
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'FINO BOT is under maintenance. Please try again later.',
  rate_limit_per_minute integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_settings TO authenticated;
GRANT ALL ON public.bot_settings TO service_role;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.bot_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write" ON public.bot_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER bot_settings_touch BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.bot_settings DEFAULT VALUES;

-- plugins
CREATE TABLE public.plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'utility',
  commands text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'all',
  required_role public.app_role NOT NULL DEFAULT 'user',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies text[] NOT NULL DEFAULT '{}',
  is_core boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plugins TO authenticated;
GRANT ALL ON public.plugins TO service_role;
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plugins_read" ON public.plugins FOR SELECT TO authenticated USING (true);
CREATE POLICY "plugins_write" ON public.plugins FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER plugins_touch BEFORE UPDATE ON public.plugins FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.plugins (key,name,description,category,commands,scope,required_role,is_core) VALUES
 ('start','Start','Greets the user and registers them on the platform.','core','{/start}','all','user',true),
 ('help','Help','Lists every enabled command available to the caller.','core','{/help}','all','user',true),
 ('ping','Ping','Health check that replies with round-trip latency.','core','{/ping}','all','user',true),
 ('whoami','Who Am I','Shows the caller''s Telegram id, chat id and platform role.','core','{/whoami,/id}','all','user',true),
 ('echo','Echo','Repeats back the text you send after the command.','fun','{/echo}','all','user',false),
 ('stats','Stats','Reports platform statistics: users, groups, messages.','admin','{/stats}','all','admin',false),
 ('chatinfo','Chat Info','Details about the current chat.','group','{/chatinfo}','group','user',false),
 ('roll','Roll','Rolls a dice, optionally with NdM notation.','fun','{/roll}','all','user',false);

-- telegram users
CREATE TABLE public.telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  language_code text,
  role public.app_role NOT NULL DEFAULT 'user',
  banned boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_users TO authenticated;
GRANT ALL ON public.telegram_users TO service_role;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tgusers_read" ON public.telegram_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "tgusers_write" ON public.telegram_users FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- telegram groups
CREATE TABLE public.telegram_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL UNIQUE,
  title text,
  chat_type text NOT NULL DEFAULT 'group',
  enabled boolean NOT NULL DEFAULT true,
  message_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_groups TO authenticated;
GRANT ALL ON public.telegram_groups TO service_role;
ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tggroups_read" ON public.telegram_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "tggroups_write" ON public.telegram_groups FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- activity logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info',
  plugin_key text,
  command text,
  telegram_id bigint,
  chat_id bigint,
  message text NOT NULL DEFAULT '',
  duration_ms integer,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_created_idx ON public.activity_logs (created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_read" ON public.activity_logs FOR SELECT TO authenticated USING (true);

-- api providers
CREATE TABLE public.api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  base_url text,
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  secret_name text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_providers TO authenticated;
GRANT ALL ON public.api_providers TO service_role;
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers_read" ON public.api_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers_write" ON public.api_providers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER providers_touch BEFORE UPDATE ON public.api_providers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
