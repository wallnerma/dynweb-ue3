const http = require('http'),
    fs = require('fs'),
    util = require('util'),
    hbs = require('handlebars'),
    formidable = require('formidable'),
    url = require('url');

// Ensure image directory exists
const imgDir = "./images/";
if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir);
}

// Ensure data directory exists
const dataDir = "./data/";
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// -------
// Routing
const routes = [
    {
        rex: /^\/$/,
        methods: {
            'get': getHomepage
        }
    }, {
        rex: /^\/new\/{0,1}$/,
        methods: {
            'get': getPersistDataForm,
            'post': postPersistDataForm
        }
    }, {
        rex: /^\/images\/[0-9a-zA-Z-_]*\.(jpg|jpeg|png)\/{0,1}$/,
        methods: {
            'get': getImage
        }
    }, {
        rex: /^\/[0-9a-zA-Z-_]*\/{0,1}$/,
        methods: {
            'get': getUser
        }
    }, {
        rex: /^\/[0-9a-zA-Z-_]*\/edit\/{0,1}$/,
        methods: {
            'get': getEditUser,
            'post': postPersistDataForm
        }
    }
];

// Responsible to check request and call the right handler method that is producing the response
function dispatchRequest (req, res) {
    const parsedUrl = url.parse(req.url);
    const method = req.method.toLowerCase();

    const route = routes.find( route => {
        return route.rex.test(parsedUrl.pathname);
    });

    if (route) {
        // Only if route.methods[method] is falsy in the JavaScript sense, we respond with 405
        const handler = route.methods[method] || get405;
        handler(req, res);
    } else {
        get404(req, res);
    }
}

// -----------------------
// Request Handler Methods
function getHomepage (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(layout({ title: "Startseite", bodyPartial: 'homepage'}));
    res.end();
}

function getUser (req, res) {
    const parsedUrl = url.parse(req.url);
    let userName = parsedUrl.pathname.split("/")[1];

    //Get the Users Image File
    let imgSrc = "";
    fs.readdir(imgDir, (err, files) => {
        console.log("getUser userName: " + userName);

        //let regex = new RegExp("#" + userName + "#");
        //console.log("getUser regex: " + regex);

        const file = files.find(f => f.startsWith(userName));
        console.log("getUser file: " + file);

        imgSrc = file ? `/images/${file.toLowerCase()}` : "";
        console.log("getUser imgSrc: " + imgSrc + "\n");
    });

    //Get the Users JSON File
    fs.readFile(dataDir + userName + '.json', 'utf8', (err, data) => {
        if (err) {
            get404(req, res);
        }
        else {
            const fields = JSON.parse(data);

            if (userName === fields.nickname) {
                if(req.headers["if-modified-since"] && fields.ModifiedDate === req.headers["if-modified-since"])
                {
                    res.setHeader('Content-Type', 'text/html');
                    res.statusCode = 304;
                    res.end();
                } else {
                    res.setHeader('Content-Type', 'text/html');
                    res.setHeader('Last-Modified', fields.ModifiedDate);
                    res.statusCode = 200;
                    res.write(layout({title: userName + " - Profil", bodyPartial: 'persisted-data', data: fields, nickname: fields.nickname, imgSrc: imgSrc}));
                    res.end();
                }
            } else {
                get404(req, res);
            }
        }
    });
}

function getPersistDataForm (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(layout({ title: "Create a new user account", bodyPartial: 'simple-html-form', action: '/new'}));
    res.end();
}

function postPersistDataForm (req, res) {
    var form = new formidable.IncomingForm();
        form.keepExtensions = true;
        form.uploadDir = imgDir;
        form.parse(req, function(err, fields, files) {

        //Add Last-Modified Date
        let lastModifiedDate = new Date().toUTCString();
        fields.ModifiedDate = lastModifiedDate;

        //Upload Image
        const fileName = files.imagefile.name;
        const currentPath = files.imagefile.path;
        fs.renameSync(currentPath, form.uploadDir + fields.nickname + getFileExt(fileName).toLowerCase());

        // Store the data
        fs.writeFile(dataDir + fields.nickname + '.json', JSON.stringify(fields), 'utf8', (err) => {
            if (err) throw err;
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Location', "/" + fields.nickname);
            res.setHeader('Last-Modified', lastModifiedDate);
            res.statusCode = 303;
            res.write(layout({
                title: "Ressource geändert",
                bodyPartial: 'persist-data-form-success',
                resourceUri: fields.nickname}));
            res.end();
        });
    });
}

