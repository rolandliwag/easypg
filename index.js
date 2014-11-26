var pg = require('pg'),
    async = require('async'),
    passError = require('passerror');

function EasyPG(config, suppliedPg) {
    var connString;

    if (typeof config === 'string') {
        connString = config;
    } else {
        connString = 'postgres://' + config.user + ':' + config.password + '@' +
            config.host + ':' + config.port + '/' + config.database;
    }

    if (suppliedPg) {
        pg = suppliedPg;
    }

    /**
     * @public
     * @param {Mixed} query A query config object or query string.
     * @param {Function} cb Callback function executed after the
     * query returns. Should have signature function (err, result).
     */
    this.query = function (query, cb) {
        pg.connect(connString, function (err, client, done) {
            if (err) {
                return cb(err);
            }

            client.query(query, function (err, result) {
                done();

                cb(err, result);
            });
        });
    };

    this.runTransaction = function (queries, cb) {
        pg.connect(connString, passError(cb, function (client, done) {
            client.query('BEGIN', function (err, result) {
                if (err) {
                    done();
                    return cb(err);
                }

                async.mapSeries(queries, function (query, next) {
                    client.query(query, next);
                }, function (err, results) {
                    if (err) {
                        client.query('ROLLBACK', function (rollbackErr) {
                            if (rollbackErr) {
                                done(true);
                                return cb('Could not rollback');
                            }

                            done();
                            cb(err);
                        });
                    }

                    client.query('COMMIT', function (commitErr) {
                        if (commitErr) {
                            done(true);
                            return cb('Could not commit');
                        }

                        done();
                        cb(null, results);
                    });
                });
            });
        }));
    };
}

module.exports = EasyPG;
