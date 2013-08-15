const 
    CONNECT_THROTTLE=100 // ms per connection
    , UPDATE_TIMEOUT = 30000; // in ms

var program = require('commander'),
    Client = require('./lib/Client'),
    EndPoint = require('./lib/EndPoint')
    debug = require('debug'),
    uuid = require('node-uuid'),
    moment = require('moment'),
    webserver = require('./webserver') ;

program
    .version('0.0.1a')
    .option('-s, --pushgoserver <server>', 'Push go server url, e.g., pushserver.test.com', 'push.services.mozilla.com')
    .option('-c, --clients <clients>', 'Number of client connections', Number, 1)
    .option('-C, --channels <channels>', 'Number of channels per client', Number, 1)
    .option('-u, --minupdatetime <minupdatetime>', 'Minimum milliseconds between version updates', Number, 500)
    .option('-U, --maxupdatetime <minpingtime>', 'Maximum milliseconds between version updates', Number, 1000)
    .option('-S, --ssl', "Use https")
    .parse(process.argv);

var testy = debug('testy');
var deep = debug('deep')

var startTime = moment();

if (program.ssl) {
    var http = require('https');
} else {
    var http = require('http');
}

/** 
 * This dirty little blob just gets updated
 * as the test runs and sent to the UI via websockets...
 */
var stats = {
    // this should match web/public/static/js/model/Stats.js to make 
    // easier to send data to the backbone Model
    test_seconds: 0

    , server        : program.pushgoserver
    , minupdatetime : program.minupdatetime
    , maxupdatetime : program.maxupdatetime
    , clients       : program.clients
    , channels      : program.channels
    , timeout_time  : UPDATE_TIMEOUT

    // Connection Stats
    , conn_current   : 0
    , conn_attempted : 0
    , conn_ok        : 0
    , conn_drop      : 0

    // Connection Times
    , c_count  : 0 
    , c_t5s    : 0 
    , c_t30s   : 0 
    , c_t60s   : 0 
    , c_t300s  : 0 
    , c_t600s  : 0 
    , c_t1800s : 0 
    , c_tXs    : 0 

    // Update Stats
    , put_sent           : 0
    , put_failed         : 0
    , update_outstanding : 0
    , update_received    : 0
    , update_timeout     : 0
    , update_invalid     : 0
    , update_net_error   : 0
    , update_err_empty   : 0 // special, server sent an empty notify packet

    // update timing latency (PushServer -> WS -> Client)
    , u_count    : 0
    , u_t50ms    : 0
    , u_t100ms   : 0
    , u_t500ms   : 0
    , u_t1500ms  : 0
    , u_t5000ms  : 0
    , u_t10000ms : 0
    , u_t20000ms : 0
    , u_t60000ms : 0
    , u_tXms     : 0

    // Misc
    , skip_timeout : 0
};

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

var updateTimes = [50, 100, 500, 1500, 5000, 10000, 20000, 60000];
function resultHandler(result) {
    deep("*** RESULT: (%dms) %s | %s ***", 
        result.time, result.status, result.endpoint.channelID
    )

    switch (result.status) {
        case 'PUT_OK':
            stats.put_sent += 1;
            stats.update_outstanding += 1;

            testy("PUT #%d OK %s | %s", 
                    result.data.id, 
                    result.channelID, 
                    result.data.body
            );
            break;

        case 'PUT_FAIL': // the server returned a non 200
            stats.put_sent += 1;
            stats.put_failed += 1;

            testy("PUT %d FAIL %s. HTTP %s %s", 
                    result.data.id, 
                    result.channelID,
                    result.data.code,

                    result.data.body
                );
            break;

        case 'GOT_VERSION_OK':
            stats.update_outstanding -= 1;
            stats.update_received += 1;

            var checkTime;
            var counted = false;
            stats.u_count += 1;

            for (var i=0; i < updateTimes.length; i++) {
                checkTime = updateTimes[i];
                if (result.data <= checkTime) {
                    stats["u_t"+checkTime + "ms"] += 1;
                    counted = true;
                    break;
                }
            }

            if (counted === false) {
                stats.u_tXms += 1;
            }

            testy("\\o/. ws lag: %dms", result.data);
            break;

        case 'ERR_VER_INVALID':
            stats.update_outstanding -= 1;
            stats.update_invalid += 1;
            testy("ERROR: Unexpected Version. Got %d, expected: %d", 
                    result.data.got, 
                    result.data.expected
                );
            break;

        case 'TIMEOUT':
            stats.update_outstanding -= 1;
            stats.update_timeout += 1;
            testy('TIMEOUT, expired: %dms', result.data);
            break;

        case 'SKIP_TIMEOUT_CREATE':
            stats.skip_timeout += 1;
            break;

        case 'ERR_NETWORK': // network issues?
            stats.update_net_error += 1;
            testy('Network Error: %s', result.data);
            break;
    }

    if (result.status != "PUT_OK" && result.endpoint.client.connected !== false) {
        var nextUpdate = Math.floor(random(program.minupdatetime, program.maxupdatetime));
        testy("Waiting %dms to send another update", nextUpdate)
        setTimeout(
            result.endpoint.sendNextVersion.bind(result.endpoint, UPDATE_TIMEOUT), 
            nextUpdate
        );
    }
}

var connectionTimes = [5, 30, 60, 300, 600, 1800];
function handleClientClose(timeConnected) {
    stats.conn_current -= 1;
    stats.conn_drop += 1;
    var recorded = false;
    
    stats.c_count += 1;

    for (var i=0; i<connectionTimes.length; i++) {
        var s = Math.round(timeConnected/1000);
        if (s <= connectionTimes[i]) {
            stats['c_t' + connectionTimes[i] + 's'] += 1;
            recorded = true; 
            break;
        }
    }

    if (recorded === false) {
        stats.c_tXs += 1;
    }

    // make sure we try to maintain program.clients target
    createClient();
}

function handleClientEmptyNotify() {
    stats.update_err_empty += 1;
}

var clientCount = 0;

// ghetto async creation lock.. 
var opening = false;

function createClient() {
    clientCount += 1;
    testy("Creating client: %d", clientCount);

    var c = new Client(program.pushgoserver);
    for(var j = 0; j < program.channels; j++) {
        c.registerChannel(uuid.v1());
    }

    var endPointCount = 0;
    c.on('pushendpoint', function(endpointUrl, channelID) {
        testy("Created channel: %s", channelID);
        var e = new EndPoint(http, c, endpointUrl, channelID);
        var serverAckTime = 0;
        e.on('result', resultHandler);
        e.sendNextVersion()
    });

    opening = true;
    c.once('open', function() {
        stats.conn_current += 1;
        stats.conn_ok += 1;

        opening = false;
    });
    c.once('close', handleClientClose);

    c.on('err_notification_empty', handleClientEmptyNotify);

    stats.conn_attempted += 1;
    c.start();
};

setTimeout(function ensureEnoughClients() {
    if (opening == true) {
        setTimeout(ensureEnoughClients, CONNECT_THROTTLE / 2);
        return;
    }

    if(stats.conn_current < program.clients)  {
        createClient();
        setTimeout(ensureEnoughClients, CONNECT_THROTTLE);
        return;
    }

    setTimeout(ensureEnoughClients, CONNECT_THROTTLE);
}, 100);


webserver.startup(function(err, server) {
    debug('webserver')("Webserver listening on " + server.address().port);

    setInterval(function() {
        stats.test_seconds = Math.floor(moment().diff(startTime)/1000);
        server.emit('stats', stats);
    }, 1000);
});
