const CONNECT_THROTTLE = 100; //ms

var Client = require('./Client'),
    Server = require('./Server'),
    Stats = require('./Stats'),
    uuid = require('node-uuid'),
    _ = require('underscore'),
    moment = require('moment'),
    debug = require('debug')('testcontroller');


function TestController(opts) {
    var self = this;
    this.opts = opts;
    if (opts.minpingtime > opts.maxpingtime) {
        opts.maxpingtime = opts.minpingtime;
    }

    // connection statistics
    this.connections = {
        current: 0,
        attempted: 0,
        ok: 0,
        fail: 0
    };

    this.stats = new Stats();
    this.server = new Server(this.opts.minpingtime, this.opts.maxpingtime,
                             this.opts.pingsperchannel, this.opts.ssl);
    this.server.on('sentping', this.serverSentPing.bind(this));
    this.server.on('sendfail', function(endPoint, version) {
        self.stats.failPing(endPoint.channelID, version);
    });
    this.server.on('error', function(err) {
        debug('server error: %s', err);
    });
    this.startTime = moment();
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
    this.stats.addOutstanding(endPoint.channelID, version);
};

TestController.prototype.clientSawUpdate = function(client, channelID, version) {
    // TODO: Keep track of seen pings.
    debug("SawUpdate: %s, %d", channelID, version);
    this.stats.clearPing(channelID, version);
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
    
    c.on('error', function() {
    });
};

TestController.prototype.getInfo = function() {
    var pingTimes = this.stats.pingTimes,
        connTimes = this.stats.connTimes;

    var data = {
        // this should match web/public/static/js/model/Stats.js to make 
        // easier to send data to the backbone Model
        test_seconds: Math.floor(moment().diff(this.startTime)/1000)

        // Connection Stats
        , conn_current: this.connections.current
        , conn_attempted : this.connections.attempted
        , conn_ok        : this.connections.ok
        , conn_fail      : this.connections.fail

        // Connection Times
        , c_count  : connTimes.count 
        , c_t5s    : connTimes.t5s   
        , c_t30s   : connTimes.t30s  
        , c_t60s   : connTimes.t60s  
        , c_t300s  : connTimes.t300s 
        , c_t600s  : connTimes.t600s 
        , c_t1800s : connTimes.t1800s
        , c_tXs    : connTimes.tXs   

        // Ping Stats
        , ping_sent        : this.stats.sent
        , ping_outstanding : this.stats.outstandingCount() 
        , ping_received    : this.stats.received
        , ping_duplicate   : this.stats.duplicatePings
        , ping_failed      : this.stats.failPing
        , ping_avg         : this.stats.avgRespTime()
        , ping_median      : this.stats.medianRespTime()

        // ping latency
        , p_count    : pingTimes.count
        , p_t50ms    : pingTimes.t50ms   
        , p_t100ms   : pingTimes.t100ms  
        , p_t500ms   : pingTimes.t500ms  
        , p_t1500ms  : pingTimes.t1500ms 
        , p_t5000ms  : pingTimes.t5000ms 
        , p_t10000ms : pingTimes.t10000ms
        , p_X        : pingTimes.X       
    };

    return data;
};

module.exports = TestController;
