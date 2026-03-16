const express = require("express")
const axios = require("axios")
const fs = require("fs")
const conversationsFile="/opt/bot-ia-solutecno-argentina/dashboard/backend/conversations.json"
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
const path = require("path")

const app = express()
app.use(express.json())

// CONFIG
const PORT = 3000
const OLLAMA_URL = "http://localhost:11434/api/generate"
const MODEL = "qwen2:1.5b"

// archivo agentes
const agentsFile = "/opt/bot-ia-solutecno-argentina/dashboard/backend/agents.json"

// leer agentes
function getAgents(){
if(!fs.existsSync(agentsFile)){
return []
}
return JSON.parse(fs.readFileSync(agentsFile))
}

// obtener agente principal
function getAgent(){

const agents = getAgents()

if(agents.length === 0){
return {
name:"default",
personality:"Eres un asistente útil.",
knowledge:""
}
}

return agents[0]

}

// preguntar a la IA
async function preguntarIA(texto){

const agent = getAgent()

const prompt = `
PERSONALIDAD:
${agent.personality}

CONOCIMIENTO:
${agent.knowledge}

CLIENTE:
${texto}
`

const response = await axios.post(OLLAMA_URL,{
model:MODEL,
prompt:prompt,
stream:false
})

return response.data.response

}

// webhook evolution
app.post("/webhook",async(req,res)=>{

try{

const message = req.body.data?.message?.conversation

if(!message){
return res.sendStatus(200)
}

console.log("Mensaje cliente:",message)

const respuesta = await preguntarIA(message)

console.log("Respuesta IA:",respuesta)
saveConversation("cliente",message,respuesta)
res.json({
reply:respuesta
})

}catch(err){

console.log("ERROR:",err.message)
res.sendStatus(500)

}

})

app.listen(PORT,()=>{
console.log("BOT SOLUTECNO ACTIVO PUERTO",PORT)
})
