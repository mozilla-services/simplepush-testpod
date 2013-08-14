var program = require('commander'),
    TestController = require('./lib/TestController'),
    Client = require('./lib/Client'),
    EndPoint = require('./lib/EndPoint')
    debug = require('debug'),
    uuid = require('node-uuid'),
    webserver = require('./webserver') ;

program
    .version('0.0.1a')
    .option('-s, --pushgoserver <server>', 'Push go server url, e.g., pushserver.test.com', 'push.services.mozilla.com')
    .option('-c, --clients <clients>', 'Number of client connections', Number, 1)
    .option('-C, --channels <channels>', 'Number of channels per client', Number, 1)
    .option('-m, --minpingtime <minpingtime>', 'Minimum milliseconds between pings', Number, 500)
    .option('-M, --maxpingtime <minpingtime>', 'Maximum milliseconds between pings', Number, 1000)
    .option('-p, --pingsperchannel <pingsperchannel>', 'How many pings to send per channel 0 means infinite', Number, 0)
    .option('-S, --ssl', "Use https")
    .parse(process.argv);

var testy = debug('testy');
var deep = debug('deep')

function resultHandler(result) {
    deep("*** RESULT: (%dms) %s | %s ***", 
        result.time, result.status, result.endpoint.channelID
    )

    switch (result.status) {
        case 'GOT_VERSION_OK':
            testy("\\o/. ws lag: %dms, waiting 3s to send again", result.time - serverAckTime);
            setTimeout(result.endpoint.sendNextVersion.bind(result.endpoint, 5000) , 3000);
            break;

        case 'ERR_VER_MISMATCH':
            break;

        case 'TIMEOUT':
            testy('TIMEOUT, expired: %dms, waiting 3s to send again', result.data);
            setTimeout(result.endpoint.sendNextVersion.bind(result.endpoint, 5000), 3000);
            break;

        case 'PUT_OK':
            testy("PUT #%d OK %s | %s", 
                    result.data.id, 
                    result.endpoint.channelID, 
                    result.data.body
            );
            serverAckTime = result.time;
            break;

        case 'PUT_FAIL': // the server returned a non 200
            testy("PUT %d FAIL %s. HTTP %s %s, waiting 3s to send again", 
                    result.data.id, 
                    result.endpoint.channelID,
                    result.data.code,
                    result.data.body
                );
            setTimeout(result.endpoint.sendNextVersion.bind(result.endpoint, 5000), 3000);
            break;

        case 'ERR_NETWORK': // network issues?
            break;
    }
}

for (var i =0; i < program.clients; i++) {

    (function(i) {
        testy("Creating client: %d", i);

        var c = new Client(program.pushgoserver);
        for(var j = 0; j < program.channels; j++) {
            c.registerChannel(uuid.v1());
        }

        c.on('pushendpoint', function(endpointUrl, channelID) {
            testy("Created channel: %s", channelID);
            var e = new EndPoint(c, endpointUrl, channelID);
            var serverAckTime = 0;
            e.on('result', resultHandler);
            e.sendNextVersion()
        });

        c.start()
    })(i);
}

