const
    events = require('events'),
    url = require('url'),
    querystring = require('querystring'),
    http = require('http'),
    https = require('http'),
    util = require('util'), 
    debug = require('debug')('EndPoint')
    ;

function EndPoint(client, url, channelID) {
    this.client = client;
    this.url = url;
    this.channelID = channelID;
    this.version = 0;
    
    // for keeping track 
    this.sentStartTime = 0;

    var self = this;

    client.on(channelID, function(version) {
        if (version === (self.version + 1)) {
            self.emitResult('GOT_VERSION_OK');
            self.version = version;
        } else {
            self.emitResult('ERR_VER_MISMATCH');
        }
    });
};
util.inherits(EndPoint, events.EventEmitter);

EndPoint.prototype.sendNextVersion = function() {
    var self = this;

    this.sentStartTime = Date.now();

    var u = url.parse(this.url);
    var nextVersion = this.version + 1
    var data = querystring.stringify({'version': nextVersion.toString()});
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

    //self.emit('sentping', endpoint, version);
    debug('Sent New Version %d', nextVersion);
    var req = http.request(opts, function(res) {
        debug("got response %s", res.statusCode);
        if(res.statusCode !== 200) {
            self.emitResult('ERR_SERVER', res.statusCode);
        } else {
            self.emitResult('SERVER_OK', res.statusCode);
        }

        res.on('data', function() {});
    });

    req.on('error', function(e) {
        self.emitResult('ERR_NETWORK', e);
        debug('Request Error: %s', e);
    });

    req.write(data);
    req.end();
};

EndPoint.prototype.emitResult = function(status, data) {
    data = data || false;

    var t = Date.now() - this.sentStartTime;

    this.emit('result', {
        endpoint: this
        , status: status
        , time: t
    });
}

module.exports = EndPoint;
