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
// Routing is the mechanism of analyzing the request and
// forwarding it to the right receiver, in our case a function
// that then produces the proper response.
//
// How to use?
// A path is defined by a regular expression.
// Methods shall be lowercase.
const routes = [
    {
        rex: /^\/$/,
        methods: {
            'get': getHomepage
        }
    }, {    //delete
        rex: /^\/old-homepage\/{0,1}$/,
        methods: {
            'get': getOldHomepage
        }
    }, {
        rex: /^\/simple-form\/{0,1}$/,
        methods: {
            'get': getSimpleForm,
            'post': postSimpleForm
        }
    }, {
        rex: /^\/new\/{0,1}$/,
        methods: {
            'get': getPersistDataForm,
            'post': postPersistDataForm
        }
    }, {
        rex: /^\/persisted-data\/{0,1}$/,
        methods: {
            'get': getPersistedData,
        }
    }, {
        rex: /^\/einfaches-html-form\/{0,1}$/,
        methods: {
            'get': getRedirectBrowser,
        }
    }, {
        rex: /^\/image\/upload\/{0,1}$/,
        methods: {
            'get': getImageUploadForm,
            'post': postImageUploadForm
        }
    }, {
        rex: /^\/image\/{0,1}$/,
        methods: {
            'get': getImageView
        }
    }, {
        rex: /^\/images\/image\.(jpg|jpeg|png)$/,
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
            'get': getEditUser
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

//delete
function getOldHomepage (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(layout({ title: "Startseite", bodyPartial: 'oldHomepage'}));
    res.end();
}

function getUser (req, res) {
    const parsedUrl = url.parse(req.url);
    let userName = parsedUrl.pathname.split("/")[1];
    fs.readFile(dataDir + userName + '.json', 'utf8', (err, data) => {
        if (err) {
            get404(req, res);
        }
        else {
            const fields = JSON.parse(data);

            if (userName === fields.nickname) {
                res.setHeader('Content-Type', 'text/html');
                res.statusCode = 200;
                res.write(layout({title: userName + " - Profil", bodyPartial: 'persisted-data', data: fields}));
                res.end();

            } else {
                get404(req, res);
            }
        }
    })
}

// Handlers for showing how to process form data
function getSimpleForm (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(layout({ title: "Simples HTML Formular", bodyPartial: 'simple-html-form', action: '/simple-form'}));
    res.end();
}

function postSimpleForm (req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Location', "/" + fields.nickname);
        res.statusCode = 201;
        res.write(layout({
            title: "Ressource erzeugt",
            bodyPartial: 'simple-html-form-success',
            resourceUri: '/' + fields.nickname,
            requestBody: util.inspect(fields)}));
        res.end();
    });
}

// Handlers for showing how to persist form data
function getPersistDataForm (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(layout({ title: "Create a new user account", bodyPartial: 'simple-html-form', action: '/new'}));
    res.end();
}

function postPersistDataForm (req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        // Store the data
        fs.writeFile(dataDir + fields.nickname + '.json', JSON.stringify(fields), 'utf8', (err) => {
            if (err) throw err;
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Location', "/" + fields.nickname);

            // Note: sample server is sloppy and doesn't differentiate between the resource
            // just being created (resulting in 201) and it being changed (resulting in 200)
            res.statusCode = 303;
            res.write(layout({
                title: "Ressource geändert",
                bodyPartial: 'persist-data-form-success',
                resourceUri: fields.nickname}));
            res.end();

        });
    });
}

function getPersistedData (req, res) {
    fs.readFile('person.json', 'utf8', (err, data) => {
        if (err) throw err;
        const fields = JSON.parse(data);
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.write(layout({ title: "Zuletzt persistierte Daten", bodyPartial: 'persisted-data', data: fields }));
        res.end();
    })
}

function getEditUser (req, res) {
    const parsedUrl = url.parse(req.url);
    fs.readFile('./data/' + parsedUrl.pathname.split("/")[1] + '.json', 'utf8', (err, data) => {
        if (err) throw err;
        const fields = JSON.parse(data);
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.write(layout({ title: "Edit User", bodyPartial: 'edit-form',action: fields.nickname + '/edit', nickname: fields.nickname }));
        res.end();
    })
}

// Handlers for file upload showcase
function getImageView (req, res) {
    fs.readdir(imgDir, (err, files) => {
        const file = files.find(f => f.startsWith("image"));
        const imgSrc = file ? `/images/${file.toLowerCase()}` : "";

        res.setHeader('Content-Type', 'text/html');
        res.write(layout({ title: "Bildanzeige", bodyPartial: 'image-view', imgSrc: imgSrc}));
        res.statusCode = 200;
        res.end();
    });
}

function getImageUploadForm (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(layout({ title: "Bild hochladen", bodyPartial: 'image-upload-form' }));
    res.end();
}

function postImageUploadForm (req, res) {
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.uploadDir = imgDir;

    form.parse(req, (err, fields, files) => {
        if (err) throw err;
        const fileName = files.imagefile.name;
        const currentPath = files.imagefile.path;
        fs.renameSync(currentPath, form.uploadDir + "image" + getFileExt(fileName).toLowerCase());

        // Post-Redirect-Get pattern
        res.statusCode = 303;
        res.setHeader('Location', '/image');
        res.end();
    });
}

