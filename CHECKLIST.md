# ✅ Checklist de Verificación - Programa de Referidos

## 🗄️ Database (Supabase)

- [ ] Ejecutado el SQL en Supabase SQL Editor (`supabase-schema.sql`)
- [ ] Verificar que existen las tablas:
  - [ ] `waitlist_users`
  - [ ] `referral_events`
- [ ] Verificar que existe la función RPC:
  - [ ] `increment_referrals_count`

## 🔑 Variables de Entorno (.env.local)

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurado
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurado
- [ ] `SUPABASE_SERVICE_KEY` configurado (completo, no con "...")
- [ ] `RESEND_API_KEY` configurado
- [ ] `RESEND_FROM_EMAIL` configurado (ej: `HIHODL <noreply@hihodl.xyz>`)

## 📧 Resend Domain Verification

- [ ] Dominio verificado en Resend Dashboard
- [ ] Registros DNS agregados en Cloudflare:
  - [ ] SPF (TXT)
  - [ ] DKIM (TXT)
  - [ ] DMARC (TXT - opcional)
- [ ] Todos los registros con proxy DESACTIVADO (nube gris)
- [ ] Dominio muestra estado "Verified" ✅ en Resend

## 🧪 Testing

### 1. Probar el servidor local
```bash
npm run dev
```

- [ ] Servidor inicia sin errores
- [ ] Visita http://localhost:3000
- [ ] El formulario de waitlist se muestra

### 2. Probar Join Waitlist
- [ ] Llena el formulario con nombre y email
- [ ] Click en "Join Beta Waitlist"
- [ ] Debe mostrar tu link de referido
- [ ] Verifica en Supabase que el usuario se creó:
  ```sql
  SELECT * FROM waitlist_users ORDER BY created_at DESC LIMIT 1;
  ```

### 3. Probar Referral Link
- [ ] Copia tu link de referido (ej: `http://localhost:3000/?ref=abc12345`)
- [ ] Abre en navegador incógnito
- [ ] Únete con otro email
- [ ] Verifica que el contador de referidos se incrementó:
  ```sql
  SELECT * FROM waitlist_users WHERE referral_code = 'tu_codigo';
  ```

### 4. Probar Leaderboard
- [ ] Visita http://localhost:3000/leaderboard
- [ ] Debe mostrar el leaderboard (puede estar vacío si no hay datos)

### 5. Probar Email
- [ ] Únete al waitlist
- [ ] Revisa tu email (incluye spam)
- [ ] Debe llegar el email de bienvenida con tu link de referido

## 🔍 Verificaciones de Base de Datos

### Verificar tablas existen:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('waitlist_users', 'referral_events');
```

### Verificar función RPC existe:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'increment_referrals_count';
```

### Verificar políticas RLS:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 🚀 Deployment Checklist

- [ ] Variables de entorno configuradas en Vercel/hosting
- [ ] Build pasa sin errores: `npm run build`
- [ ] Dominio de producción configurado en Resend
- [ ] URLs en emails apuntan a producción (no localhost)

## 🐛 Troubleshooting Común

### "Table doesn't exist"
- Ejecuta el SQL schema en Supabase

### "Function doesn't exist"
- Ejecuta la parte del SQL que crea la función `increment_referrals_count`

### "Email not sending"
- Verifica `RESEND_API_KEY` en `.env.local`
- Verifica que el dominio está verificado en Resend
- Revisa logs en Resend Dashboard → Logs

### "Referrals not counting"
- Verifica que `increment_referrals_count` existe
- Verifica que el código de referido es válido
- Revisa logs del servidor para errores

### "Leaderboard empty"
- Verifica políticas RLS permiten lectura pública
- Verifica que hay datos en `waitlist_users`

---

**¡Listo para producción cuando todos los items estén marcados!** ✅


