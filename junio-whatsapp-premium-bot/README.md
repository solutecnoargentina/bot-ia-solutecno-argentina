# Solutecno Premium WhatsApp Bot

Bot de WhatsApp con QR para **Solutecno Argentina**, pensado para operar en modo privado y con una capa de automatizacion programable.

## Que hace

- Responde solo a mensajes nuevos.
- Ignora grupos, estados, canales y newsletters.
- No responde a mensajes antiguos ni al historial.
- Evita bucles con deduplicacion persistente de mensajes.
- Soporta reglas por `rules.json`.
- Soporta un webhook externo para que el bot actue como agente programable.

## Que no hace

- No publica en tu nombre.
- No responde en grupos.
- No responde a estados.
- No procesa mensajes viejos cargados al reconectar.
- No entra en bucle con sus propias respuestas.

## Requisitos

- Node.js 18 o superior.
- Cuenta de WhatsApp para escanear el QR.

## Instalacion

1. Instala dependencias:

```bash
npm install
```

2. Copia la configuracion de ejemplo:

```bash
copy .env.example .env
```

3. Edita `.env` con tu numero y tus preferencias.

4. Ejecuta el bot:

```bash
npm start
```

5. Escanea el QR desde WhatsApp.

## Programacion

Edita `rules.json` para cambiar respuestas sin tocar el codigo.

Ejemplo de regla:

```json
{
  "name": "ventas",
  "triggers": ["precio", "cotizacion", "presupuesto"],
  "reply": "Gracias por tu consulta. Decime que servicio necesitas y te preparo una respuesta."
}
```

## Agente externo

Si definis `REPLY_WEBHOOK_URL`, el bot envia este payload JSON:

```json
{
  "botName": "Solutecno Premium",
  "remoteJid": "5491112345678@s.whatsapp.net",
  "messageId": "ABC123",
  "text": "Hola, necesito soporte",
  "contactName": "Cliente",
  "timestamp": 1717960000,
  "isPrivateChat": true
}
```

El webhook puede responder con:

- JSON: `{ "reply": "texto" }`
- Texto plano

## Variables clave

- `OWNER_NUMBER`: numero duenio/operador.
- `ALLOWED_NUMBERS`: lista opcional de numeros permitidos.
- `BLOCKED_NUMBERS`: lista opcional de numeros bloqueados.
- `MAX_MESSAGE_AGE_SECONDS`: ventana para aceptar mensajes nuevos.
- `DEFAULT_REPLY`: respuesta si no hay regla ni webhook.

## Recomendacion

Para uso real, manten `ALLOWED_NUMBERS` vacio solo si queres atender a todos los contactos privados. Si queres un modo mas cerrado, carga solo los numeros autorizados.
