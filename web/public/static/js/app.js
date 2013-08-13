requirejs.config({
    "baseUrl": "/js"
    , "paths": {
        _          : "lib/underscore-min"
        , backbone : "lib/backbone-min"
        , jquery   : "lib/jquery-2.0.3.min"
    }
    , "shim": { 
        _ : {
            exports: "_"
        }
        , backbone : {
            deps: ["jquery", "_"]
            , exports: "Backbone"
        }
        , jquery   : {
            exports: "jquery"
        }
    }
});

// let's get started
requirejs(['app/main']);

