#!/usr/bin/env node

const program = require('commander')
    , Client = require('../lib/Client')
    , uuid = require('node-uuid')
    , url = require('url')
    , querystring = require('querystring')
    , debug = require('debug')
    , debugClient = debug('proxytest');

program
    .version('0.0.1a')
    .option('-a, --servera <servera>', 'First cluster node', 'localhost:8080')
    .option('-b, --serverb <serverb>', 'Second cluster node', 'localhost:8081')
    .option('-i, --interval <ms>', 'Update interval to send updates', Number, 1000)
    .option('-S, --ssl', "Use https")
    .parse(process.argv);


if (program.ssl) {
    var http = require('https');
} else {
    var http = require('http');
}

client = new Client(program.servera, program.ssl ? 'wss://' : 'ws://', http);
client.registerChannel(uuid.v1());

client.on('open', function() {
    debugClient("Client Connected to %s", program.servera);
});

client.on('registered', function(client) {
    debugClient("Client Registered, creating endpoint...");
});

client.on('newendpoint', function(endpoint){
    debugClient("Got new endpoint %s", endpoint.url);

    endpoint.on('result', function(result) {
        if (result.status == 'GOT_VERSION_OK') {
            debugClient("*** GOT VERSION OK, v: %d", endpoint.version);
        } else {
            debugClient("*** FAILED, status: %s", result.status);
        }

        setTimeout(sendUpdate, program.interval);
    });

    function sendUpdate() {
        var newVer = endpoint.version + 1;
        endpoint.expectedVersion = newVer;

        debugClient("Sending ver: %d to %s", newVer, endpoint.url);

        var data = querystring.stringify({'version': newVer});
        var u = url.parse(endpoint.url);

        if (program.serverb.indexOf(':') != -1) {
            var hostname = program.serverb.split(':')[0];
            var port = program.serverb.split(':')[1];
        } else {
            var hostname = program.serverb;
            var port = 80;
        }


        var opts = {
            hostname: hostname,
            port: port,
            method: 'PUT',
            path: u.path,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            },
            agent: http.localAgent
        };

        var req = http.request(opts, function(res) {
            debugClient("PUT status", res.statusCode)
            res.on('error', function(e) {
                debugClient("PUT NETWORK ERROR");
            });

        });

        req.write(data);
        req.end();
    };

    sendUpdate();
});

client.on('close', function() {
    debugClient("Client disconnected")
});

debugClient("Connecting to: %s", program.servera);
client.start();
