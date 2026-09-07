/* config.js - conexión al servidor de cuentas (Supabase).
   Las dos claves son públicas por diseño: van en el navegador y cualquiera que
   abra la app las puede leer. Lo que protege los datos son las reglas de acceso
   de db/schema.sql, que corren en el servidor. La clave secreta del proyecto no
   va acá ni en ningún archivo del repositorio. */
window.RG_CONFIG = {
  supabaseUrl: 'https://yjopnvjopdjulzuiijbr.supabase.co',
  supabaseAnonKey: 'sb_publishable_4Z9d98Ba5dqF9btfGMapQg_layo9EHG'
};
