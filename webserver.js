const
    express = require('express')
    , fs = require('fs')
    , stylus = require('stylus')
    , nib = require('nib');

var app = express();

app.configure(function() {
    var base = fs.realpathSync(__dirname + "/web")

    // automatically generate css from stylus files
    app.use(stylus.middleware({
        src       : base + "/src/css"
        , dest    : base + "/public/css"
        , force   : true
        , compile : function(str, path) {
            stylus(str)
                .set("filename", path)
                .set("compress", false)
                .use(nib())
                .import('nib');
        }
    }));


    // service static files from multiple places
    app.use(express.static(base + "/public/static/"))
    app.use(express.static(base + "/public/generated/"))


    app.set("view engine", "jade");
    app.set("views", base + "/views");
});

app.get('/', function(req, res) {
    res.send('Hello');
});

app.use(function(err, req, res, next) {
    console.log(err);
    next();
});

var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("Webserver started. Listening on " + port);
});
