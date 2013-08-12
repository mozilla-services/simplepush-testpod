var https = require('https'),
    http = require('http'),
    querystring = require('querystring'),
    url = require('url'),
    debug = require('debug')('server'),
    events = require('events'),
    _ = require('underscore'),
    util = require('util');

function EndPoint(client, url, channelID) {
    this.client = client;
    this.url = url;
    this.channelID = channelID;
}

function Server(minPing, maxPing, pingsPerChannel, ssl) {
    this.minPing = minPing;
    this.maxPing = maxPing;
    this.pingsPerChannel = pingsPerChannel;
    if(ssl) {
        this.http = https;
    } {
        this.http = http;
    }
}

module.exports = Server;

util.inherits(Server, events.EventEmitter);

Server.prototype.getRandTimeout = function() {
    return _.random(this.minPing, this.maxPing);
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

    if (endpoint.client.connected === false) {
        return;
    }

    try {
        this.sendPing(endpoint, version);
    } catch(err) {
        this.emit('error', err);
        return err;
    }

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
    var req = this.http.request(opts, function(res) {

        debug("Sent ping: ver: %d, %s", version, endpoint.url);
        if(res.statusCode !== 200) {
            self.emit('sendfail', endpoint, version);
        }
        res.on('data', function() {});
    });

    req.on('error', function(e) {
        self.emit('pingfail');
        debug(e);
    });

    req.write(data);
    req.end();
};
