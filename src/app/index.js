

import express from 'express';
import {default as oracledbAleph} from '@natlibfi/oracledb-aleph';
//import oracledbOrig from 'oracledb';
import HttpStatus from 'http-status';
import ipRangeCheck from 'ip-range-check';
import {createLogger, createExpressLogger} from '@natlibfi/melinda-backend-commons';
import {default as createMiddleware} from './middleware/index.js';

// oracledb parameter for using oracledbMock for tests!
export default async function ({middlewareOptions, httpPort, oracleUsername, oraclePassword, oracleConnectString, enableProxy = false, ipWhiteList, useCFHeader}, oracledb = oracledbAleph) {
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
      oracledb.outFormat = oracledb.OBJECT;
      oracledb.poolTimeout = 20;
      oracledb.events = false;
      // Check connection usability always
      oracledb.poolPingInterval = 0;
      //oracledb.poolPingInterval = 10;
    }
  }

  async function initExpress() {
    logger.debug(`initExpress`);
    const app = express();

    app.enable('trust proxy', Boolean(enableProxy));

    app.use(createExpressLogger({
      msg: '{{req.logLabel}} {{req.ip}} HTTP {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms'
    }));

    app.get('/', ipWhiteListMiddleware, await createMiddleware({...middlewareOptions, pool}));

    app.use(handleError);

    return app.listen(httpPort, () => logger.info('Started Melinda OAI-PMH provider'));

    // Express requires next to be present for the error handler to work, even if that argument is not used
    function handleError(err, req, res, next) {
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

    function ipWhiteListMiddleware(req, res, next) {
      logger.verbose('Ip whitelist middleware');
      //logger.silly(`Req headers: ${JSON.stringify(req.headers)}`);
      logger.silly(`Req cf-connecting-ip: ${JSON.stringify(req.headers['cf-connecting-ip'])}`);
      logger.silly(`Req ip: ${JSON.stringify(req.ip)}`);
      if (ipWhiteList.length === 0) {
        logger.silly(`Empty whitelist, not checking IP`);
        return next();
      }
      // If we do not want to use a CF header, or do not have a CF header, use req.ip in check
      const connectionIp = useCFHeader && req.headers['cf-connecting-ip'] ? req.headers['cf-connecting-ip'] : req.ip;
      logger.silly(`connectionIp: ${JSON.stringify(connectionIp)} (CF: ${req.headers['cf-connecting-ip']}, req.ip: ${req.ip}, useCFHeader: ${useCFHeader})`);
      //logger.debug(connectionIp);
      //const parsedConnectionIp = connectionIp.replace(/::ffff:/u, '');
      //logger.debug(parsedConnectionIp);
      if (ipRangeCheck(`${connectionIp}`, ipWhiteList)) {
        logger.debug('IP ok');
        return next();
      }

      logger.debug(`Bad IP: ${connectionIp} (CF: ${req.headers['cf-connecting-ip']}, req.ip: ${req.ip})`);
      return res.sendStatus(HttpStatus.FORBIDDEN);
    }
  }
}
