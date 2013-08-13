const CONNECT_THROTTLE = 100; //ms

var Client = require('./Client'),
    Server = require('./Server'),
    StatsCollector = require('./StatsCollector'),
    uuid = require('node-uuid'),
    _ = require('underscore'),
    moment = require('moment'),
    debug = require('debug')('testcontroller');



function TestController(opts) {
    this.opts = opts;
    if (opts.minpingtime > opts.maxpingtime) {
        opts.maxpingtime = opts.minpingtime;
    }

    // connection statistics
    this.connections = {
        current: 0
       , attempted: 0
       , ok: 0
       , fail: 0
    }

    this.stats = new StatsCollector();
    this.server = new Server(this.opts.minpingtime, this.opts.maxpingtime,
                             this.opts.pingsperchannel);
    this.server.on('sentping', this.serverSentPing.bind(this));
}


TestController.prototype.run = function() {
    var total = this.opts.clients;
    var self = this;
    setTimeout(function create() {
        var c = new Client(self.opts.pushgoserver);
        for(var j = 0; j < self.opts.channels; j++) {
            c.registerChannel(uuid.v1());
        }

        self.registerClient(c);
        c.start();
        total -= 1;
        if (total > 0) {
            setTimeout(create, CONNECT_THROTTLE);
        }
    }, CONNECT_THROTTLE);
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

    self.connections.attempted++;

    c.on('open', function() {
        self.connections.current++;
        self.connections.ok++;
        c.openTime = moment();
    });

    c.on('close', function() {
        self.connections.current--;
        self.connections.fail++;
        self.stats.recordConnectionTime(moment().diff(c.openTime));
    });
};

TestController.prototype.getInfo = function() {
    var info = {
        'connections': this.connections,

        'connTimes' : this.stats.connTimes(),
        'pings': {
            'sent'        : this.stats.sent(),
            'received'    : this.stats.received(),
            'duplicate'   : this.stats.duplicate(),
            'avg'         : this.stats.avgRespTime(),
            'median'      : this.stats.medianRespTime(),
            'outstanding' : this.stats.outstandingCount()
        },

        'pingTimes' : this.stats.pingTimes()
    };

    return info;
};

module.exports = TestController;
