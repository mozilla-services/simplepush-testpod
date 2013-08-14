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
    
    // for keeping track 
    this.expectVersion = 0;
    this.sentTime = 0;

    var self = this;


    client.on(channelID, function(version) {
        var t = (Date.now() - self.sentTime);
        if (version === self.expectedVersion) {
            self.emit('results', {
                endpoint: self
                , status: 'OK'
                , time: t
            });
        } else {
            self.emit('results', {
                endpoint: self
                , status: 'VER_MISMATCH'
                , time: t
            });
        }
    });
}

util.inherits(EndPoint, events.EventEmitter);

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

Server.prototype.registerEndpoint = function(client, urlEndpoint, channelID) {
    var self = this;
    debug("Registered: %s", urlEndpoint);
    endPoint = new EndPoint(client, urlEndpoint, channelID);
    //this.sendLoop(endPoint, 0, this.pingsPerChannel);

    endPoint.on("results", function(result) {
        console.log(result.time);
    });

    this.sendPing(endPoint, 1);
};

Server.prototype.sendLoop = function(endpoint, version, remainingPings) {
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

    endpoint.expectedVersion = version;
    endpoint.sentTime = Date.now();

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