function getEditUser (req, res) {
    const parsedUrl = url.parse(req.url);
    let userName = parsedUrl.pathname.split("/")[1];

    //Get the Users Image File
    let imgSrc = "";
    fs.readdir(imgDir, (err, files) => {
        const file = files.find(f => f.startsWith(userName));
        imgSrc = file ? `/images/${file.toLowerCase()}` : "";
    });

    fs.readFile(dataDir + parsedUrl.pathname.split("/")[1] + '.json', 'utf8', (err, data) => {
        if (err) throw err;
        const fields = JSON.parse(data);
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.write(layout({ title: "Edit User", bodyPartial: 'edit-form',action: 'edit/',
                            nickname: fields.nickname ,
                            firstname: fields.firstname ,
                            lastname: fields.lastname,
                            description: fields.description,
                            fblink: fields.fblink,
                            twlink: fields.twlink,
                            xilink: fields.xilink,
                            imgSrc: imgSrc
                            }));
        res.end();
    })
}

// Handlers for file upload showcase
function getImageView (req, res) {
    const parsedUrl = url.parse(req.url);
    let imageName = parsedUrl.pathname.split("/")[2];
    fs.readdir(imgDir, (err, files) => {
        const file = files.find(f => f.startsWith(imageName));
        let imgSrc = file ? `/images/${file.toLowerCase()}` : "";

        res.setHeader('Content-Type', 'text/html');
        res.write(layout({ title: "Profile Picture", bodyPartial: 'image-view', imgSrc: imgSrc}));
        res.statusCode = 200;
        res.end();
    });
}

function getImage (req, res) {
    const parsedUrl = url.parse(req.url);
    const fileName = parsedUrl.pathname.split("/")[2];
    const fileExt = fileName.split(".")[1];

    if (fileName) {
        fs.readFile(imgDir + "/" + fileName, '', (err, data) => {
            if (err) {
                get404(req, res);
            } else {
                const contentType = fileExt === "jpeg" || fileExt === "jpg" ? "image/jpeg" : "image/png";
                res.statusCode = 200;
                res.setHeader('Content-Type', contentType);
                res.write(data);
                res.end();
            }
        });
    } else {
        get404(req, res);
    }
}

// HTTP redirection as the base for the Post-Redirect-Get pattern
function getRedirectBrowser (req, res) {
    res.statusCode = 303;
    res.setHeader('Location', '/simple-form');
    res.end();
}

// A small helper function getting the file extension
function getFileExt (fileName) {
    return fileName ? fileName.substr(fileName.lastIndexOf(".")) : "";
}

// HTTP error responses
function get405 (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 405;
    res.write(layout({ title: "Methode nicht erlaubt", bodyPartial: '405', method: req.method }));
    res.end();
}

function get404 (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 404;
    res.write(layout({ title: "Nicht gefunden", bodyPartial: '404'}));
    res.end();
}

function get500 (req, res, err) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 500;
    res.write(layout({ title: "Serverfehler", bodyPartial: '500', error: err.message}));
    res.end();
}

// --------------
// View Templates
const layout = hbs.compile(`<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>{{title}} - UE3</title>
            <style>
                html {
                    font-family: sans-serif;
                }
                body {
                    margin: 0;
                }
                nav {
                    display: inline;
                }
                li {
                    margin-bottom: 1em;
                }
                .subtle {
                    color: #999;
                }
                .small {
                    font-size: 0.875em;
                }
                .container {
                    margin: 0 auto;
                    max-width: 1024px;
                }
                #header, #header a {
                    background-color: #36F;
                    color: white;
                    padding: 2em 0;
                }
            </style>
        </head>
        <body>
            <div id="header">
                <div class="container">
                    <span>Dynamic Web UE3</span> &middot;
                    <nav><a href="/">Startseite</a></nav>
                </div>
            </div>
            <div class="container">
                {{> (lookup . 'bodyPartial') }}
            </div>
        </body>
    </html>`);

hbs.registerPartial('404',
    `<h1>404</h1>
     <p>Seite nicht gefunden. Zurück zur <a href="/">Startseite</a>.</p>`);

hbs.registerPartial('405',
    `<h1>405</h1>
     <p>Methode {{method}} nicht erlaubt. Zurück zur <a href="/">Startseite</a>.</p>`);

