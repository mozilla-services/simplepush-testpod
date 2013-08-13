define([
    "_"
    , "backbone"
], function(
    _
    , Backbone
) {
    return Backbone.Model.extend({
        defaults: {
            // current connections
            conn_current: 0

            // Connection Stats
            , conn_attempted : 0
            , conn_ok        : 0
            , conn_fail      : 0
            , conn_rate      : 100

            // lifetime measurements
            , conn_lt_5s: 0
            , conn_lt_15s: 0
            , conn_lt_30s: 0
            , conn_lt_60s: 0
            , conn_lt_120s: 0
            , conn_lt_max: 0

            // Ping Stats
            , ping_sent     : 0
            , ping_received : 0
            , ping_timeout  : 0
            , ping_rate     : 12
            , ping_avg      : 0
            , ping_median   : 0
        }

        , initialize: function(options) {

            this.on('change:conn_attempted, change:conn_ok', function(m) {
                var rate = Math.round(m.get('conn_ok')/m.get('conn_attempted')*100);
                m.set('conn_rate', rate);
            });

            this.on('change:ping_sent, change:ping_received', function(m) {
                var rate = Math.round(m.get('ping_received')/m.get('ping_sent')*100);
                m.set('ping_rate', rate);
            });
        }
    });
});
