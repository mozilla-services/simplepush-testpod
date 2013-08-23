function Stats() {
    this.data = {
        // Connection Stats
        conn_current   : 0
        , conn_attempted : 0
        , conn_wait      : 0 // wait for connection
        , conn_wait_reg  : 0 // waiting for registration
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
    };
}

Stats.prototype.merge = function(stats) {
    for(k in stats) {
        if (k in this.data) {
            switch(typeof(this.data[k])) {
                case 'number': 
                    this.data[k] += stats[k];
                    break;
                case 'string':
                    this.data[k] = stats[k];
                    break;
            }
        } else {
            // just add the value
            this.data[k] = stats[k];
        }
    }
}

module.exports = Stats;
