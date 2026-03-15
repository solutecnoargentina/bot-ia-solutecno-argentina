const express = require("express")
const axios = require("axios")

const app = express()
app.use(express.json())

const EVOLUTION_API = "http://localhost:49959"
const INSTANCE = "Bot1"
const API_KEY = "bK7XzpXeq3VxxeWqYhdbsTE2eG2RwG3Z"

const OLLAMA_URL = "http://localhost:11434/api/generate"

const SYSTEM_PROMPT = `
Eres asesor comercial de Solutecno Argentina.

Servicios:
- Desarrollo web
- Bots de WhatsApp
- Automatizaciones
- Marketing digital
- Hosting

Responde siempre en español.
`

async function preguntarIA(texto) {

const response = await axios.post(OLLAMA_URL,{
model:"qwen2:1.5b",
prompt: SYSTEM_PROMPT + "\nCliente: " + texto,
stream:false
})

return response.data.response

}

app.post("/webhook", async (req,res)=>{

try{

const mensaje = req.body.data.message?.conversation

if(!mensaje){
return res.sendStatus(200)
}

const numero = req.body.data.key.remoteJid

console.log("Mensaje:",mensaje)

const respuesta = await preguntarIA(mensaje)

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

app.listen(3000,()=>{

console.log("BOT SOLUTECNO ACTIVO PUERTO 3000")

})
