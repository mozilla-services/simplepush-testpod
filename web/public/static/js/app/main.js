/*
 * Main Application ... 
 */
define([
    'jquery'
    , "model/Stats"
    , "view/NumberFormatted"
    , "view/NumberBucket"
], function(
    $

    // models
    , StatsModel

    // views
    , NumberFormattedView
    , NumberBucketView
) {
    var statsModel = new StatsModel();

    // inject some fake data...
    /*
    var i = setInterval(function() {
        statsModel.set('conn_current', statsModel.get('conn_current') + 37)
        var pSent = statsModel.get('ping_sent') + Math.round(Math.random(1));

        statsModel.set('conn_attempted', statsModel.get('conn_attempted') + 1)
        if (Math.round(Math.random(1)) === 0) {
            statsModel.set('conn_fail', statsModel.get('conn_fail') + 1)
        } else {
            statsModel.set('conn_ok', statsModel.get('conn_ok') + 1)
        }

        statsModel.set('ping_sent', statsModel.get('ping_sent') + 1)
        if (Math.round(Math.random(1)) === 0) {
            statsModel.set('ping_timeout', statsModel.get('ping_timeout') + 1)
        } else {
            statsModel.set('ping_received', statsModel.get('ping_received') + 1)
        }

    }, 250);
    */

    $(function() {
        // update the UI when the stats model changes
        var numViews = [
            "conn_current"
            , "test_seconds"
            , "conn_attempted"
            , "conn_ok"
            , "conn_fail"
            , "conn_rate"
            , "ping_sent"
            , "ping_outstanding"
            , "ping_received"
            , "ping_duplicate"
            , "ping_timeout"
            , "ping_rate"
            , "ping_avg"
            , "ping_median"
        ];

        for(var i =0; i<numViews.length; i++) {
            new NumberFormattedView({
                model: statsModel
                , watch: numViews[i]
                , el : "#" + numViews[i]
            });
        }

        var pingTimesViews = [50, 100, 500, 1500, 5000, 10000, 'X'];
        for(var i=0; i<pingTimesViews.length; i++) {
            var k = 'p_t' + pingTimesViews[i] + 'ms';
            new NumberBucketView({
                model: statsModel
                , count: 'p_count'
                , watch: k
                , el: '#' + k
            });
        }

        var connTimeViews = [5, 30, 60, 300, 600, 1800, 'X'];
        for(var i=0; i<connTimeViews.length; i++) {
            var k = 'c_t' + connTimeViews[i] + 's';
            new NumberBucketView({
                model: statsModel
                , count: 'c_count'
                , watch: k
                , el: '#' + k
            });
        }
    });


    // startup a websocket connection
    var ws;
    var connectInterval = 1000;

    function startWS() {
        ws = new WebSocket("ws://"+window.location.hostname + ":" + window.location.port);
        ws.onerror = function(e) {
            $('#connectionStatus')
                .text('Error: ' + e)
                .attr('class', '')
                .addClass('disconnected');
        };

        ws.onopen = function(e) {
            $('#connectionStatus')
                .text('open')
                .attr('class', '')
                .addClass('connected');

            connectInterval = 1000;
        };

        ws.onmessage = function(e) {
            try {
                var data = JSON.parse(e.data);
            } catch(err) {
                console.log("WS JSON ERROR", err);
                return;
            }

            if (data.test_seconds) {
                statsModel.set('test_seconds', data.test_seconds);
            }

            if (data.connections) {
                if (data.connections.current) statsModel.set('conn_current', data.connections.current);
                if (data.connections.attempted) statsModel.set('conn_attempted', data.connections.attempted);
                if (data.connections.ok) statsModel.set('conn_ok', data.connections.ok);
                if (data.connections.fail) statsModel.set('conn_fail', data.connections.fail);
            }

            if (data.pings) {
                if (data.pings.sent) statsModel.set('ping_sent', data.pings.sent);
                if (data.pings.outstanding) statsModel.set('ping_outstanding', data.pings.outstanding);
                if (data.pings.received) statsModel.set('ping_received', data.pings.received);
                if (data.pings.duplicate) statsModel.set('ping_duplicate', data.pings.duplicate);
                if (data.pings.avg) statsModel.set('ping_avg', data.pings.avg);
                if (data.pings.median) statsModel.set('ping_median', data.pings.median);
            }

            var stat;

            if (data.connTimes) {
                for (k in data.connTimes) {
                    stat = "c_" + k;
                    statsModel.set("c_" + k, data.connTimes[k]);
                }
            }

            if (data.pingTimes) {
                //console.log("ping times", data.pingTimes);
                for (k in data.pingTimes) {
                    stat = "p_" + k;
                    statsModel.set("p_" + k, data.pingTimes[k]);
                }
            }
        };

        ws.onclose = function() {
            console.log("WS Waiting ", connectInterval, " before reconnecting");
            $('#connectionStatus')
                .text('Waiting ' + connectInterval + ' to retry')
                .attr('class', '')
                .addClass('disconnected');

            setTimeout(startWS, connectInterval);
        };
        connectInterval = Math.floor((connectInterval*1.5));
    }

    startWS();
});
