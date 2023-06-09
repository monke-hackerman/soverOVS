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
    secret: "aWYgeW91IHJlYWQgdGhpcyB5b3UgYXJlIGEgYmlnIGxvc2VyIGxtYW8=",
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

    db.prepare("INSERT INTO Brukere (username, Fornavn, Etternavn, Email, TillgangNiva, PassordHash) VALUES (?, ?, ?, ?, ?, ?)").run(username, svr.FN, svr.EN, svr.email, svr.tilgang, hash)
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

        req.session.IsUserAdmin = false
        req.session.IsUserElev = false

        if(userData.TillgangNiva === 0){
            req.session.IsUserAdmin = true
        }else if(userData.TillgangNiva === 1){
            req.session.IsUserElev = true
        }else{
            req.session.IsUserAdmin = false
            req.session.IsUserElev = false
        }

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
        PersonName: req.session.username,
        frontpage: true,
        profilepage: false,
        adminpage: false,

          admin: req.session.IsUserAdmin,
            elev: req.session.IsUserElev,

    })
})
app.get("/profile" , (req, res) => {
    check(req, res)
    
    let brukerData = db.prepare(`SELECT * FROM brukere WHERE id = ?`).all(req.session.userID)

    res.render("profilepage.hbs", {
        PersonName: req.session.username,
        user: brukerData,

        frontpage: false,
        profilepage: true,
        adminpage: false,

        admin: req.session.IsUserAdmin,
        elev: req.session.IsUserElev,
    })
})

app.post("/userEDIT", (req, res) => {
    let svr = req.body

    for (const property in svr) {
        if (Object.keys(svr[property]).length !== 0 && property !== 'id') {
            console.log(`${property}: ${svr[property]}`);
            db.prepare(`UPDATE Brukere SET ${property} = ? WHERE id = ?`).run(svr[property], svr.id)

        }else{
            console.log("empty")
        }
      }
      let nameData = db.prepare(`SELECT * FROM brukere WHERE id = ?`).get(svr.id)

      let PREusername = nameData.Fornavn.slice(0,3) + nameData.Etternavn.slice(0,3)
      let username = ""
  
      let usernameCheck = db.prepare(`SELECT username FROM Brukere WHERE username = ?;`).all(PREusername)
      if(PREusername == usernameCheck.username){
          let size = Object.keys(usernameCheck).length;
          username = PREusername + size.toString()
      }else{
          username = PREusername
      }

      db.prepare(`UPDATE Brukere SET username = ? WHERE id = ?`).run(PREusername, svr.id)
    res.redirect("/profile")
})
app.post("/userDEL", (req, res) => {
    let svr = req.body
    db.prepare(`UPDATE Enheter SET Eier_id = NULL  WHERE Eier_id = ?`).run(svr.id)
    db.prepare(`DELETE FROM Brukere WHERE id = ?`).run(svr.id)
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
        adminpage: false,

        admin: req.session.IsUserAdmin,
        elev: req.session.IsUserElev,
    })
})

app.get("/elev", (req, res) => {
    check(req, res)

    let klasseID = db.prepare(`SELECT Klasse_id FROM Brukere WHERE id = ?`).get(req.session.userID)
    let klasse = db.prepare(`SELECT Navn FROM Klasse WHERE id = ?`).get(klasseID.Klasse_id)

    

    res.render("elevpage.hbs", {
        klasse: klasse.Navn,

        admin: req.session.IsUserAdmin,
        elev: req.session.IsUserElev,
    })
})

app.get("/admin", (req, res) =>{
    if(!req.session.IsUserAdmin){
        console.log("not admin")
        res.redirect("/")
    }

    let users = db.prepare(`SELECT * FROM brukere;`).all()

    res.render("adminpage.hbs", {
        user: users,

        frontpage: false,
        profilepage: false,
        adminpage: true,

        admin: req.session.IsUserAdmin,
        elev: req.session.IsUserElev,
    })
})

app.post("/delUSER", (req, res) => {
    let svr = req.body;
    db.prepare(`UPDATE Enheter SET Eier_id = NULL  WHERE Eier_id = ?`).run(svr.id)
    db.prepare(`DELETE FROM Brukere WHERE id = ?`).run(svr.id)
    res.redirect("/admin")
})
app.post("/editBruk", (req, res) => {
    let svr = req.body;

    console.log(svr)

    for (const property in svr) {
        if (Object.keys(svr[property]).length !== 0 && property !== 'id') {
            console.log(`${property}: ${svr[property]}`);
            db.prepare(`UPDATE Brukere SET ${property} = ? WHERE id = ?`).run(svr[property], svr.id)

        }else{
            console.log("empty")
        }
      }
    res.redirect("/admin")
})

app.get("/logout", (req, res) => {
    req.session.destroy()
    res.sendFile(rootpath + "/logg.html")
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