var events = require('events'),
    program = require('commander'),
    WebSocket = require('ws'),
    util = require('util'),
    Client = require('./lib/Client');

program
    .version('0.0.1a')
    .option('-s, --pushgoserver <server>', 'Push go server url, e.g., pushserver.test.com', 'push.services.mozilla.com')
    .option('-c, --clients <clients>', 'Number of client connections', Number, 1)
    .option('-C, --channels <channels>', 'Number of channels per client', Number, 1)
    .parse(process.argv);


for (i=0; i < program.clients; i++) {
    var c = new Client(program.pushgoserver);
    for(j=0; j < program.channels; j++) {
        c.registerChannel(i.toString());
    }
    c.start();
}
