#!/usr/bin/env node

var cp = require('child_process')
    , Message = require('./lib/Message')
    , webserver = require('./webserver')
    , moment = require('moment')
    , debug = require('debug')
    , debugMaster = debug('master')
    , Stats = require('./lib/Stats')
    , program = require('commander');

program
    .version('0.0.1a')
    .option('-s, --pushgoservers <server,server,server>', 'Push go server urls, use commas for multiple', 'push.services.mozilla.com')
    .option('-w, --workers <workers>', 'Num. of worker processes', Number, 1)
    .option('-c, --clients <clients>', 'Number of client connections / worker', Number, 1)
    .option('-C, --channels <channels>', 'Number of channels per client', Number, 1)
    .option('-u, --minupdatetime <minupdatetime>', 'Min ms between version updates/channel', Number, 500)
    .option('-U, --maxupdatetime <minpingtime>', 'Max ms between version updates/channel', Number, 1000)
    .option('-S, --ssl', "Use https")
    .option('-N, --noupdates', 'Disable sending updates. Only make websocket connections')
    .option('-t, --timeout <timeout>', 'version update timeout in ms', Number, 30000)
    .parse(process.argv);

webserver.startup(function(err, server) {
    debug('webserver')("Webserver listening on " + server.address().port);

    var startTime = moment();
    var workers = [];

    function onMessage( message) {
        switch(message.type) {
            case "ready": 
                debugMaster('Worker Ready');
                this.send(new Message("start", program));
                break;

            case "stats":
                this.stats = message.data;
                // merge the stats w/ the main ones..
                break;

            case 'stopped':
                debugMaster('Worker Stopped');
                break;
        }
    };

    /*
     * start up the workers
     */
    function createWorker() {
        var w = cp.fork('./worker.js');
        w.on('message', onMessage);
        w.once('exit', function() {
            debugMaster("Worker exited. Creating a new one");
            workers[workers.indexOf(w)] = null;
            createWorker();
        })

        workers.push(w);
    }
    for (var i=0; i<program.workers; i++) {
        createWorker();
    }

    /** 
     * This dirty little blob just gets updated
     * as the test runs and sent to the UI via websockets...
     */
    var AppStats = {
        // this should match web/public/static/js/model/Stats.js to make 
        // easier to send data to the backbone Model
        test_seconds: 0
        , server        : program.pushgoservers
        , minupdatetime : program.minupdatetime
        , maxupdatetime : program.maxupdatetime
        , workers       : program.workers
        , clients       : program.clients
        , channels      : program.channels
        , timeout_time  : program.timeout
        , send_updates  : (!!program.noupdates) ? "DISABLED" : "YES"
    };

    /*
     * send the stats to the client every second
     *
     */
    setInterval(function() {
        var s = new Stats();
        for(var i=0; i< workers.length; i++) {
            if (workers[i] == null || workers[i].stats == null) {
                continue;
            }
            s.merge(workers[i].stats);
        }

        AppStats.test_seconds = Math.floor(moment().diff(startTime)/1000);
        s.merge(AppStats);

        server.emit('stats', s.data);
    }, 1000);
});
