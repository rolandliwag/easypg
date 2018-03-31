const Promise = require('bluebird');
const { Pool, Client } = require('pg');

const _getAborter = (client, destroy) => 
    (err) => {
        return client.release(destroy)
        .then(() => {
            throw new Error(err);
        });
    };

class EasyPG {
    constructor(config, DefaultPool = Pool) {
        let connectionString;

        if (typeof config === 'string') {
            connectionString = config;
        } else {
            connectionString = 'postgres://' + config.user + ':' + config.password + '@' +
                config.host + ':' + config.port + '/' + config.database;
        }

        this.pool = new DefaultPool({ connectionString });
    }

    /**
     * @public
     * @param {Object} query A query config object
     * @param {String} query.text
     * @param {Mixed} query.params Array of parameters or function returning array of parameters
     */
    query({ text, params }) {
        return this.pool.query(text, Array.isArray(params) ? params : params());
    }

    /**
     * @public
     * @param {Array} queries An array of query config objects
     */
    runTransaction(queries) {
        return this.pool.connect()
        .then((client) => {
            const abort = _getAborter(client);
            const destroy = _getAborter(client, true);

            return client.query('BEGIN')
            .catch(abort)
            .then(() => {
                return Promise.all(queries.map(({ text, params }) => {
                    return client.query(text, params);
                }))
                .catch((err) => {
                    return client.query('ROLLBACK')
                    .catch(destroy);
                });
            })
            .then((results) => {
                return client.query('COMMIT')
                .then(() => client.release())
                .then(() => results)
                .catch(destroy);
            });
        });
    }

    runQueriesInTransaction(queries) {
        return this.pool.connect()
        .then((client) => {
            const abort = _getAborter(client);
            const destroy = _getAborter(client, true);

            return client.query('BEGIN')
            .catch(abort)
            .then(() => {
                return Promise.each(queries, ({ text, params, handler }) => {
                    return client.query(text, params)
                    .then(handler);
                });
            })
            .catch((err) => {
                return client.query('ROLLBACK')
                .catch(() => {
                    destroy();
                })
                .then(() => {
                    throw err;
                });
            })
            .then((results) => {
                return client.query('COMMIT')
                .then(() => client.release())
                .then(() => results)
                .catch(destroy);
            });
        });
    }

    end() {
        return this.pool.end();
    }
}

module.exports = EasyPG;
