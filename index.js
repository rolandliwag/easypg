const Promise = require('bluebird');
const { Pool, Client } = require('pg');

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
     * @param {Array} query.params
     */
    query({ text, params }) {
        return this.pool.query(text, params);
    }

    /**
     * @public
     * @param {Array} queries An array of query config objects
     */
    runTransaction(queries) {
        const getAborter = (client, destroy) => (err) => {
            return client.release(destroy)
            .then(() => {
                throw new Error(err);
            });
        }

        return this.pool.connect()
        .then((client) => {
            const abort = getAborter(client);
            const destroy = getAborter(client, true);

            return client.query('BEGIN')
            .catch(abort)
            .then(() => {
                return Promise.all(queries.map(({ text, params }) => {
                    return client.query(text, params);
                }))
                .catch((err) => {
                    client.query('ROLLBACK')
                    .catch(destroy);
                });
            })
            .then((results) => {
                return client.query('COMMIT')
                .then(() => {
                    return results;
                })
                .catch(destroy);
            });
        });
    }

    end() {
        return this.pool.end();
    }
}

module.exports = EasyPG;
