const express = require("express")
const axios = require("axios")
const fs = require("fs")
const path = require("path")

// ARCHIVOS
const conversationsFile="/opt/bot-ia-solutecno-argentina/dashboard/backend/conversations.json"
const agentsFile="/opt/bot-ia-solutecno-argentina/dashboard/backend/agents.json"

// CONFIG
const PORT = 3000
const OLLAMA_URL = "http://localhost:11434/api/generate"
const MODEL = "qwen2:1.5b"

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
// WEBHOOK WHATSAPP
// =============================

app.post("/webhook",async(req,res)=>{

try{

const message=req.body.data?.message?.conversation

const sender=req.body.data?.key?.remoteJid || "cliente"

if(!message){
return res.sendStatus(200)
}

console.log("Cliente:",sender)
console.log("Mensaje:",message)

const respuesta=await preguntarIA(message)

console.log("Respuesta IA:",respuesta)

// guardar conversación
saveConversation(sender,message,respuesta)

res.json({
reply:respuesta
})

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