hbs.registerPartial('500',
    `<h1>500</h1>
     <p>Interner Serverfehler. Error:</p>
     <p style="font-style: italic; color: #d33; background-color: #eee; border-left: 2px solid #d33; padding: 8px 16px;">{{error}}</p>
     <p>Zurück zur <a href="/">Startseite</a>.</p>`);

hbs.registerPartial('homepage',
    `<h1>UE3 about.me clone</h1>
     <p>Create a page to present who you are and what you do in one link.</p>
     <ul>
        <li><a href="/new">Profil anlegen</a></li>
     </ul>`);

hbs.registerPartial('simple-html-form',
    `<h1>{{title}}</h1>
    <form action="{{action}}" method="post" enctype="multipart/form-data">
        <p><label>Benutzerkürzel: <input type="text" name="nickname"></label></p> 
        <p><label>Vorname: <input type="text" name="firstname"></label></p>     
        <p><label>Nachname: <input type="text" name="lastname"></label></p> 
        <p><textarea name="description" rows="10" cols="60">Fügen Sie hier Ihre Beschreibung ein.</textarea></p>
        <p><label>Facebook Link: <input type="text" name="fblink"></label></p> 
        <p><label>Twitter  Link: <input type="text" name="twlink"></label></p> 
        <p><label>Xing Link: <input type="text" name="xilink"></label></p>   
        <p><label>Bild: 
            <input type="file" accept="image/jpeg, image/png" name="imagefile">
        </label>
        </p>
        <p class="subtle small">Erlaubte Bildformate: JPEG und PNG!</p>         
        <p><button type="submit">Absenden</button></p>     
    </form>`);

hbs.registerPartial('edit-form',
    `<h1>{{title}}</h1>
     <form action="{{action}}" method="post" enctype="multipart/form-data">
        <img src="{{imgSrc}}" alt="Noch kein Bild vorhanden" style="width: 10em;">
        <p>
            <label>Bild: 
                <input type="file" accept="image/jpeg, image/png" name="imagefile">
            </label>
        </p>
        <p class="subtle small">Erlaubte Bildformate: JPEG und PNG!</p>
        <p><label>Benutzerkürzel: <input type="text" name="nickname" value = {{nickname}} readonly></label></p> 
        <p><label>Vorname: <input type="text" name="firstname" value = {{firstname}}></label></p>     
        <p><label>Nachname: <input type="text" name="lastname" value = {{lastname}}></label></p> 
        <p><textarea name="description" rows="10" cols="60">{{description}}</textarea></p>
        <p><label>Facebook Link: <input type="text" name="fblink" value = {{fblink}}></label></p> 
        <p><label>Twitter  Link: <input type="text" name="twlink" value = {{twlink}}></label></p> 
        <p><label>Xing Link: <input type="text" name="xilink" value = {{xilink}}></label></p>      
        <p><button type="submit">Absenden</button></p>     
     </form>`);

hbs.registerPartial('persist-data-form-success',
    `<h1>Your account has been added!</h1>
     <p>Link to your newly created <a href="{{resourceUri}}">userprofile</a>.</p>`);

hbs.registerPartial('persisted-data',
    `<h2>Userprofile:</h2>
     <ul>
     <img src="{{imgSrc}}" alt="Noch kein Bild vorhanden" style="width: 12em;">
     <br /><br />
     {{#each data}}
        {{#isLink @key }}
            <li>{{@key}}: <a href="http://{{this}}">{{this}}</a></li>
        {{else}}
            <li>{{@key}}: {{this}}</li>
        {{/isLink}}
     {{/each}}     
     </ul>
     <p><a href="{{nickname}}/edit">Edit &raquo;</a></p>`);

hbs.registerPartial('image-view',
    `<h1>{{title}}</h1>
     <p><img src="{{imgSrc}}" alt="Noch kein Bild vorhanden" style="width: 32em;"></p>
    `);

// --------------
// Helper
hbs.registerHelper("isLink", function (name, options) {
    if (name === "fblink" || name === "twlink" || name === "xilink"){
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// ---------------
// Server Creation
const server = http.createServer((request, response) => {
    try {
        dispatchRequest(request, response);
    } catch (err) {
        // Something in our server went wrong. We respond with the correct response code
        // and thereby prevent the node.js process from stopping.
        get500(request, response, err);
    }
});

server.listen(3000);