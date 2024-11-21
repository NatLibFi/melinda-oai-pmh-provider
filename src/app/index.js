

import express from 'express';
import oracledbAleph from '@natlibfi/oracledb-aleph';
//import oracledbOrig from 'oracledb';
import HttpStatus from 'http-status';
import {createLogger, createExpressLogger} from '@natlibfi/melinda-backend-commons';
import createMiddleware from './middleware';

// oracledb parameter for using oracledbMock for tests!
export default async function ({middlewareOptions, httpPort, oracleUsername, oraclePassword, oracleConnectString, enableProxy = false}, oracledb = oracledbAleph) {
  //const oracledb = useOrigOracledb ? oracledbOrig : oracledbAleph;
  const logger = createLogger();
  //logger.debug(`Using original node-oracledb ${useOrigOracledb}`);
  const pool = await initOracle();
  const server = await initExpress();

  server.on('close', () => pool.close(0));

  return server;

  async function initOracle() {
    setOracleOptions();

    logger.debug(`Establishing connection to database (pool)... (${oracleConnectString})`);
    const pool = await oracledb.createPool({
      user: oracleUsername, password: oraclePassword,
      connectString: oracleConnectString
    });

    logger.debug('Connected to database!');

    return pool;

    function setOracleOptions() {
      oracledb.outFormat = oracledb.OBJECT; // eslint-disable-line functional/immutable-data
      oracledb.poolTimeout = 20; // eslint-disable-line functional/immutable-data
      oracledb.events = false; // eslint-disable-line functional/immutable-data
      // Check connection usability always
      oracledb.poolPingInterval = 0; // eslint-disable-line functional/immutable-data
      //oracledb.poolPingInterval = 10; // eslint-disable-line functional/immutable-data
    }
  }

  async function initExpress() {
    logger.debug(`initExpress`);
    const app = express();

    app.enable('trust proxy', Boolean(enableProxy));

    app.use(createExpressLogger({
      msg: '{{req.logLabel}} {{req.ip}} HTTP {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms'
    }));


    app.get('/', await createMiddleware({...middlewareOptions, pool}));

    app.use(handleError);

    return app.listen(httpPort, () => logger.info('Started Melinda OAI-PMH provider'));

    // Express requires next to be present for the error handler to work, even if that argument is not used
    function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
      logger.debug(`HandleError: ${err.message}`);
      logger.debug(`req.aborted: ${req.aborted}`);

      // The correct way would be to throw if the error is unexpected...There is a race condition between the request aborted event handler and running async function.
      /* istanbul ignore if: Not easily tested */
      if (req.aborted) {
        res.sendStatus(HttpStatus.REQUEST_TIMEOUT);
        return;
      }

      /*
      Const ORACLE_ERR_IGNORE_PATTERN = /^(NJS-018|NJS-003|ORA-01013):/;

      // Certain Oracle errors don't matter if the request was closed by the client
      if (err.message && ORACLE_ERR_IGNORE_PATTERN.test(err.message) && req.aborted) {
        res.sendStatus(HttpStatus.REQUEST_TIMEOUT);
        return;
      } */

      res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
      throw err;
    }
  }
}
