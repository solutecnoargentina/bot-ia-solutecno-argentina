const express = require("express")
const fs = require("fs")
const axios = require("axios")

const app = express()

app.use(express.json())
app.use(express.static("frontend"))

const AGENTS_FILE = "./agents.json"

// crear archivo si no existe
if(!fs.existsSync(AGENTS_FILE)){
fs.writeFileSync(AGENTS_FILE,"[]")
}

// obtener agentes
app.get("/agents",(req,res)=>{

try{

const agents = JSON.parse(fs.readFileSync(AGENTS_FILE))
res.json(agents)

}catch(e){

res.json([])

}

})

// crear agente
app.post("/agents",(req,res)=>{

try{

const agents = JSON.parse(fs.readFileSync(AGENTS_FILE))

const nuevo = {
name:req.body.name,
prompt:req.body.prompt
}

agents.push(nuevo)

fs.writeFileSync(AGENTS_FILE,JSON.stringify(agents,null,2))

res.json({status:"ok"})

}catch(e){

res.json({error:"no se pudo guardar"})

}

})

// estado sistema
app.get("/status", async (req,res)=>{

let bot="online"
let ollama="offline"
let evolution="offline"

try{

await axios.get("http://localhost:11434")
ollama="online"

}catch{}

try{

await axios.get("http://localhost:8080")
evolution="online"

}catch{}

res.json({
bot,
ollama,
evolution
})

})

app.listen(4000,"0.0.0.0",()=>{

console.log("Dashboard backend activo puerto 4000")

})
