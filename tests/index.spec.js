const EasyPg = require('../src/index');
const unexpected = require('unexpected');
const sinon = require('sinon');
const unexpectedSinon = require('unexpected-sinon');

const expect = unexpected.clone();

expect.use(unexpectedSinon);

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
                expect(query, 'to have a call satisfying', [queryConfig.text, queryConfig.params]);
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
                expect(query, 'to have a call satisfying', [queryConfig.text, queryConfig.params]);
            })
        });
    });

    context('runTransaction()', () => {
        it('should call fakePool.connect and reject on error', () => {
            const queryConfig = {};
            connect.rejects();

            return expect(dal.runTransaction([queryConfig]), 'to be rejected')
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

            return expect(dal.runTransaction(queries), 'to be fulfilled')
            .then(() => {
                expect(connect, 'was called');
                expect(client.release, 'was called once');
                expect(client.release, 'to have a call satisfying', []);
                expect(firstHandler, 'was called once');
                expect(secondHandler, 'was called once');
            });
        });

        it('should accept a function as params', () => {
            const firstHandler = sinon.stub();
            const secondHandler = sinon.stub();
            const client = {
                query: sinon.stub().resolves(),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: () => ([]),
                handler: firstHandler
            }, {
                text: '',
                params: () => ([]),
                handler: secondHandler
            }];
            connect.resolves(client);

            return expect(dal.runTransaction(queries), 'to be fulfilled')
            .then(() => {
                expect(connect, 'was called');
                expect(client.query, 'was called');
                expect(client.query, 'to have a call satisfying', {
                    args: ['', expect.it('to be an array')]
                });
                expect(client.release, 'was called once');
                expect(client.release, 'to have a call satisfying', []);
                expect(firstHandler, 'was called once');
                expect(secondHandler, 'was called once');
            });
        });

        it('should not require a handler function', () => {
            const firstHandler = sinon.stub();
            const client = {
                query: sinon.stub().resolves(),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: () => ([]),
                handler: firstHandler
            }, {
                text: '',
                params: () => ([])
            }];
            connect.resolves(client);

            return expect(dal.runTransaction(queries), 'to be fulfilled')
            .then(() => {
                expect(connect, 'was called');
                expect(client.query, 'was called');
                expect(client.query, 'to have a call satisfying', {
                    args: ['', expect.it('to be an array')]
                });
                expect(client.release, 'was called once');
                expect(client.release, 'to have a call satisfying', []);
                expect(firstHandler, 'was called once');
            });
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

            return expect(dal.runTransaction(queries), 'to be rejected')
            .catch(() => {
                expect(connect, 'was called');
                expect(client.query, 'to have a call satisfying', ['ROLLBACK']);
                expect(firstHandler, 'was called once');
                expect(secondHandler, 'was not called');
                expect(client.release, 'to have a call satisfying', []);
            });
        });

        it('should release the client if rollback fails', () => {
            const client = {
                query: sinon.stub().callsFake(query => {
                    if (query === 'BEGIN') {
                        return Promise.resolve();
                    } else {
                        return Promise.reject(new Error());
                    }
                }),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: []
            }, {
                text: '',
                params: []
            }];
            connect.resolves(client);

            return expect(dal.runTransaction(queries), 'to be rejected')
            .catch(() => {
                expect(connect, 'was called');
                expect(client.query, 'to have a call satisfying', ['ROLLBACK']);
                expect(client.release, 'to have a call satisfying', [true]);
            });
        });

        it('should call handlers and params in order of query objects', () => {
            let firstParamCallTime;
            let firstHandlerCallTime;
            let secondParamCallTime;
            let secondHandlerCallTime;

            const client = {
                query: sinon.stub().resolves(),
                release: sinon.stub().resolves()
            };
            const queries = [{
                text: '',
                params: () => {
                    firstParamCallTime = process.hrtime().toString();
                    return [];
                },
                handler: () => {
                    firstHandlerCallTime = process.hrtime().toString();
                    return new Promise(resolve => {
                        setTimeout(resolve, 100);
                    })
                }
            }, {
                text: '',
                params: () => {
                    secondParamCallTime = process.hrtime().toString();
                    return [];
                },
                handler: () => {
                    secondHandlerCallTime = process.hrtime().toString();
                }
            }];
            connect.resolves(client);

            return expect(dal.runTransaction(queries), 'to be fulfilled')
            .then(() => {
                expect(firstParamCallTime, 'to be less than', firstHandlerCallTime);
                expect(firstHandlerCallTime, 'to be less than', secondParamCallTime);
                expect(secondParamCallTime, 'to be less than', secondHandlerCallTime);
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
