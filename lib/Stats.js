var _ = require('underscore'),
    debug = require('debug')('stats'),
    moment = require('moment');

var connectionTimes = [5, 30, 60, 300, 600, 1800];

function Stats() {
    this.sent = 0;
    this.received = 0;
    this.duplicatePings = 0;
    this.sendFailed = 0;
    this.outstandingPings = {};
    this.responseTimes = [];

    // how long the websocket was connected for before it was killed
    this.connTimes = {
        'count'  : 0,
        't5s'    : 0,
        't30s'   : 0,
        't60s'   : 0,
        't300s'  : 0,
        't600s'  : 0,
        't1800s' : 0,
        'tXs'    : 0      // > 30m
    };

    this.pingTimes = {
        'count'    : 0,
        't50ms'    : 0,
        't100ms'   : 0,
        't500ms'   : 0,
        't1500ms'  : 0,
        't5000ms'  : 0,
        't10000ms' : 0,
        'tXms'     : 0   // > 10 seconds, it's Christmas!
    };

}

Stats.prototype.makeKey = function(channelID, version) {
    return channelID + version.toString();
};

Stats.prototype.addOutstanding = function(channelID, version) {
    var key = this.makeKey(channelID, version);
    this.sent++;
    this.outstandingPings[key] = moment();
    debug("ping sent %s", key);
};
Stats.prototype.pingKeys = [50, 100, 500, 1500, 5000, 10000];
Stats.prototype.clearPing = function(channelID, version) {
    var key = this.makeKey(channelID, version);
    debug("ping received %s", key);
    if (!_.has(this.outstandingPings, key)) {
        debug('Duplicate ping received: %s, %s', channelID, version);
        this.duplicatePings++;
        return;
    }
    this.received++;
    var start = this.outstandingPings[key];
    delete this.outstandingPings[key];
    var t = moment().diff(start);
    this.responseTimes.push(t);

    this.pingTimes.count += 1;
    var checkTime;
    var counted = false;
    for (var i=0; i < this.pingKeys.length; i++) {
        checkTime = this.pingKeys[i];
        if (t <= checkTime) {
            this.pingTimes["t"+checkTime + "ms"] += 1;
            counted = true;
            break;
        }
    }

    if (counted === false) {
        this.pingTimes.tXms += 1;
    }
};

Stats.prototype.failPing = function(channelID, version) {
    var key = this.makeKey(channelID, version);
    this.sendFailed++;
    delete this.outstandingPings[key];
};

Stats.prototype.recordConnectionTime = function(ms) {
    var recorded = false;
    this.connTimes.count += 1;

    for (var i=0; i<connectionTimes.length; i++) {
        var s = Math.round(ms/1000);
        if (s <= connectionTimes[i]) {
            this.connTimes['t' + connectionTimes[i] + 's'] += 1;
            recorded = true; 
            break;
        }
    }
    if (recorded === false) {
        this.connTimes.tXs += 1;
    }
};

Stats.prototype.medianRespTime = function() {
    var responseTimes = this.responseTimes;
    if(_.isEmpty(responseTimes)) return;

    responseTimes.sort(function(a, b) {return a - b;});
    var medIdx = Math.floor(_.size(responseTimes) / 2);

    return responseTimes[medIdx];
};

Stats.prototype.outstandingCount = function() {
    return Object.keys(this.outstandingPings).length;
};

Stats.prototype.avgRespTime = function() {
    var responseTimes = this.responseTimes;
    if(_.isEmpty(responseTimes)) return;
    return _.reduce(responseTimes, function(m, n) { return n + m; }, 0) / _.size(responseTimes);
};


module.exports = Stats;
