var https = require('https'),
    querystring = require('querystring'),
    url = require('url'),
    debug = require('debug')('server'),
    events = require('events'),
    util = require('util');

function EndPoint(client, url, channelID) {
    this.client = client;
    this.url = url;
    this.channelID = channelID;
}

function Server(minPing, maxPing, pingsPerChannel) {
    this.minPing = minPing;
    this.maxPing = maxPing;
    this.pingsPerChannel = pingsPerChannel;
}

module.exports = Server;

util.inherits(Server, events.EventEmitter);

Server.prototype.getRandTimeout = function() {
    return Math.floor(Math.random() * (this.maxPing - this.minPing)) + this.minPing;
};

Server.prototype.registerEndpoint = function(client, endpoint, channelID) {
    var self = this;
    debug("Registered: %s", endpoint);
    endPoint = new EndPoint(client, endpoint, channelID);
    this.sendLoop(endPoint, 0, this.pingsPerChannel);
};

Server.prototype.sendLoop = function(endpoint, version, remainingPings) {
    // Adds some delay to the first request.
    if(version === 0) {
        setTimeout(this.sendLoop.bind(this, endpoint, version + 1, remainingPings), this.getRandTimeout());
        return;
    }

    this.sendPing(endpoint, version);

    if((remainingPings - 1) === 0) return;
    setTimeout(this.sendLoop.bind(this, endpoint, version + 1, remainingPings - 1), this.getRandTimeout());
};

Server.prototype.sendPing = function(endpoint, version) {
    var self = this;
    var u = url.parse(endpoint.url);
    var data = querystring.stringify({'version': version.toString()});
    var opts = {
        hostname: u.hostname,
        port: u.port,
        method: 'PUT',
        path: u.path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    };

    self.emit('sentping', endpoint, version);
    var req = https.request(opts, function(res) {
        debug("Sent ping: ver: %d, %s", version, endpoint.url);
        res.on('data', function() {});
    });

    req.on('error', function(e) {
        self.emit('pingfail');
        debug(e);
    });

    req.write(data);
    req.end();
};
