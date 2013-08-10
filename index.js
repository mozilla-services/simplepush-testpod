var events = require('events'),
    program = require('commander'),
    WebSocket = require('ws'),
    util = require('util'),
    uuid = require('node-uuid'),
    Client = require('./lib/Client'),
    Server = require('./lib/Server');

program
    .version('0.0.1a')
    .option('-s, --pushgoserver <server>', 'Push go server url, e.g., pushserver.test.com', 'push.services.mozilla.com')
    .option('-c, --clients <clients>', 'Number of client connections', Number, 1)
    .option('-C, --channels <channels>', 'Number of channels per client', Number, 1)
    .option('-m, --minpingtime <minpingtime>', 'Minimum milliseconds between pings', Number, 500)
    .option('-M, --maxpingtime <minpingtime>', 'Maximum milliseconds between pings', Number, 1000)
    .option('-p, --pingsperchannel <pingsperchannel>', 'How many pings to send per channel 0 means infinite', Number, 0)
    .parse(process.argv);


var server = new Server(program.minpingtime, program.maxpingtime,
                        program.pingsperchannel);

for (i=0; i < program.clients; i++) {
    var c = new Client(program.pushgoserver);
    for(j=0; j < program.channels; j++) {
        c.registerChannel(uuid.v1());
    }
    server.registerClient(c);
    c.start();
}
