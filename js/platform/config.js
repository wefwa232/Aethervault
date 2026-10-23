/* AETHERVAULT — optional cloud configuration. Both values are PUBLIC by design (the anon key is safe in a browser;
   data is protected by Row Level Security, added in Subphase D). Leave empty and the game is purely local:
   no network calls are made and the Account section explains that sign-in is not set up.
   NEVER put a service_role key, database password or OAuth client secret here. */
(function () {
  const AV = (window.AV = window.AV || {});
  AV.config = { supabaseUrl: '', supabaseAnonKey: '' };
})();
