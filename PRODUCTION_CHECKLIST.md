# 🚀 Checklist para Lanzar a Producción

## ✅ Pre-Deployment

### 1. Base de Datos (Supabase)
- [ ] SQL ejecutado en Supabase (tablas creadas)
- [ ] Función RPC `increment_referrals_count` existe
- [ ] Políticas RLS configuradas correctamente

### 2. Variables de Entorno en Producción

**Vercel/Netlify/etc:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_key_completo
RESEND_API_KEY=tu_resend_key
RESEND_FROM_EMAIL=HIHODL <noreply@hihodl.xyz>
NEXT_PUBLIC_SITE_URL=https://www.hihodl.xyz
```

### 3. Build
- [ ] `npm run build` pasa sin errores ✅
- [ ] No hay warnings críticos

### 4. Resend Domain
- [ ] Dominio `hihodl.xyz` verificado en Resend
- [ ] DNS configurado en Cloudflare
- [ ] Estado "Verified" ✅ en Resend Dashboard

## 🚀 Deploy

### Vercel (Recomendado)
```bash
# 1. Conecta tu repo
# 2. Agrega variables de entorno
# 3. Deploy automático
```

### Después del Deploy
- [ ] Verifica que el sitio carga: https://www.hihodl.xyz
- [ ] Prueba el formulario de waitlist
- [ ] Verifica que redirige a `/thank-you`
- [ ] Prueba con link de referido: `https://www.hihodl.xyz/?ref=CODIGO`
- [ ] Verifica que el email llega con links correctos

## 🧪 Tests Post-Deploy

1. **Test básico**: Únete a la waitlist
2. **Test referral**: Usa link con `?ref=CODIGO`
3. **Test email**: Verifica que llega el email
4. **Test leaderboard**: Visita `/leaderboard`

## ⚠️ Importante

- Los emails ya tienen URLs hardcodeadas a `www.hihodl.xyz`
- Funciona en producción automáticamente
- Para cambiar, usa variable `NEXT_PUBLIC_SITE_URL` (si la implementamos)

---

**¡Listo para producción!** 🚀


