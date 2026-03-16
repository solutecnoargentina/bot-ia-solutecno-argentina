const express = require("express")
const fs = require("fs")
const axios = require("axios")
const path = require("path")

const app = express()

app.use(express.json())

app.use(express.static(path.join(__dirname,"../frontend")))

const AGENTS_FILE = path.join(__dirname,"agents.json")

if(!fs.existsSync(AGENTS_FILE)){
fs.writeFileSync(AGENTS_FILE,"[]")
}

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
