var Client = require('./Client'),
    Server = require('./Server'),
    uuid = require('node-uuid'),
    debug = require('debug')('testcontroller');

function TestController(opts) {
    this.opts = opts;
    this.server = new Server(this.opts.minpingtime, this.opts.maxpingtime,
                             this.opts.pingsperchannel);
    this.server.on('sentping', this.serverSentPing.bind(this));
}


TestController.prototype.run = function() {
    var i, j;
    for(i = 0; i < this.opts.clients; i++) {
        var c = new Client(this.opts.pushgoserver);
        for(j = 0; j < this.opts.channels; j++) {
            c.registerChannel(uuid.v1());
        }
        this.registerClient(c);
        c.start();
    }
};

TestController.prototype.serverSentPing = function (endPoint, version) {
    debug("Testcontroller SentPing: %s, %d", endPoint.channelID, version);
};

TestController.prototype.clientSawUpdate = function(client, channelID, version) {
    // TODO: Keep track of seen pings.
    debug("Testcontroller SawUpdate: %s, %d", channelID, version);
};

TestController.prototype.registerClient = function(c) {
    c.on('pushendpoint', this.server.registerEndpoint.bind(this.server, c));
    c.on('channelupdate', this.clientSawUpdate.bind(this, c));
};

module.exports = TestController;
