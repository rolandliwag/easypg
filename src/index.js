const { Pool } = require('pg');

const _getAborter = (client, destroy) =>
    (err) => {
        return client.release(destroy)
        .then(() => {
            throw new Error(err);
        });
    };

class EasyPG {
    /**
     * EasyPG class for simple queries and transactions using a supplied Pool or
     * creating a new pg.Pool.
     * @constructor
     * @param {Object|string} config - Can be a connection string or an object
     * @param {string} config.user - DB username
     * @param {string} config.password - DB password
     * @param {string} config.host - DB hostname
     * @param {string} config.port - DB port number
     * @param {string} config.database - Database name to connect to
     * @param {Pool} [DefaultPool] - Pool constructor. If not provided, default pg.Pool will be used
     */
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
     * Gets a client from the pool and runs the query.
     * @public
     * @param {Object} query A query config object
     * @param {String} query.text
     * @param {array|function(): array} query.params Array of parameters or function returning array of parameters
     * @return {Promise}
     */
    query({ text, params }) {
        return this.pool.query(text, Array.isArray(params) ? params : params());
    }

    /**
     * Runs each query in sequence as part of a transaction. Each object in the `queries` array must have `text`
     * and `params` properties. If provided, the optional `handler` property will be called after its associated
     * query resolves.
     * @public
     * @param {Array} queries An array of query config objects
     * @return {Promise}
     */
    runTransaction(queries) {
        return this.pool.connect()
        .then((client) => {
            const abort = _getAborter(client);
            const destroy = _getAborter(client, true);

            return client.query('BEGIN')
            .catch(abort)
            .then(() => {
                return queries.reduce((lastPromise, { text, params, handler }) => {
                    return lastPromise.then(() =>
                        client.query(text, Array.isArray(params) ? params : params())
                        .then(result => {
                            if (handler && typeof handler === 'function') {
                                return handler(result);
                            }
                        }));
                }, Promise.resolve())
                .catch((err) => {
                    return client.query('ROLLBACK')
                    .catch(destroy)
                    .then(() => {
                        throw err;
                    });
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

    /**
     * This ends the pool. It will not be possible to call `.query()` nor `.runTransaction()` on this instance after
     * calling `.end()`.
     * @public
     * @return {Promise}
     */
    end() {
        return this.pool.end();
    }
}

module.exports = EasyPG;
