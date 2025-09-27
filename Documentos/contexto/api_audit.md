# WikiScope — Auditoría de APIs (Sept 2025)

## 1. Supabase
- **Uso actual**: Autenticación y preferencias de usuario desde la página `html/loggin.html`.
- **Exposición**: Requiere `supabase.url` y `supabase.anonKey`. Aunque la key anónima es pública por diseño, debe rotarse si se filtra la service key.
- **Medidas aplicadas**: La config se mueve a `Documentos/personal/vault.ink` y se consume dinámicamente. El archivo incluye valores de ejemplo y debe reemplazarse con credenciales reales fuera del control de versiones (`.gitignore`).
- **Acciones recomendadas**: Crear `Documentos/personal/vault.local.ink` con valores reales y excluirlo del repositorio. Configurar reglas RLS estrictas en Supabase para la tabla `profiles`.

## 2. DeepSeek LLM
- **Uso actual**: El home (`html/home.html`) llama a un proxy definido en `vault.ink` para invocar el modelo.
- **Riesgo**: Las API keys del modelo no pueden vivir en el cliente porque este proyecto se desplegará en GitHub Pages.
- **Medidas aplicadas**: `home.html` solo envía solicitudes al `proxyUrl` definido. Los headers con patrones `{{PLACEHOLDER}}` nunca se envían; sirven como guía para configurar un gateway seguro (Cloudflare Worker, Supabase Edge Function, Vercel, etc.).
- **Acciones recomendadas**:
  1. Implementar un proxy serverless que inyecte la API key de DeepSeek como variable de entorno.
  2. Aplicar limitación de tasa y logging para detectar abusos.
  3. Validar input antes de reenviar al modelo.

## 3. MediaWiki / Wikipedia (futuro)
- **Estado**: Aún no se consumen endpoints. Se debe respetar rate limits, User-Agent identificable y cachear respuestas.
- **Acciones previas**: Mantener la lógica de fetch en el backend; nunca exponer tokens opcionales en el cliente.

## 4. Gestión de secretos
- Crear un archivo `Documentos/personal/.gitignore` que incluya `vault.ink` cuando contenga valores sensibles.
- Usar secrets del repositorio (GitHub Actions) o variables del proveedor del proxy para inyectar credenciales en tiempo de despliegue.
- Documentar el proceso en el README antes del despliegue público.

## 5. Próximos pasos sugeridos
- Añadir comprobaciones automáticas (lint/test) que alerten si `vault.ink` contiene literales que se parezcan a claves API.
- Configurar Content Security Policy (CSP) restrictiva cuando se publique el sitio.
