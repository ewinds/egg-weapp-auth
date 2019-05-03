'use strict';

const mock = require('egg-mock');

describe('test/mysql-paginator.test.js', () => {
  let app;
  before(() => {
    app = mock.app({
      baseDir: 'apps/mysql-paginator-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should GET /', () => {
    return app.httpRequest()
      .get('/')
      .expect('hi, mysqlPaginator')
      .expect(200);
  });
});
