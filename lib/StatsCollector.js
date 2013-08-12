var _ = require('underscore'),
    moment = require('moment');

function Stats() {
    this.outstandingPings = {};
    this.responseTimes = [];
}

Stats.prototype.makeKey = function(channelID, version) {
    return channelID + version.toString();
};

Stats.prototype.addOutstanding = function(channelID, version) {
    this.outstandingPings[this.makeKey(channelID, version)] = moment();
};

Stats.prototype.clearPing = function(channelID, version) {
    var key = this.makeKey(channelID, version);
    var start = this.outstandingPings[key];
    delete this.outstandingPings[key];
    this.responseTimes.push(moment().diff(start));
};

function StatsCollector() {
    this.stats = new Stats();
}

StatsCollector.prototype.pingSent = function(channelID, version) {
    this.stats.addOutstanding(channelID, version);
};

StatsCollector.prototype.pingReceived = function(channelID, version) {
    this.stats.clearPing(channelID, version);
};

StatsCollector.prototype.medianRespTime = function() {
    var responseTimes = this.stats.responseTimes;
    if(_.isEmpty(responseTimes)) return;

    responseTimes.sort(function(a, b) {return a - b;});
    var medIdx = Math.floor(_.size(responseTimes) / 2);

    return responseTimes[medIdx];
};

StatsCollector.prototype.avgRespTime = function() {
    var responseTimes = this.stats.responseTimes;
    if(_.isEmpty(responseTimes)) return;
    return _.reduce(responseTimes, function(m, n) { return n + m; }, 0) / _.size(responseTimes);
};


module.exports = StatsCollector;
