const express = require("express")
const axios = require("axios")

const app = express()
app.use(express.json())

/* CONFIGURACION */

const EVOLUTION_API = "http://localhost:49959"
const INSTANCE = "Bot1"
const API_KEY = "bK7XzpXeq3VxxeWqYhdbsTE2eG2RwG3Z"

const OLLAMA_URL = "http://localhost:11434/api/generate"

/* API DASHBOARD */

const DASHBOARD_API = "http://72.60.12.34:4000/api/conversaciones"

/* PROMPT IA */

const SYSTEM_PROMPT = `
Eres asesor comercial de Solutecno Argentina.

Servicios:
- Desarrollo web
- Bots de WhatsApp
- Automatizaciones
- Marketing digital
- Hosting

Responde siempre en español.
Respuestas cortas y profesionales.
`

/* CONSULTAR IA */

async function preguntarIA(texto){

const response = await axios.post(OLLAMA_URL,{
model:"qwen2:1.5b",
prompt: SYSTEM_PROMPT + "\nCliente: " + texto,
stream:false
})

return response.data.response

}

/* WEBHOOK WHATSAPP */

app.post("/webhook", async (req,res)=>{

try{

const mensaje = req.body.data.message?.conversation

if(!mensaje){
return res.sendStatus(200)
}

const numero = req.body.data.key.remoteJid

console.log("Mensaje:",mensaje)

/* GUARDAR MENSAJE CLIENTE */

await axios.post(DASHBOARD_API,{
numero:numero,
mensaje:mensaje,
tipo:"cliente"
})

/* PREGUNTAR A IA */

const respuesta = await preguntarIA(mensaje)

/* GUARDAR RESPUESTA BOT */

await axios.post(DASHBOARD_API,{
numero:numero,
mensaje:respuesta,
tipo:"bot"
})

/* ENVIAR RESPUESTA WHATSAPP */

await axios.post(
`${EVOLUTION_API}/message/sendText/${INSTANCE}`,
{
number:numero,
text:respuesta
},
{
headers:{
apikey:API_KEY
}
})

res.sendStatus(200)

}catch(err){

console.log(err)
res.sendStatus(500)

}

})

/* SERVIDOR */

app.listen(3000,()=>{

console.log("BOT SOLUTECNO ACTIVO PUERTO 3000")

})
