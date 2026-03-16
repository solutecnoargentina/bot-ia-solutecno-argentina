const express = require("express")
const axios = require("axios")

const app = express()

app.use(express.static("public"))

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
