const
    express = require('express')
    , fs = require('fs')
    , stylus = require('stylus')
    , nib = require('nib');

var app = express();

app.configure(function() {
    var base = fs.realpathSync(__dirname + "/web")

    // automatically generate css from stylus files
    var stylm = stylus.middleware({
        src       : base + "/src"
        , dest    : base + "/public/generated"
        , force   : true
        , serve   : true
        , compile : function(str, path) {
            return stylus(str)
                .set("filename", path)
                .set("compress", false)
                .use(nib())
                .import('nib')
        }
    });
    app.use(stylm);

    // service static files from multiple places
    app.use(express.static(base + "/public/generated"))
    app.use(express.static(base + "/public/static"))

    app.set("view engine", "jade");
    app.set("views", base + "/views");
});

app.get('/', function(req, res) {
    res.render("index")
});

app.use(function(err, req, res, next) {
    console.log(err);
    next();
});

function startup(cb) {
    var port = process.env.PORT || 3000
    app.listen(port, function(err) {
        cb(err, port);
    });
}

if (require.main === module) {
    startup(function(err, port) {
        if (err) {
            console.log(err);
            return;
        }
        console.log("App listening on " + port);
    });
}