function getImage (req, res) {
    const parsedUrl = url.parse(req.url);

    // Hint: due to our routing configuration we assume that path ends in
    // something along the lines of 'image.jpg'.
    const result = /image\.(jpg|jpeg|png)$/.exec(parsedUrl.pathname);
    const fileName = result[0];
    const fileExt = result[1];
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
//
// Note: advanced usage of partials that allows us to inject a partial by name. For
// further information see http://handlebarsjs.com/partials.html. What we accomplish is
// a nice way to avoid code duplication.
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
        <li><a href="/old-homepage">Alte Homepage</a></li>  <!-- //delete -->
        <li><a href="/new">Profil anlegen</a></li>
     </ul>`);

//delete
hbs.registerPartial('oldHomepage',
    `<h1>UE3 Sample Server</h1>
     <ul>
        <li><a href="/simple-form">Einfaches Formular</a></li>
        <li><a href="/persist-data">Formulardaten speichern</a></li>
        <li><a href="/persisted-data">Gespeicherte Formulardaten</a></li>
        <li><a href="/einfaches-html-form">Redirect Beispiel</a> 
            <span class="subtle small">Bitte Browser-Weiterleitung im Netzwerk-Tab der Browser Devtools betrachten</span>
        </li>
        <li><a href="/image">Bildanzeige (File Upload)</a></li>
     </ul>`);

hbs.registerPartial('simple-html-form',
    `<h1>{{title}}</h1>
     <form action="{{action}}" method="post">
        <p><label>Benutzerkürzel: <input type="text" name="nickname"></label></p> 
         <p><label>Vorname: <input type="text" name="firstname"></label></p>     
         <p><label>Nachname: <input type="text" name="lastname"></label></p> 
          <p><textarea name="description" rows="10" cols="60">Fügen Sie hier Ihre Beschreibung ein.</textarea></p>
          <p><label>Facebook Link: <input type="text" name="fblink"></label></p> 
          <p><label>Twitter  Link: <input type="text" name="twlink"></label></p> 
          <p><label>Xing Link: <input type="text" name="xilink"></label></p>    
         <p><button type="submit">Absenden</button></p>     
     </form>`);

hbs.registerPartial('edit-form',
    `<h1>{{title}}</h1>
     <form action="{{action}}" method="post">
        <p><label>Benutzerkürzel: <input type="text" name="nickname" value = {{nickname}}></label></p> 
         <p><label>Vorname: <input type="text" name="firstname"></label></p>     
         <p><label>Nachname: <input type="text" name="lastname"></label></p> 
          <p><textarea name="description" rows="10" cols="60">Fügen Sie hier Ihre Beschreibung ein.</textarea></p>
          <p><label>Facebook Link: <input type="text" name="fblink"></label></p> 
          <p><label>Twitter  Link: <input type="text" name="twlink"></label></p> 
          <p><label>Xing Link: <input type="text" name="xilink"></label></p>    
         <p><button type="submit">Absenden</button></p>     
     </form>`);

hbs.registerPartial('simple-html-form-success',
    `<h1>Vielen Dank!</h1>
     <p>Folgende Antwort erhalten</p>
     <p>{{requestBody}}</p>
     <p>Weiter geht's <a href="{{resourceUri}}">hier</a>.</p>
     <p class="subtle small">Anmerkung zur Benutzung von formidable zum Verarbeiten des Form-Inhalts. Ein request Objekt in 
       node.js ist ein so genannter ReadableStream. Mit Event Listener auf die Events 'readable' und 'end' ließe
       sich der Inhalt des Request Bodys einlesen. Danach müsste man aber den Body noch mit dem richtigen Format
       parsen. Das ist eine typische Aufgabe eines Webframeworks wie express.js und unsere Aufgabe soll es nicht sein,
       Teile eines eigenen Webframeworks zu entwickeln.
     </p>`);

hbs.registerPartial('persist-data-form-success',
    `<h1>Your account has been added!</h1>
     <p>Link to your newly created <a href="{{resourceUri}}">userprofile</a>.</p>`);

hbs.registerPartial('persisted-data',
    `<h2>Userprofile:</h2>
     <ul>
     {{#each data}}
        {{#isLink @key }}
            <li>{{@key}}: <a href="http://{{this}}">{{this}}</a></li>
        {{else}}
            <li>{{@key}}: {{this}}</li>
        {{/isLink}}
     {{/each}}
     </ul>
     <p><a href="/persist-data">Ändern &raquo;</a></p>`);


hbs.registerPartial('image-upload-form',
    `<h1>{{title}}</h1>
     <form action="/image/upload" method="post" enctype="multipart/form-data">
         <p><label>Bild: 
                <input type="file" accept="image/jpeg, image/png" name="imagefile">
            </label>
          </p>
         <p class="subtle small">Erlaubte Bildformate: JPEG und PNG!</p>     
         <p><button type="submit">Bild hochladen</button></p>     
     </form>`);

hbs.registerPartial('image-view',
    `<h1>{{title}}</h1>
     <p><img src="{{imgSrc}}" alt="Noch kein Bild vorhanden" style="width: 32em;"></p>
     <a href="/image/upload">Upload&nbsp;&raquo;</a>
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