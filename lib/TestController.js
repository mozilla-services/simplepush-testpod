var Client = require('./Client'),
    Server = require('./Server'),
    StatsCollector = require('./StatsCollector'),
    uuid = require('node-uuid'),
    _ = require('underscore'),
    debug = require('debug')('testcontroller');

function TestController(opts) {
    this.opts = opts;
    if (opts.minpingtime > opts.maxpingtime) {
        opts.maxpingtime = opts.minpingtime;
    }
    this.connections = 0;
    this.stats = new StatsCollector();
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
        setTimeout(c.start.bind(c), 10 * i);
    }
};

TestController.prototype.serverSentPing = function (endPoint, version) {
    debug("SentPing: %s, %d", endPoint.channelID, version);
    this.stats.pingSent(endPoint.channelID, version);
};

TestController.prototype.clientSawUpdate = function(client, channelID, version) {
    // TODO: Keep track of seen pings.
    debug("SawUpdate: %s, %d", channelID, version);
    this.stats.pingReceived(channelID, version);
};

TestController.prototype.registerClient = function(c) {
    var self = this;
    c.on('pushendpoint', this.server.registerEndpoint.bind(this.server, c));
    c.on('channelupdate', this.clientSawUpdate.bind(this, c));

    c.on('open', function() {
        self.connections++;
    });
    c.on('close', function() {
        self.connections--;
    });
};

TestController.prototype.getInfo = function() {
    var info = {
        'connections': this.connections,

        // how long the websocket was connected for before it was killed
        'conn_times' : {
            't5s'    : 0,
            't30s'   : 0,
            't60s'   : 0,
            't300s'  : 0,
            't600s'  : 0,
            't1800s' : 0,
            'tX'     : 0      // > 30m
        },
        'pings': {
            'sent'     : this.stats.sent(),
            'received' : this.stats.received(),
            'avg'      : this.stats.avgRespTime(),
            'median'   : this.stats.medianRespTime()
        },

        // buckets for ping time latencies
        'ping_times' : {
            't50ms'    : 0,
            't100ms'   : 0,
            't500ms'   : 0,
            't1500ms'  : 0,
            't5000ms'  : 0,
            't10000ms' : 0,
            'timedout' : 0   // > 10 seconds
        }
    };

    return info;
};

module.exports = TestController;
