const express = require("express")
const fs = require("fs")
const axios = require("axios")
const path = require("path")
const crypto = require("crypto")

const app = express()

app.use(express.json())

app.use(express.static(path.join(__dirname,"../frontend")))

const AGENTS_FILE = path.join(__dirname,"agents.json")
const conversationsFile = path.join(__dirname,"conversations.json")

// ======================
// LOGIN ADMIN
// ======================

const ADMIN_USER = "admin"
const ADMIN_PASS = "solutecno123"
const activeTokens = new Set()

function authMiddleware(req,res,next){

if(req.path === "/login"){
return next()
}

const token = req.headers["x-admin-token"]

if(!token || !activeTokens.has(token)){
return res.status(401).json({error:"no autorizado"})
}

next()

}

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
// LOGIN / LOGOUT
// ======================

app.post("/login",(req,res)=>{

const user = req.body.user
const pass = req.body.pass

if(user === ADMIN_USER && pass === ADMIN_PASS){

const token = crypto.randomBytes(32).toString("hex")
activeTokens.add(token)

return res.json({
status:"ok",
token:token
})

}

return res.status(401).json({
status:"error",
message:"credenciales invalidas"
})

})

app.post("/logout",authMiddleware,(req,res)=>{

const token = req.headers["x-admin-token"]

if(token){
activeTokens.delete(token)
}

res.json({status:"logout ok"})

})

// ======================
// AGENTES IA
// ======================

app.get("/agents",authMiddleware,(req,res)=>{

const agents = JSON.parse(fs.readFileSync(AGENTS_FILE))

res.json(agents)

})

app.post("/agents",authMiddleware,(req,res)=>{

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
// EDITAR AGENTE
// ======================

app.put("/agents/:id",authMiddleware,(req,res)=>{

const id=parseInt(req.params.id)

const agents = JSON.parse(fs.readFileSync(AGENTS_FILE))

if(!agents[id]){
return res.json({error:"agente no existe"})
}

agents[id]={
name:req.body.name,
prompt:req.body.prompt
}

fs.writeFileSync(AGENTS_FILE,JSON.stringify(agents,null,2))

res.json({status:"editado"})

})

// ======================
// ELIMINAR AGENTE
// ======================

app.delete("/agents/:id",authMiddleware,(req,res)=>{

const id=parseInt(req.params.id)

let agents = JSON.parse(fs.readFileSync(AGENTS_FILE))

if(!agents[id]){
return res.json({error:"agente no existe"})
}

agents.splice(id,1)

fs.writeFileSync(AGENTS_FILE,JSON.stringify(agents,null,2))

res.json({status:"eliminado"})

})

// ======================
// ESTADO SISTEMA
// ======================

app.get("/status",authMiddleware, async (req,res)=>{

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

app.get("/conversations",authMiddleware,(req,res)=>{

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
/*
// ======================
// LOGIN
// ======================


let sessions = {}

app.post("/login",(req,res)=>{

const {user,pass} = req.body

if(user === ADMIN_USER && pass === ADMIN_PASS){

const token = crypto.randomBytes(16).toString("hex")

sessions[token] = true

return res.json({token})

}

res.status(401).json({error:"Credenciales incorrectas"})

})


// ======================
// MIDDLEWARE AUTH
// ======================

function auth(req,res,next){

const token = req.headers["x-admin-token"]

if(!token || !activeTokens.has(token)){
return res.status(401).json({error:"No autorizado"})
}

next()
*/

