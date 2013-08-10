var https = require('https'),
    querystring = require('querystring'),
    url = require('url');

function Server() {
    this.sendEvery = 1000;
}


Server.prototype.registerEndpoint = function(endpoint) {
    var self = this;
    console.log("Server Registered: %s", endpoint);
    this.sendPing(endpoint, 1);
};

Server.prototype.sendPing = function(endpoint, version) {
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

    version++;
    var timeout = Math.floor((Math.random() * 1000) + 500);
    setTimeout(function(e, v) { self.sendPing(e, v); }, timeout, endpoint, version);
};


module.exports = Server;
