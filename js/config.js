/* config.js - conexión al servidor de cuentas.
   Mientras esté vacío, la app trabaja sola en este navegador y la pantalla de
   cuenta corre contra un backend simulado. Al pegar los dos valores del proyecto
   de Supabase (docs/backend.md, paso 5) pasa a trabajar contra el servidor.
   Las dos claves son públicas por diseño: lo que protege los datos son las
   reglas de acceso de db/schema.sql. */
window.RG_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
