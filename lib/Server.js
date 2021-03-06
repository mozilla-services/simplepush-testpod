const FIRST_UPDATE=1000,
      DNS_REFRESH_TIME=60000; // 60sec

var events = require('events'),
    moment = require('moment'),
    url = require('url'),
    querystring = require('querystring'),
    util = require('util'),
    dns  = require('dns'),
    debug = require('debug')('server'),
    debugSend = require('debug')('server:send'),
    debugDNS = require('debug')('server:dns');

function Server(programConfig) {
    this.programConfig = programConfig;
    this.clientList = [];
    this.isHTTPS = programConfig.ssl;
    this.useEndPointUrl = programConfig.useendpointurl;

    this.http = (programConfig.ssl) ? require('https') : require('http');
    this.http.localAgent = new this.http.Agent({rejectUnauthorized: false});

    this.minUpdateTime = programConfig.minupdatetime;
    this.maxUpdateTime = programConfig.maxupdatetime;
    this.waitTimeout = programConfig.timeout;

    this.timeout = null;

    this.sendTimeout = null;
    this.semRequest = (this.isHTTPS) ? 100: 25;   // controls max number of requests we have in flight
    this.requestQueue = []; // list of endpoints that should get an update

    /*
     * if we are using non-default endpoints (overrides for testing) then
     * we want some custom logic in testing... 
     */

    var self = this;
    if (programConfig.putendpoint == "servers") {
        this.serverList = programConfig.pushgoservers;
        this.numServers = programConfig.pushgoservers.length;
    } else if (programConfig.putendpoint == 'override') {
        this.serverList = programConfig.putoverride;
        this.numServers = programConfig.putoverride.length;

        // generally these are ELBs that we use so we want to do our own 
        // ghetto dns resolution for them... 
        (function updateList() {
            var newList = [];
            var wait = programConfig.putoverride.length;

            for (var i=0; i<programConfig.putoverride.length; i++) {
                (function(name) {
                    dns.resolve4(name, function(err, ips) {
                        if (err) { return; }
                        newList = newList.concat(ips);
                        debugDNS("Resolved: %s => %s", name, ips);

                        wait -= 1;
                        if(wait === 0) {
                            debugDNS("new put endpoints: %s", newList);
                            self.serverList = newList;
                            self.numServers = newList.length;
                            setTimeout(updateList, DNS_REFRESH_TIME);
                        }
                    });
                })(programConfig.putoverride[i]);
            }
        })();
    }

    this.stats = {
          put_sent           : 0
        , put_failed         : 0
        , update_outstanding : 0
        , update_received    : 0
        , update_timeout     : 0
        , update_invalid     : 0
        , update_net_error   : 0
        , update_err_empty   : 0 // special, server sent an empty notify packet
    }
}

util.inherits(Server, events.EventEmitter);

function random(min, max) {
    return Math.random()*(max-min) + min;
}
Server.prototype.randomNext = function() {
    return Math.floor(random(this.minUpdateTime, this.maxUpdateTime));
}

Server.prototype.addClient  = function(client) {
    debug("Registered Client: %s", client.uaid);
    this.clientList.push(client);
}

