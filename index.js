var events = require('events'),
    program = require('commander'),
    WebSocket = require('ws'),
    util = require('util'),
    Client = require('./lib/Client');

program
    .version('0.0.1a')
    .option('-s, --pushgoserver', 'Push go server url, e.g., pushserver.test.com')
    .parse(process.argv);


c = new Client('localhost:8080');
c.registerChannel("abcde");
c.registerChannel("abcd2");
c.registerChannel("abcd3");
c.registerChannel("abcd4");
c.registerChannel("abcdr");
c.start();
