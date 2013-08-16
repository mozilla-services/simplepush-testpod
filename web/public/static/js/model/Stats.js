define([
    "_"
    , "backbone"
], function(
    _
    , Backbone
) {
    return Backbone.Model.extend({
        defaults: {
            test_seconds: 0

            , server        : ''
            , minupdatetime : 0
            , maxupdatetime : 0
            , clients       : 0
            , channels      : 0

            // Connection Stats
            , conn_attempted : 0
            , conn_waiting   : 0
            , conn_current   : 0
            , conn_ok        : 0
            , conn_drop      : 0

            // Connection Times
            , c_count  : 0 
            , c_t5s    : 0 
            , c_t30s   : 0 
            , c_t60s   : 0 
            , c_t300s  : 0 
            , c_t600s  : 0 
            , c_t1800s : 0 
            , c_tXs    : 0 

            // Update Stats
            , put_sent           : 0
            , put_failed         : 0
            , update_outstanding : 0
            , update_received    : 0
            , update_timeout     : 0
            , update_invalid     : 0
            , update_net_error   : 0
            , update_err_empty   : 0 // special, server sent an empty notify packet
            , update_rate        : 0

            // update timing latency (PushServer -> WS -> Client)
            , u_count    : 0
            , u_t50ms    : 0
            , u_t100ms   : 0
            , u_t500ms   : 0
            , u_t1500ms  : 0
            , u_t5000ms  : 0
            , u_t10000ms : 0
            , u_t20000ms : 0
            , u_t60000ms : 0
            , u_tXms     : 0
        }

        , initialize: function(options) {

            this.on('change:conn_attempted change:conn_ok', function(m) {
                var a = m.get('conn_attempted');
                if (a == 0) return;

                var rate = Math.round(m.get('conn_ok')/a*100);
                m.set('conn_rate', rate);
            });

            this.on('change:put_sent change:update_received', function(m) {
                var s = m.get('put_sent');
                if (s == 0) return;
                var rate = Math.round(m.get('update_received')/s*100);
                m.set('update_rate', rate);
            });
        }
    });
});
