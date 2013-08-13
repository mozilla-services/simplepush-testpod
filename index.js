var program = require('commander'),
    TestController = require('./lib/TestController'),
    debug = require('debug'),
    webserver = require('./webserver');

program
    .version('0.0.1a')
    .option('-s, --pushgoserver <server>', 'Push go server url, e.g., pushserver.test.com', 'push.services.mozilla.com')
    .option('-c, --clients <clients>', 'Number of client connections', Number, 1)
    .option('-C, --channels <channels>', 'Number of channels per client', Number, 1)
    .option('-m, --minpingtime <minpingtime>', 'Minimum milliseconds between pings', Number, 500)
    .option('-M, --maxpingtime <minpingtime>', 'Maximum milliseconds between pings', Number, 1000)
    .option('-p, --pingsperchannel <pingsperchannel>', 'How many pings to send per channel 0 means infinite', Number, 0)
    .parse(process.argv);


var test = new TestController(program);
test.run();

webserver.startup(function(err, server) {
    debug('webserver')("Webserver listening on " + server.address().port);
});
