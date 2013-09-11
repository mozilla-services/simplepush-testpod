const 
    CONNECT_THROTTLE = 5 // ms per connection
    , OPEN_SEMAPHORE = 200

    , Message = require('./lib/Message')
    , Server = require('./lib/Server')
    , Client = require('./lib/Client')
    , EndPoint = require('./lib/EndPoint')
    , debug = require('debug')
    , debugWorker = debug('worker')
    , uuid = require('node-uuid')
    , moment = require('moment')
    , random = require('./lib/random');

if (process.send) {
    var interval = null;
    process.on('message', function(message) {
        switch(message.type) {
            case "start": 
                debugWorker("starting ... doing clients: ", message.data.clients);
                stats = getStarted(message.data);
                interval = setInterval(function() {
                    process.send(new Message("stats", stats));
                }, 1000);
                break;
            case "stop":
                clearInterval(interval);
                process.end(new Message("stopped"));
                break;
        }
    });

    process.send(new Message("ready"));
}

function getStarted(program) {

    var testy = debug('testy');
    var deep = debug('deep');
    var debugServer = debug('testy:server')
    var serverList = program.pushgoservers;

    /** 
     * This dirty little blob just gets updated
     * as the test runs and sent to the UI via websockets...
     */
    var stats = {
        // Connection Stats
        conn_current   : 0
        , conn_attempted : 0
        , conn_wait      : 0 // wait for connection
        , conn_wait_reg  : 0 // waiting for registration
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

    /** 
     * SERVER - this controls sending out of requests
     */
    var appServer = new Server(program);
    /*
    appServer.on('PUT_FAIL', function(channelID, statusCode, body) { 
        stats.put_sent += 1;
        stats.put_failed += 1;

        testy("PUT_FAIL %s. HTTP %s %s", channelID, statusCode, body);
    });
    appServer.on('PUT_OK', function(channelID) { 
        stats.put_sent += 1;
        stats.update_outstanding += 1;
        testy("PUT_OK %s", channelID);
    });
    appServer.on('ERR_NETWORK', function(err) {
        stats.update_net_error += 1;
        testy('Network Error: %s', err);
    });
    appServer.on('TIMEOUT', function(channelID, timeoutTime) {
        stats.update_outstanding -= 1;
        stats.update_timeout += 1;
        testy('TIMEOUT, %s expired: %dms', channelID, timeoutTime);
    });
    */

    /**
     * Handles for various client callbacks 
     */
    var updateTimes = [50, 100, 500, 1500, 5000, 10000, 20000, 60000];
    function resultHandler(result) {
        deep("*** RESULT: (%dms) %s | %s ***", 
            result.time, result.status, result.endpoint.channelID
        )

        switch (result.status) {
            case 'GOT_VERSION_OK':
                // update the stats here
                appServer.recordEndpointOk();

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

            case 'SKIP_TIMEOUT_CREATE':
                stats.skip_timeout += 1;
                break;

        }

        // merge the stats together
        stats.put_sent           = appServer.stats.put_sent;
        stats.put_failed         = appServer.stats.put_failed;
        stats.update_outstanding = appServer.stats.update_outstanding;
        stats.update_received    = appServer.stats.update_received;
        stats.update_timeout     = appServer.stats.update_timeout;
        stats.update_invalid     = appServer.stats.update_invalid;
        stats.update_net_error   = appServer.stats.update_net_error;
        stats.update_err_empty   = appServer.stats.update_err_empty;
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

    // ghetto async creation semaphore.. 
    var opening = OPEN_SEMAPHORE;

    function handleClientOpen() {
        stats.conn_current += 1;
        stats.conn_wait -= 1;
        stats.conn_wait_reg += 1;

        opening++;
    }

    function handleNewEndpoint(endpoint) {
        testy("New Endpoint: %s", endpoint.channelID);
        endpoint.on('result', resultHandler);
        //endpoint.sendNextVersion();
    }

    function handleClientRegistered(client) {
        stats.conn_wait_reg -= 1;
        stats.conn_ok += 1;
        appServer.addClient(client);
    }

    function createClient() {
        clientCount += 1;
        testy("Creating client: %d", clientCount);

        opening--;

        var serverName = serverList[Math.floor(random(0, serverList.length))];
        debugServer("Creating new client on server: %s", serverName);
        var c = new Client(serverName, program.ssl ? 'wss://' : 'ws://');

        for(var j = 0; j < program.channels; j++) {
            c.registerChannel(uuid.v1());
        }

        c.on('newendpoint', handleNewEndpoint);

        stats.conn_wait += 1;

        c.once('open', handleClientOpen);
        c.once('close', handleClientClose);
        c.once('registered', handleClientRegistered);

        c.on('err_notification_empty', handleClientEmptyNotify);

        stats.conn_attempted += 1;
        c.start();
    }

    /**
     * Let's start creating Clients! 
     */
    setTimeout(function ensureEnoughClients() {

        /* we have enough connections. check every so often to make new ones
         * if old ones have died. */
        if(stats.conn_current + (OPEN_SEMAPHORE - opening) >= program.clients) {
            setTimeout(ensureEnoughClients, 3000);
            return;
        }

        if (opening <= 0) {
            //setTimeout(ensureEnoughClients, CONNECT_THROTTLE);
            setImmediate(ensureEnoughClients);
            return;
        }

        createClient();
        setImmediate(ensureEnoughClients);
    }, 100);

    if (!!program.noupdates === false)   {
        var goServer = setInterval(function() {
            // once we reach this point then we should start sending 
            // update requests.
            if (stats.conn_ok == program.clients) {
                appServer.start();
                clearInterval(goServer);
            } 

        }, 2500);
    }

    return stats;
}

