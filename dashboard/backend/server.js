const express = require("express")
const fs = require("fs")
const axios = require("axios")
const path = require("path")

const app = express()

app.use(express.json())

app.use(express.static(path.join(__dirname,"../frontend")))

const AGENTS_FILE = path.join(__dirname,"agents.json")
const conversationsFile = path.join(__dirname,"conversations.json")

// ======================
// CREAR ARCHIVOS SI NO EXISTEN
// ======================

if(!fs.existsSync(AGENTS_FILE)){
fs.writeFileSync(AGENTS_FILE,"[]")
}

if(!fs.existsSync(conversationsFile)){
fs.writeFileSync(conversationsFile,"[]")
}


// ======================
// AGENTES IA
// ======================

app.get("/agents",(req,res)=>{

const agents = JSON.parse(fs.readFileSync(AGENTS_FILE))

res.json(agents)

})

app.post("/agents",(req,res)=>{

console.log("Guardando agente")

const agents = JSON.parse(fs.readFileSync(AGENTS_FILE))

agents.push({
name:req.body.name,
prompt:req.body.prompt
})

fs.writeFileSync(AGENTS_FILE,JSON.stringify(agents,null,2))

res.json({status:"guardado"})

})


// ======================
// ESTADO SISTEMA
// ======================

app.get("/status", async (req,res)=>{

let bot="online"
let ollama="offline"
let evolution="offline"

// verificar ollama

try{

await axios.get("http://localhost:11434")

ollama="online"

}catch(e){
console.log("Ollama no responde")
}

// verificar evolution

try{

await axios.get("http://localhost:49959/instance/fetchInstances",{
headers:{
apikey:"A18324CBD9B9-4246-8C80-1BC0909067E2"
}
})

evolution="online"

}catch(e){
console.log("Evolution no responde")
}

res.json({
bot,
ollama,
evolution
})

})


// ======================
// HISTORIAL CONVERSACIONES
// ======================

app.get("/conversations",(req,res)=>{

if(!fs.existsSync(conversationsFile)){
return res.json([])
}

res.json(JSON.parse(fs.readFileSync(conversationsFile)))

})


// ======================
// INICIAR SERVIDOR
// ======================

app.listen(4000,"0.0.0.0",()=>{

console.log("Dashboard backend activo puerto 4000")

})
