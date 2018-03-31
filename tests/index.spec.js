const EasyPg = require('../index');
const unexpected = require('unexpected');
const sinon = require('sinon');
const unexpectedSinon = require('unexpected-sinon');

const expect = unexpected.clone();
expect.use(require('unexpected-sinon'));

describe('easypg', () => {
    const connect = sinon.stub();
    const query = sinon.stub();
    const end = sinon.stub();
    const FakePool = function() {
        return { connect, query, end };
    };
    const dal = new EasyPg('postgres://', FakePool);

    afterEach(() => {
        connect.reset();
        query.reset();
        end.reset();
    });

    context('query()', () => {
        it('should call fakePool.query with text and params', () => {
            const queryConfig = {
                text: 'SELECT',
                params: [1]
            }
            query.returns(Promise.resolve());
            
            return expect(dal.query(queryConfig), 'to be fulfilled')
            .then(() => {
                expect(query, 'was called with', queryConfig.text, queryConfig.params);
            })
        });

        it('should be rejected on error', () => {
            const queryConfig = {
                text: 'SELECT',
                params: [1]
            }
            query.rejects();
            
            return expect(dal.query(queryConfig), 'to be rejected')
            .then(() => {
                expect(query, 'was called with', queryConfig.text, queryConfig.params);
            })
        });
    });

    context('runTransaction()', () => {
        it('should call fakePool.connect and reject on error', () => {
            const queryConfig = {};
            connect.resolves()

            return expect(dal.runTransaction([queryConfig]), 'to be rejected')
            .then(() => {
                expect(connect, 'was called');
            })
        });

        it('should rollback if error occurs', () => {
            const client = {
                query: sinon.stub().rejects(),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: []
            }, {
                text: '',
                params: []
            }];
            connect.resolves();

            return expect(dal.runQueriesInTransaction(queries), 'to be rejected')
            .catch(() => {
                expect(connect, 'was called');
                expect(client.query, 'was called with', 'ROLLBACK');
                expect(client.release, 'was called once');
                expect(client.release, 'was not called with', true);
            });
        });
    });

    context('runQueriesInTransaction()', () => {
        it('should call fakePool.connect and reject on error', () => {
            const queryConfig = {};
            connect.rejects();

            return expect(dal.runQueriesInTransaction([queryConfig]), 'to be rejected')
            .then(() => {
                expect(connect, 'was called');
            })
        });

        it('should call fakePool.query with text and params', () => {
            const firstHandler = sinon.stub();
            const secondHandler = sinon.stub();
            const client = {
                query: sinon.stub().resolves(),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: [],
                handler: firstHandler
            }, {
                text: '',
                params: [],
                handler: secondHandler
            }];
            connect.resolves(client);

            return expect(dal.runQueriesInTransaction(queries), 'to be fulfilled')
            .then(() => {
                expect(connect, 'was called');
                expect(client.release, 'was called once');
                expect(client.release, 'was called with', undefined);
                expect(firstHandler, 'was called once');
                expect(secondHandler, 'was called once');
            })
        });

        it('should rollback if error occurs', () => {
            const firstHandler = sinon.stub().rejects();
            const secondHandler = sinon.stub();
            const client = {
                query: sinon.stub().resolves(),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: [],
                handler: firstHandler
            }, {
                text: '',
                params: [],
                handler: secondHandler
            }];
            connect.resolves(client);

            return expect(dal.runQueriesInTransaction(queries), 'to be rejected')
            .catch(() => {
                expect(connect, 'was called');
                expect(client.query, 'was called with', 'ROLLBACK');
                expect(firstHandler, 'was called once');
                expect(secondHandler, 'was not called');
            });
        });
    });

    context('end()', () => {
        it('should call fakePool.end', () => {
            end.resolves();
            return expect(dal.end(), 'to be fulfilled');
        })
    });
});
