# 📧 Configurar Resend con Cloudflare

## Pasos para verificar tu dominio

### 1. En Resend Dashboard
1. Ve a https://resend.com/domains
2. Click en **"Add Domain"**
3. Ingresa: `hihodl.xyz`
4. Copia los registros DNS que Resend te muestra

### 2. En Cloudflare Dashboard

1. **Ve a tu dominio en Cloudflare**
   - https://dash.cloudflare.com
   - Selecciona `hihodl.xyz`

2. **Abre la sección DNS**
   - Click en "DNS" → "Records"

3. **Agrega los registros que Resend te dio:**

#### Registro SPF (TXT)
```
Type: TXT
Name: @ (o hihodl.xyz)
Content: v=spf1 include:resend.com ~all
TTL: Auto
Proxy: DESACTIVADO (nube gris)
```

#### Registro DKIM (TXT)
```
Type: TXT
Name: resend._domainkey (o el nombre que Resend te dé)
Content: [La clave pública que Resend te da]
TTL: Auto
Proxy: DESACTIVADO (nube gris)
```

#### Registro DMARC (TXT) - Opcional pero recomendado
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none; rua=mailto:your-email@hihodl.xyz
TTL: Auto
Proxy: DESACTIVADO (nube gris)
```

### 3. ⚠️ IMPORTANTE: Desactivar Proxy

**Para TODOS los registros de email:**
- El ícono de la nube debe estar **GRIS** (desactivado)
- Si está **NARANJA** (activado), el email no funcionará
- Click en la nube para desactivarla

### 4. Verificar en Resend

1. Vuelve a Resend Dashboard
2. Click en "Verify" en tu dominio
3. Espera 5-15 minutos (puede tardar hasta 48h)
4. Cuando esté verificado, verás un check verde ✅

### 5. Configurar el From Email

Una vez verificado, puedes usar cualquier email del dominio:

```
RESEND_FROM_EMAIL=HIHODL <noreply@hihodl.xyz>
```

O:

```
RESEND_FROM_EMAIL=HIHODL <hello@hihodl.xyz>
```

## 🔍 Verificar que los registros están correctos

Puedes verificar tus registros DNS con:

```bash
# SPF
dig TXT hihodl.xyz

# DKIM
dig TXT resend._domainkey.hihodl.xyz

# DMARC
dig TXT _dmarc.hihodl.xyz
```

## ⚡ Configuración rápida (resumen)

1. ✅ Resend → Add Domain → Copia registros
2. ✅ Cloudflare → DNS → Add records
3. ✅ **Desactiva proxy** (nube gris) en todos los registros
4. ✅ Resend → Verify
5. ✅ Espera verificación (5-15 min típico)
6. ✅ Agrega `RESEND_FROM_EMAIL` a `.env.local`

## 🐛 Troubleshooting

**"Domain verification failed"**
- Espera más tiempo (hasta 48h)
- Verifica que los registros están correctos
- Asegúrate que el proxy está DESACTIVADO

**"Email not sending"**
- Verifica que el dominio está verificado en Resend
- Revisa que `RESEND_API_KEY` está en `.env.local`
- Verifica logs en Resend Dashboard → Logs

**Emails van a spam**
- Agrega el registro DMARC
- Verifica que SPF y DKIM están correctos
- Usa un email válido para DMARC rua

---

**¿Necesitas ayuda?** Los registros exactos dependen de lo que Resend te muestre. Cada dominio tiene sus propios valores DKIM.


