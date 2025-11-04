# 🧪 Guía Rápida para Testear el Flujo

## ✅ Pre-requisitos (Verifica antes)

1. **Base de datos**: SQL ejecutado en Supabase
2. **Variables de entorno**: `.env.local` configurado
3. **Build funciona**: `npm run build` sin errores ✅

## 🚀 Iniciar el Servidor

```bash
npm run dev
```

Luego abre: http://localhost:3000

## 📋 Pasos para Testear

### 1. Test Básico - Unirse a la Waitlist

1. Ve a http://localhost:3000
2. Scroll hasta el formulario (o click en "Join Beta")
3. Llena:
   - Nombre: `Test User`
   - Email: `test@example.com`
4. Click en "Join Beta Waitlist"
5. **Esperado**: Redirige a `/thank-you` después de 1 segundo

### 2. Verificar en Supabase

Abre Supabase Dashboard → Table Editor → `waitlist_users`

```sql
SELECT * FROM waitlist_users ORDER BY created_at DESC LIMIT 1;
```

Debes ver:
- Tu email
- Tu nombre
- Un `referral_code` (8 caracteres)
- `referrals_count: 0`

### 3. Test de Referral Link

1. Copia tu `referral_code` de Supabase
2. Abre en navegador incógnito:
   ```
   http://localhost:3000/?ref=TU_CODIGO
   ```
3. Llena el formulario con:
   - Nombre: `Referred User`
   - Email: `referred@example.com` (diferente dominio)
4. Click en "Join Beta Waitlist"
5. **Esperado**: 
   - Redirige a `/thank-you`
   - En Supabase, tu `referrals_count` debe ser `1`

### 4. Test del Leaderboard

1. Ve a http://localhost:3000/leaderboard
2. **Esperado**: Ver lista con usuarios ordenados por referidos

### 5. Test de Email (Si Resend está configurado)

1. Únete con un email real
2. Revisa tu inbox (incluye spam)
3. **Esperado**: Email con:
   - Mensaje de bienvenida
   - Link de referido
   - Link al leaderboard
   - Lista de milestones

### 6. Test de Stats Personales

1. Ve a http://localhost:3000/leaderboard
2. Ingresa tu email en el formulario
3. Click en "View Stats"
4. **Esperado**: Ver tu dashboard con:
   - Tu código de referido
   - Número de referidos
   - Tu posición en el leaderboard

## 🐛 Si algo no funciona

### Formulario no envía
- Revisa consola del navegador (F12)
- Revisa terminal del servidor
- Verifica que Supabase está conectado

### No se incrementan referidos
- Verifica que el código de referido existe
- Revisa logs del servidor
- Verifica que la función RPC existe en Supabase

### Email no llega
- Verifica `RESEND_API_KEY` en `.env.local`
- Revisa logs en Resend Dashboard
- Verifica que el dominio está verificado

### Leaderboard vacío
- Verifica políticas RLS en Supabase
- Verifica que hay datos en `waitlist_users`
- Revisa consola del navegador

## ✅ Checklist Rápido

- [ ] Servidor inicia sin errores
- [ ] Formulario funciona
- [ ] Redirige a `/thank-you`
- [ ] Usuario se crea en Supabase
- [ ] Referral link funciona
- [ ] Contador se incrementa
- [ ] Leaderboard se muestra
- [ ] Email llega (si está configurado)

---

**¡Listo para probar!** 🚀


