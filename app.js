const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("better-sqlite3")("EksamenDB.db"/*, { verbose: console.log }*/); //verbose er i en kommentar når koden faktisk skal kjøre siden den er der kun for feilsøking
const hbs = require('hbs')
const app = express();

const rootpath = path.join(__dirname, "static")

app.use(express.static(path.join(__dirname, "other"))); 
const viewPath = path.join(__dirname, "/views/pages")
const partialsPath = path.join(__dirname, "/views/partials")
app.set("view engine", hbs)
app.set('views', viewPath)
hbs.registerPartials(partialsPath)
app.use(express.urlencoded({ extended: true }))

app.use(session({
    secret: "aWYgeW91IHJlYWQgdGhpcyB1IGFyZWlmIHlvdSByZWFkIHRoaXMgdSBhcmUgYSBtZWdhIGxvc2VyIGxtYW8gYSBtZWdhIGxvc2VyIGxtYW8=",
    resave: false,
    saveUninitialized: false
}))

app.get("/reg.html", (req, res) => {
    res.sendFile(rootpath + "/reg.html")
    
})
app.post(("/NyBruk"), async (req, res) => {
    let svr = req.body

    let hash = await bcrypt.hash(svr.passord, 10)

    let PREusername = svr.FN.slice(0,3) + svr.EN.slice(0,3)
    let username = ""

    let usernameCheck = db.prepare(`SELECT username FROM Brukere WHERE username = ?;`).all(PREusername)
    if(PREusername == usernameCheck.username){
        let size = Object.keys(usernameCheck).length;
        username = PREusername + size.toString()
    }else{
        username = PREusername
    }

    db.prepare("INSERT INTO Brukere (username, Fornavn, Etternavn, Email, TillgangNiva, PassordHash, Rolle) VALUES (?, ?, ?, ?, ?, ?, ?)").run(username, svr.FN, svr.EN, svr.email, svr.tilgang, hash, svr.rolle)
    res.redirect("/admin")
})
app.post(("/login"), async (req, res, next) => {
    let svr = req.body

    let userData = db.prepare(`SELECT * FROM Brukere WHERE username= ?;`).get(svr.userN);
    console.log(userData)

    if (!userData) {
        return res.redirect("/?error=not_found")
    }

    if (await bcrypt.compare(svr.password, userData.PassordHash)) {
        req.session.username = userData.username
        req.session.userID = userData.id
        req.session.loggedin = true

        console.log(req.session.loggedin)
        res.redirect("/hoved")

    } else {
        console.log("fuck off")
        res.sendFile(rootpath + "/logg.html")
        
        req.session.loggedin = false
    }
})
app.get("/", Hoved)
app.get("/Hoved", Hoved)

function Hoved(req, res) {
    if (req.session.loggedin) {
        console.log("ye got inn", req.session.username)

        res.redirect("/front")
    } else {
        res.sendFile(rootpath + "/logg.html")
        
        console.log("not logged inn")
    }
}

function check(req, res){
    if (!req.session.loggedin) {
        res.sendFile(rootpath + "/logg.html")
        
        console.log("not logged inn")
    }
}

app.get("/front" , (req, res) => {
    check(req, res)
    
    res.render("frontpage.hbs", {
        msg: msg,
        PersonName: req.session.username,
        frontpage: true,
        profilepage: false,
    })
})
app.get("/profile" , (req, res) => {
    check(req, res)
    
    res.render("profilepage.hbs", {
        PersonName: req.session.username,
        frontpage: false,
        profilepage: true,
    })
})

app.post("/changePW", async (req, res) => {
    let svr = req.body;
    if(svr.newpassword === svr.newpassword2){
        if(await bcrypt.compare(svr.oldpassword, req.session.hash)){
            let hash = await bcrypt.hash(svr.newpassword, 10)
            db.prepare("UPDATE bruker SET PassordHash = ? WHERE id = ?").run(hash, req.session.userID)
            msg = "passord oppdatert"
        }else{
            msg = "Gamelt passord er ikke riktig"
        }
    }else{
        msg = "nye passord matcher ikke"
    }

    res.render("frontpage.hbs", {
        msg: msg,
        PersonName: req.session.username,
        frontpage: true,
        profilepage: false,
    })
})

//prøver å stoppe serveren fra å stoppe hvis den krasjer
app.use((err, req, res, next) => {
    console.warn(err.stack)
    res.status(500).send("error 500 internal server error")
})

//hvilken port appen er på
app.listen("3000", () => {
    console.log("Server listening at http://localhost:3000")
})