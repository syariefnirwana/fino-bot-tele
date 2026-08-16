-- Restrict internal data to staff
DROP POLICY IF EXISTS settings_read ON public.bot_settings;
CREATE POLICY settings_read ON public.bot_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS providers_read ON public.api_providers;
CREATE POLICY providers_read ON public.api_providers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS plugins_read ON public.plugins;
CREATE POLICY plugins_read ON public.plugins FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS logs_read ON public.activity_logs;
CREATE POLICY logs_read ON public.activity_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS audit_read ON public.audit_log;
CREATE POLICY audit_read ON public.audit_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS tgusers_read ON public.telegram_users;
CREATE POLICY tgusers_read ON public.telegram_users FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS tggroups_read ON public.telegram_groups;
CREATE POLICY tggroups_read ON public.telegram_groups FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS roles_read ON public.user_roles;
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

-- Trigger-only routines must not be callable from the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_plugin_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;