const express = require("express")
const axios = require("axios")
const fs = require("fs")

// =============================
// ARCHIVOS
// =============================

const conversationsFile="/opt/bot-ia-solutecno-argentina/dashboard/backend/conversations.json"
const agentsFile="/opt/bot-ia-solutecno-argentina/dashboard/backend/agents.json"

// =============================
// CONFIG BOT
// =============================

const PORT = 3000

// OLLAMA
const OLLAMA_URL = "http://localhost:11434/api/generate"
const MODEL = "qwen2:1.5b"

// EVOLUTION API
const EVOLUTION_API = "http://localhost:49959"
const INSTANCE = "bot1"
const API_KEY = "A18324CBD9B9-4246-8C80-1BC0909067E2"

const app = express()
app.use(express.json())

// =============================
// GUARDAR CONVERSACIONES
// =============================

function saveConversation(cliente,mensaje,respuesta){

let data=[]

if(fs.existsSync(conversationsFile)){
data=JSON.parse(fs.readFileSync(conversationsFile))
}

data.push({
cliente:cliente,
mensaje:mensaje,
respuesta:respuesta,
fecha:new Date()
})

fs.writeFileSync(conversationsFile,JSON.stringify(data,null,2))

}

// =============================
// LEER AGENTES
// =============================

function getAgents(){

if(!fs.existsSync(agentsFile)){
return []
}

return JSON.parse(fs.readFileSync(agentsFile))

}

// =============================
// AGENTE ACTIVO
// =============================

function getAgent(){

const agents=getAgents()

if(agents.length===0){

return {
name:"default",
prompt:"Eres un asistente útil y respondes en español."
}

}

return agents[0]

}

// =============================
// CONSULTAR IA
// =============================

async function preguntarIA(texto){

const agent=getAgent()

const prompt=`

INSTRUCCIONES:
${agent.prompt}

CLIENTE:
${texto}

RESPUESTA:
`

try{

const response=await axios.post(OLLAMA_URL,{
model:MODEL,
prompt:prompt,
stream:false
})

return response.data.response

}catch(err){

console.log("Error Ollama:",err.message)

return "Lo siento, hubo un problema al generar la respuesta."

}

}

// =============================
// ENVIAR MENSAJE WHATSAPP
// =============================

async function enviarWhatsapp(numero,texto){

try{

await axios.post(
`${EVOLUTION_API}/message/sendText/${INSTANCE}`,
{
number:numero,
text:texto
},
{
headers:{
apikey:API_KEY
}
})

}catch(err){

console.log("Error enviando mensaje:",err.message)

}

}

// =============================
// WEBHOOK WHATSAPP
// =============================

app.post("/webhook",async(req,res)=>{

try{

// detectar mensaje correctamente
const message =
req.body.data?.message?.conversation ||
req.body.data?.message?.extendedTextMessage?.text ||
null

const sender=req.body.data?.key?.remoteJid || null

if(!message || !sender){
return res.sendStatus(200)
}

const numero=sender.split("@")[0]

console.log("Cliente:",numero)
console.log("Mensaje:",message)

// IA
const respuesta=await preguntarIA(message)

console.log("Respuesta IA:",respuesta)

// guardar conversación
saveConversation(numero,message,respuesta)

// enviar respuesta a whatsapp
await enviarWhatsapp(numero,respuesta)

res.sendStatus(200)

}catch(err){

console.log("ERROR BOT:",err.message)

res.sendStatus(500)

}

})

// =============================
// INICIAR BOT
// =============================

app.listen(PORT,()=>{

console.log("BOT SOLUTECNO ACTIVO PUERTO",PORT)

})
