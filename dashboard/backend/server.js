const express = require("express")
const app = express()
app.use(express.static("../frontend"))
app.use(express.json())

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

app.listen(4000,()=>{
console.log("Dashboard backend activo puerto 4000")
})
