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

var c = new Client(program.pushgoserver);
for(var j = 0; j < program.channels; j++) {
    c.registerChannel(uuid.v1());
}

c.on('pushendpoint', function(endpointUrl, channelID) {
    var e = new EndPoint(c, endpointUrl, channelID);
    var serverAckTime = 0;
    e.on('result', function(result) {
        console.log(result.status, result.endpoint.channelID, result.time)
        switch (result.status) {
            case 'SERVER_OK':
                serverAckTime = result.time;
                break;

            case 'GOT_VERSION_OK':
                console.log("WS Time", result.time - serverAckTime);
                break;

            case 'ERR_VER_MISMATCH':
                break;

            case 'TIMEOUT':
                break;

            case 'ERR_SERVER': // the server returned a non 200
                break;

            case 'ERR_NETWORK': // network issues?
                break;
        }

    });
    e.sendNextVersion()
});

c.start()

