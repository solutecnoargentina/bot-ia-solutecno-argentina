const express = require("express")
const axios = require("axios")
const fs = require("fs")

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
// ARCHIVOS
// =============================

const agentsFile = "/opt/bot-ia-solutecno-argentina/dashboard/backend/agents.json"
const conversationsFile = "/opt/bot-ia-solutecno-argentina/dashboard/backend/conversations.json"
const statsFile = "/opt/bot-ia-solutecno-argentina/dashboard/backend/stats.json"
// =============================
// MEMORIA ANTILOOP
// =============================

const processedMessages = new Set()
const lastMessagePerUser = {}
// =============================
// LIMPIAR RESPUESTA IA
// =============================

function limpiarRespuesta(texto){

if(!texto) return ""

let limpio = texto
.replace(/\n/g," ")
.replace(/\s+/g," ")
.replace(/[^\wáéíóúñÁÉÍÓÚ¿?¡!., ]/g,"")
.trim()

return limpio

}

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

const activeAgent = agents.find(agent => agent.active === true)

if(activeAgent){
return activeAgent
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

// ID UNICO DEL MENSAJE
const messageId = req.body.data?.key?.id || null

// detectar mensaje
const message =
req.body.data?.message?.conversation ||
req.body.data?.message?.extendedTextMessage?.text ||
null

const sender=req.body.data?.key?.remoteJid || null

// detectar si el mensaje es del propio bot
const fromMe = req.body.data?.key?.fromMe || false

// =============================
// FILTROS ANTILOOP
// =============================

// ignorar mensajes del propio bot
if(fromMe){
return res.sendStatus(200)
}

// ignorar si no hay datos
if(!message || !sender){
return res.sendStatus(200)
}

// control fuerte anti duplicados
if(messageId){

if(processedMessages.has(messageId)){
console.log("Mensaje duplicado ignorado:",messageId)
return res.sendStatus(200)
}

processedMessages.add(messageId)

// limpiar memoria después
setTimeout(()=>{
processedMessages.delete(messageId)
},300000)

}

// limpiar memoria cada 5 minutos
setTimeout(()=>{
processedMessages.delete(messageId)
},300000)

// =============================
// FILTRO PARA EVITAR
// GRUPOS / ESTADOS / CANALES
// =============================

if(
sender.endsWith("@g.us") ||
sender.endsWith("@broadcast") ||
sender.endsWith("@newsletter")
){
console.log("Mensaje ignorado (grupo/estado/canal):",sender)
return res.sendStatus(200)
}

// permitir SOLO chat privado
if(!sender.endsWith("@s.whatsapp.net")){
console.log("Mensaje ignorado (no es chat privado):",sender)
return res.sendStatus(200)
}

// =============================

const numero=sender.split("@")[0]
// anti loop por tiempo (5 segundos)
const now = Date.now()

if(lastMessagePerUser[numero] && (now - lastMessagePerUser[numero]) < 5000){
console.log("Mensaje ignorado por loop:",numero)
return res.sendStatus(200)
}

lastMessagePerUser[numero] = now
console.log("Cliente:",numero)
console.log("Mensaje:",message)

// IA
let respuesta=await preguntarIA(message)

// limpiar respuesta
respuesta = limpiarRespuesta(respuesta)

console.log("Respuesta IA:",respuesta)

// guardar conversación
saveConversation(numero,message,respuesta)
try{

let stats = []

if(fs.existsSync(statsFile)){
stats = JSON.parse(fs.readFileSync(statsFile))
}

stats.push({
cliente: numero,
mensaje: message,
respuesta: respuesta,
fecha: new Date()
})

fs.writeFileSync(statsFile, JSON.stringify(stats,null,2))

}catch(e){
console.log("Error guardando stats:",e.message)
}
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
