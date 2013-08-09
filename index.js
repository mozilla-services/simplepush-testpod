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
c.start();