Server.prototype.start = function() {
    var self = this;

    this.timeout = setTimeout(function queueUpdates() {
        var client, i, k, e,
            numClients = self.clientList.length ;

        debug("Server checking %d clients, queue size: %d", numClients, self.requestQueue.length);

        var maxQueueSize = Math.min(numClients, self.semRequest * 2)

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
                if (e.nextVersionRequest === 0 && e.state === 'ready') {
                    // just schedule it for sometime in the future

                    if (e.updateCount === 0) {
                        e.nextVersionRequest = Date.now() + random(10, self.maxUpdateTime);
                    } else {
                        e.nextVersionRequest = Date.now() + self.randomNext();
                    }

                    debug("%s next update in: %dms", e.channelID, e.nextVersionRequest - Date.now());
                    e.updateCount += 1;
                    continue;
                } 

                /* 
                 * use e.expectingUpdate to control TIMEOUT and whether we should send
                 * forget the old request and send out a new one. We expect the endpoint 
                 * to reset e.expectingUpdate to `false`
                 */
                if (e.state == 'wait' && Date.now() - e.nextVersionRequest > self.waitTimeout) {
                    e.expectingUpdate = false;
                    e.nextVersionRequest = Date.now() + random(500, FIRST_UPDATE);
                    debug("TIMEOUT %s, doing again in %d", e.channelID, e.nextVersionRequest - Date.now());
                    self.stats.update_outstanding -= 1;
                    self.stats.update_timeout += 1;
                    e.setState('ready');
                } else if (e.nextVersionRequest < Date.now() && e.state == 'ready') {
                    // we push these onto a queue so we can control how many are in flight at any given time 
                    if (self.requestQueue.length < maxQueueSize) {
                        debug("Queuing %s", e.channelID);
                        e.queued = true;
                        e.setState('queued');
                        self.requestQueue.push(e);
                    }
                }
            }
        }

        self.timeout = setTimeout(queueUpdates, 1000);

    }, 1000);

    this.sendTimeout = setTimeout(function flushRequests() {
        if (self.requestQueue.length > 0) {
            debugSend("Queue Size: ", self.requestQueue.length);
        }

        // flush stuff out of the request queue
        while (self.semRequest > 0 && self.requestQueue.length > 0) {
            self.semRequest -= 1;
            var e = self.requestQueue.shift();
            self.sendUpdate(e);
        }

        this.sendTimeout = setTimeout(flushRequests, 250);
    }, 250);
}

Server.prototype.stop = function() {
    clearTimeout(this.timeout);
    clearTimeout(this.sendTimeout);
};

Server.prototype.recordEndpointOk = function() {
    this.stats.update_received += 1;
    this.stats.update_outstanding -= 1;
};

Server.prototype.sendUpdate = function(endpoint) {
    var self = this;

    var newVersion = endpoint.version + 1;
    var data = querystring.stringify({'version': newVersion.toString()});
    var u = url.parse(endpoint.url);

    if (this.programConfig.putendpoint == 'assigned') {  // respect the endpoint URL
        var serverName = u.hostname;
        var port = (u.port) ? u.port : (u.protocol == "https:") ? 443 : 80;
    } else { // override, and use a random one
        // rotate through the server nodes, instead of choosing them at random
        var parts = this.serverList[Math.floor(random(0, this.numServers))].split(':');
        var serverName = parts[0];
        var port =  parts[1] || ((this.isHTTPS) ? 443 : 80);
    }

    var opts = {
        hostname: serverName,
        port: port,
        method: 'PUT',
        path: u.path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        },
        agent: this.http.localAgent
    };

    if (u.hostname == serverName) {
        debugSend('PUT *SAME*, v:%d, endpoint=%s:%s%s', newVersion, serverName, port, u.path);
    } else {
        debugSend('PUT *DIFF*, v:%d, endpoint=%s:%s%s', newVersion, serverName, port, u.path);
    }

    // we *could* get updates back via the ws before the PUT HTTP finishes
    // so to avoid a race condition we set our expectations first ... :)
    endpoint.expectingUpdate = true;
    endpoint.expectedVersion = newVersion;
    endpoint.serverPutTime = Date.now();
    endpoint.setState('wait');

    // here due to weird race condition...
    self.stats.update_outstanding += 1;
    self.stats.put_sent += 1;

    var req = this.http.request(opts, function(res) {
        //debugSend("RES %s, %s", endpoint.channelID, res.statusCode);

        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });


        res.once('end', function() {
            self.semRequest += 1; // we have more room :)
            endpoint.queued = false;

            // these are inside the `end` event because we want the response body
            if(res.statusCode !== 200) {
                self.stats.put_failed += 1;
                self.stats.update_outstanding += 1;


                self.stats.put_sent -= 1; // put_sent measures sent ok, account for otherwise

                endpoint.setState('ready');
                debugSend("PUT_FAIL %s. HTTP %s %s", endpoint.channelID, res.statusCode, body);
            } else {
                debugSend('PUT_OK %s', endpoint.channelID);
            }
        });
    });

    req.on('error', function(e) {
        endpoint.queued = false;
        self.semRequest += 1; // we have more room :)
        debugSend('Network Error Request Error: %s', e);
        self.stats.update_net_error += 1;
    });

    req.write(data);
    req.end();
};

module.exports = Server;
