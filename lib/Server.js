var https = require('https'),
    querystring = require('querystring'),
    url = require('url');


function Server(minPing, maxPing, pingsPerChannel) {
    this.minPing = minPing;
    this.maxPing = maxPing;
    this.pingsPerChannel = pingsPerChannel;
}

Server.prototype.registerEndpoint = function(client, endpoint, channelId) {
    var self = this;
    console.log("Server Registered: %s", endpoint);
    this.sendPing(endpoint, 1, this.pingsPerChannel);
};

Server.prototype.sendPing = function(endpoint, version, remainingPings) {
    // TODO: Keep track of pings sent, with uaid, endpoint, version, and time
    console.log("Sending ping: %s, %d", endpoint, version);
    var self = this;
    var u = url.parse(endpoint);
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

    var req = https.request(opts, function(res) {});
    req.write(data);
    req.end();

    remainingPings--;
    if(remainingPings === 0) { 
        return;
    }
    var timeout = Math.floor(Math.random() * (self.maxPing - self.maxPing)) + self.minPing;

    setTimeout(self.sendPing.bind(self, endpoint, ++version, remainingPings), timeout);
};

Server.prototype.clientSawUpdate = function(client, channelID, version) {
    // TODO: Keep track of seen pings.
};

Server.prototype.registerClient = function(c) {
    c.on('pushendpoint', this.registerEndpoint.bind(this, c));
    c.on('channelupdate', this.clientSawUpdate.bind(this, c));
};

module.exports = Server;
