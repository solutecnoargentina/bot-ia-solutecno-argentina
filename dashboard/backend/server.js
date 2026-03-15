const express = require("express")
const app = express()

app.use(express.json())
app.use(express.static("../frontend"))

/* AGENTES IA */

let agentes = [
{
nombre:"Ventas",
prompt:"Eres asesor comercial de Solutecno Argentina"
}
]

app.get("/api/agentes",(req,res)=>{
res.json(agentes)
})

app.post("/api/agentes",(req,res)=>{
agentes.push(req.body)
res.json({status:"ok"})
})

/* CONVERSACIONES */

let conversaciones = []

app.get("/api/conversaciones",(req,res)=>{
res.json(conversaciones)
})

app.post("/api/conversaciones",(req,res)=>{
conversaciones.push(req.body)
res.json({status:"ok"})
})

/* SERVIDOR */

app.listen(4000,()=>{
console.log("Dashboard backend activo puerto 4000")
})
