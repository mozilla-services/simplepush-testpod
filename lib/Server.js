const FIRST_UPDATE=1000;

var events = require('events'),
    moment = require('moment'),
    url = require('url'),
    querystring = require('querystring'),
    util = require('util'),
    debug = require('debug')('server'),
    debugSend = require('debug')('server:send');

var DOUT = (typeof(process.env.NODEBUG) == 'undefined');

function Server(http, minUpdateTime, maxUpdateTime, waitTimeout) {

    this.clientList = [];
    this.http = http;
    this.minUpdateTime = minUpdateTime;
    this.maxUpdateTime = maxUpdateTime;
    this.waitTimeout = waitTimeout;

    this.interval = null;

    this.sendTimeout = null;
    this.semRequest = 25;   // controls max number of requests we have in flight
    this.requestQueue = []; // list of endpoints that should get an update

}

util.inherits(Server, events.EventEmitter);

function random(min, max) {
    return Math.random()*(max-min) + min;
}
Server.prototype.randomNext = function() {
    return Math.floor(random(this.minUpdateTime, this.maxUpdateTime));
}

Server.prototype.addClient  = function(client) {
    if(DOUT) debug("Registered Client: %s", client.uaid);
    this.clientList.push(client);
}

Server.prototype.start = function() {
    var self = this;

    this.interval = setInterval(function sendUpdates() {
        var client, i, k, e,
            numClients = self.clientList.length ;

        if(DOUT) debug("Server checking %d clients", numClients);
        for (i=0; i<numClients; i++) {
            client = self.clientList[i];

            for (k in client.endpoints) {
                e = client.endpoints[k];

                /*
                 * for this to work right, the Endpoint must: 
                 *
                 * - set nextVersionRequest to 0 and expectingUpdate to false 
                 *   for a new update to be triggered by the server
                 */

                // a zero means when we should schedule a new update for the
                // endpoint
                if (e.nextVersionRequest === 0 && e.queued === false) {
                    // just schedule it for sometime in the future

                    if (e.updateCount === 0) {
                        e.nextVersionRequest = Date.now() + random(500, FIRST_UPDATE);
                    } else {
                        e.nextVersionRequest = Date.now() + self.randomNext();
                    }

                    debug("%s next update in: %d", e.channelID, e.nextVersionRequest - Date.now());
                    e.updateCount += 1;
                    continue;
                } 

                /* 
                 * use e.expectingUpdate to control TIMEOUT and whether we should send
                 * forget the old request and send out a new one. We expect the endpoint 
                 * to reset e.expectingUpdate to `false`
                 */
                if (e.expectingUpdate === true && e.queued === false && Date.now() - e.nextVersionRequest > self.waitTimeout) {
                    e.expectingUpdate = false;
                    e.nextVersionRequest = Date.now() + random(500, FIRST_UPDATE);
                    debug("TIMEOUT %s, doing again in %d", e.channelID, e.nextVersionRequest - Date.now());
                    self.emit('TIMEOUT', e.channelID, self.waitTimeout);
                } else if (e.nextVersionRequest < Date.now() && e.queued == false) {
                    // we push these onto a queue so we can control how many are in flight at any given time 
                    debug("Queuing %s", e.channelID);
                    e.queued = true;
                    self.requestQueue.push(e);
                }
            }
        }
    }, 1000);

    this.sendTimeout = setTimeout(function flushRequests() {
        if (DOUT && self.requestQueue.length > 0) debugSend("Queue Size: ", self.requestQueue.length);

        // flush stuff out of the request queue
        while (self.semRequest > 0 && self.requestQueue.length > 0) {
            self.semRequest -= 1;
            var e = self.requestQueue.shift();
            self.sendUpdate(e);
        }

        setTimeout(flushRequests, 50);
    }, 50);
}

Server.prototype.stop = function() {
    clearInterval(this.interval);
    clearTimeout(this.sendTimeout);
}

Server.prototype.sendUpdate = function(endpoint) {
    var self = this;

    endpoint.expectingUpdate = true;
    endpoint.expectedVersion = endpoint.version + 1;
    var data = querystring.stringify({'version': endpoint.expectedVersion.toString()});

    var u = url.parse(endpoint.url);
    var opts = {
        hostname: u.hostname,
        port: u.port,
        method: 'PUT',
        path: u.path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        },
        agent: this.http.localAgent
    };

    if (DOUT) debugSend('Sending update %s = %d, semRequest: %d', endpoint.channelID, endpoint.expectedVersion, this.semRequest);

    var req = this.http.request(opts, function(res) {
        if (DOUT) debugSend("** GOT response %s, %s", endpoint.channelID, res.statusCode);

        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.once('end', function() {
            self.semRequest += 1; // we have more room :)
            endpoint.queued = false;

            // these are inside the `end` event because we want the 
            // response body in the emitted event.
            if(res.statusCode !== 200) {
                self.emit('PUT_FAIL', endpoint.channelID, res.statusCode, body);
            } else {
                self.serverPutTime = Date.now();
                self.emit('PUT_OK', endpoint.channelID);
            }
        });
    });

    req.on('error', function(e) {
        self.semRequest += 1; // we have more room :)
        self.emit('ERR_NETWORK', e);
        if (DOUT) debugSend('Request Error: %s', e);
    });

    req.write(data);
    req.end();
};

module.exports = Server;
