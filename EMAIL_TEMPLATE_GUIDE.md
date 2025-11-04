# 📧 Guía para Editar el Email de Bienvenida

## 📍 Ubicación del Código

**Archivo**: `src/app/api/waitlist/join/route.ts`  
**Función**: `sendWelcomeEmail()` (líneas ~97-163)  
**Línea donde empieza el HTML**: ~114

## 📝 Estructura del Email

El email está dividido en secciones claramente marcadas con comentarios:

### 1. **Asunto del Email** (línea ~113)
```javascript
subject: 'Welcome to HIHODL Beta! 🚀'
```

### 2. **Mensaje de Bienvenida** (líneas ~123-129)
```html
<h1>Welcome ${displayName}! 🎉</h1>
<p>You're now part of the HIHODL beta waitlist...</p>
<p>Share your referral link to climb the leaderboard...</p>
```

### 3. **Link de Referido Único** (líneas ~130-135)
```html
<div>
  <p>Your Referral Link:</p>
  <a href="${referralLink}">${referralLink}</a>
</div>
```

### 4. **Link al Leaderboard** (líneas ~136-140)
```html
<a href="https://www.hihodl.xyz/leaderboard">
  View Leaderboard →
</a>
```

### 5. **Lista de Milestones** (líneas ~141-150)
```html
<h3>Milestones to Unlock:</h3>
<ul>
  <li>🏗️ Builders Club — at 3 referrals</li>
  <li>⭐ Priority Beta — at 10 referrals</li>
  ...
</ul>
```

### 6. **Firma** (líneas ~151-154)
```html
<p>See you at the top! 🚀<br/>The HIHODL Team</p>
```

## ✏️ Cómo Editar

### Para cambiar el texto:
1. Abre `src/app/api/waitlist/join/route.ts`
2. Busca la función `sendWelcomeEmail()` (línea ~97)
3. Edita el HTML dentro del template string (líneas ~114-158)
4. Los comentarios `<!-- 📝 MENSAJE DE BIENVENIDA -->` te indican cada sección

### Variables disponibles:
- `${displayName}` - Nombre del usuario
- `${referralCode}` - Código de referido (8 caracteres)
- `${referralLink}` - Link completo: `https://www.hihodl.xyz/?ref=${referralCode}`

### Ejemplo de cambio:

**Antes:**
```javascript
<p>You're now part of the HIHODL beta waitlist...</p>
```

**Después:**
```javascript
<p>¡Bienvenido a HIHODL! Has sido aceptado en nuestra beta exclusiva...</p>
```

## 🎨 Estilos

El email usa estilos inline (necesarios para emails). Los colores principales son:
- **Fondo**: `#0A141E` (oscuro)
- **Texto**: `#eaf6ff` (claro)
- **Acento**: `#FFB703` (amarillo/dorado)
- **Texto secundario**: `#94a3b8`

## ✅ Después de Editar

1. Guarda el archivo
2. Reinicia el servidor: `npm run dev`
3. Prueba uniéndote a la waitlist
4. Revisa tu email para ver los cambios

## 📧 Preview Local

Para ver cómo se ve el email sin enviarlo:
1. Puedes hacer console.log del HTML
2. O usar herramientas como https://putsmail.com/ para testing

---

**Tip**: Si quieres cambiar el diseño completo, mantén los estilos inline ya que muchos clientes de email no soportan CSS externo.


