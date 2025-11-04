# 🚀 Deploy a Producción - Guía Rápida

## ✅ Pre-Deploy Checklist

### 1. Build Verificado
```bash
npm run build
```
✅ Debe pasar sin errores

### 2. Variables de Entorno en Vercel/Netlify

**Ve a tu plataforma de hosting y agrega estas variables:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gctwjvfpwkirtybzbnmu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_completo
SUPABASE_SERVICE_KEY=tu_service_key_completo

# Resend (opcional, para emails)
RESEND_API_KEY=tu_resend_key
RESEND_FROM_EMAIL=HIHODL <noreply@hihodl.xyz>

# URL del sitio (IMPORTANTE)
NEXT_PUBLIC_SITE_URL=https://www.hihodl.xyz
```

### 3. Base de Datos Supabase

✅ **Ejecuta el SQL en Supabase**:
1. Ve a Supabase Dashboard → SQL Editor
2. Copia y pega el contenido de `supabase-schema.sql`
3. Ejecuta
4. Verifica que las tablas existan:
   - `waitlist_users`
   - `referral_events`

### 4. Resend Domain (Para emails)

✅ **Verifica dominio en Resend**:
- Ve a https://resend.com/domains
- Verifica que `hihodl.xyz` esté verificado ✅
- Si no, sigue `RESEND_CLOUDFLARE_SETUP.md`

## 🚀 Deploy en Vercel (Recomendado)

### Opción 1: Desde GitHub
1. Push tu código a GitHub
2. Ve a https://vercel.com
3. Import project → Selecciona tu repo
4. Agrega las variables de entorno
5. Deploy

### Opción 2: Desde CLI
```bash
npm i -g vercel
vercel
# Sigue las instrucciones
# Agrega variables de entorno cuando te lo pida
```

## 🧪 Post-Deploy Testing

Una vez deployado:

1. **Test básico**: https://www.hihodl.xyz
   - Verifica que carga
   - Click en "Join Beta"
   - Llena formulario

2. **Test referral**: https://www.hihodl.xyz/?ref=TU_CODIGO
   - Abre en incógnito
   - Únete con otro email

3. **Test leaderboard**: https://www.hihodl.xyz/leaderboard
   - Debe mostrar el ranking

4. **Test email**: 
   - Únete a la waitlist
   - Revisa tu email (incluye spam)

## ⚠️ URLs Hardcodeadas

Las URLs ya están configuradas para producción:
- ✅ Emails usan `https://www.hihodl.xyz`
- ✅ Links de referido usan `https://www.hihodl.xyz/?ref=CODE`
- ✅ Leaderboard link usa `https://www.hihodl.xyz/leaderboard`

Si `NEXT_PUBLIC_SITE_URL` está configurado, se usará automáticamente.

## 🐛 Si algo falla

### Error "server_error"
- Verifica variables de entorno en Vercel
- Verifica que Supabase SQL esté ejecutado
- Revisa logs en Vercel Dashboard

### Email no llega
- Verifica `RESEND_API_KEY` en Vercel
- Verifica dominio verificado en Resend
- Revisa logs en Resend Dashboard

### Base de datos no funciona
- Verifica que el SQL esté ejecutado
- Verifica políticas RLS en Supabase
- Revisa logs de Supabase

---

**¡Listo para deploy!** 🚀


