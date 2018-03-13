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
            query.returns(Promise.reject());
            
            return expect(dal.query(queryConfig), 'to be rejected')
            .then(() => {
                expect(query, 'was called with', queryConfig.text, queryConfig.params);
            })
        });
    });

    context('runTransaction()', () => {
        it('should call fakePool.connect and reject on error', () => {
            const queryConfig = {};
            connect.returns(Promise.reject());

            return expect(dal.runTransaction([queryConfig]), 'to be rejected')
            .then(() => {
                expect(connect, 'was called');
            })
        });
    });

    context('end()', () => {
        it('should call fakePool.end', () => {
            end.returns(Promise.resolve());
            return expect(dal.end(), 'to be fulfilled');
        })
    });
});
